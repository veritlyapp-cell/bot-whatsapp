/**
 * Express Server - Multi-Tenant API
 * Handles WhatsApp webhook, authentication, and tenant-scoped operations
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import GeminiChatbot from './src/ai/gemini-chatbot.js';
import TenantService from './src/services/tenant-service.js';
import AuthController from './src/controllers/auth-controller.js';
import TenantController from './src/controllers/tenant-controller.js';
import authMiddleware, { requireRole } from './src/middleware/auth-middleware.js';
import tenantMiddleware from './src/middleware/tenant-middleware.js';
import { collections } from './src/config/firebase.js';
import { startConfirmationCron } from './src/cron/confirmation-cron.js';
import Logger from './src/utils/logger.js';
import Scheduler from './src/services/scheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize chatbot
const chatbot = new GeminiChatbot();

// Middleware
app.use(helmet({
    contentSecurityPolicy: false  // Allow inline scripts for demo
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve web interface

// Request logging middleware
app.use((req, res, next) => {
    Logger.info(`${req.method} ${req.path}`);
    next();
});

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication endpoints
app.post('/api/auth/login', AuthController.login);

// POST /api/chat - Handle incoming messages from WhatsApp (origin_id based routing)
app.post('/api/chat', async (req, res) => {
    try {
        const { phone, message, origin_id } = req.body;

        if (!phone || !message || !origin_id) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'phone, message, and origin_id are required'
            });
        }

        Logger.info(`📱 Incoming message from ${phone} via ${origin_id}: "${message}"`);

        // Map origin_id to tenant_id
        const tenant_id = await TenantService.getTenantIdFromOrigin(origin_id);

        // Process message with chatbot (multi-tenant)
        const result = await chatbot.processMessage(phone, message, origin_id, tenant_id);

        // Execute Actions (Side Effects)
        if (result.actions && result.actions.length > 0) {
            Logger.info(`⚡ Executing ${result.actions.length} actions for ${phone}`);

            for (const action of result.actions) {
                try {
                    console.log('ACTION DEBUG:', action.type);
                    switch (action.type) {
                        case 'schedule_interview':
                            const candidateData = action.data || {};
                            const candidateId = phone; // Use phone as ID for simplicity

                            try {
                                await Scheduler.scheduleInterview(tenant_id, candidateId, candidateData);
                            } catch (err) {
                                if (err.message === 'Candidate not found') {
                                    Logger.info(`👤 Creating candidate ${candidateId} before scheduling...`);
                                    // Create candidate if not exists
                                    await collections.postulante(tenant_id, candidateId).set({
                                        id: candidateId, // Phone as ID
                                        tenant_id,
                                        nombre: candidateData.nombre,
                                        dni: candidateData.dni,
                                        email: candidateData.email,
                                        edad: candidateData.edad,
                                        telefono: phone,
                                        createdAt: new Date(),
                                        updatedAt: new Date(),
                                        origen: 'whatsapp_bot',
                                        estado: 'en_proceso'
                                    });
                                    // Retry scheduling
                                    await Scheduler.scheduleInterview(tenant_id, candidateId, candidateData);
                                } else {
                                    throw err;
                                }
                            }
                            break;

                        case 'find_stores':
                            // Already handled in buildContext, but could trigger UI events in future
                            Logger.info('🏪 Find stores action triggered');
                            break;

                        case 'confirm_interview':
                            const candidateIdConfirm = phone;
                            await Scheduler.confirmInterview(tenant_id, candidateIdConfirm);
                            break;

                        case 'cancel_interview':
                            Logger.info(`🚫 Interview cancelled/rescheduled request by ${phone}`);
                            break;

                        case 'rejected':
                            Logger.info('🚫 Candidate rejected via bot filters');
                            // Could update candidate status here if not done
                            break;
                    }
                } catch (actionError) {
                    Logger.error(`❌ Error executing action ${action.type}:`, actionError);
                    // Log but don't fail the response
                }
            }
        }

        res.json({
            success: true,
            phone,
            response: result.response,
            state: result.newState,
            tenant_id
        });

    } catch (error) {
        Logger.error('❌ Error in /api/chat:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// ============================================
// PROTECTED ROUTES (Authentication Required)
// ============================================

// Get current authenticated user
app.get('/api/auth/me', authMiddleware, AuthController.getCurrentUser);

// Create new user (admin only)
app.post('/api/auth/users', authMiddleware, tenantMiddleware, requireRole('admin'), AuthController.createUser);

// Deactivate user (admin only)
app.delete('/api/auth/users/:userId', authMiddleware, tenantMiddleware, requireRole('admin'), AuthController.deactivateUser);

// ============================================
// TENANT CONFIGURATION ROUTES
// ============================================

// Get tenant configuration (logo, colors, branding)
app.get('/api/tenant/config', authMiddleware, tenantMiddleware, TenantController.getConfig);

// Update tenant configuration (admin only)
app.put('/api/tenant/config', authMiddleware, tenantMiddleware, requireRole('admin'), TenantController.updateConfig);

// ============================================
// CANDIDATES ROUTES
// ============================================

// GET /api/candidates - List candidates for authenticated user's tenant
app.get('/api/candidates', authMiddleware, tenantMiddleware, async (req, res) => {
    try {
        const tenant_id = req.user.tenant_id;
        const { estado, limit = 50 } = req.query;

        let query = collections.postulantes(tenant_id);

        // Filter by state if provided
        if (estado) {
            query = query.where('estado', '==', estado);
        }

        // Limit results
        query = query.limit(parseInt(limit));

        const snapshot = await query.get();
        const candidates = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        Logger.info(`📊 Retrieved ${candidates.length} candidates for ${tenant_id}`);

        res.json({
            success: true,
            count: candidates.length,
            candidates
        });

    } catch (error) {
        Logger.error('❌ Error in /api/candidates:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// POST /api/candidates - Create candidate (recruiter or admin)
app.post('/api/candidates', authMiddleware, tenantMiddleware, requireRole('recruiter'), async (req, res) => {
    try {
        const tenant_id = req.user.tenant_id;
        const candidateData = {
            ...req.body,
            tenant_id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: req.user.uid
        };

        const candidateRef = await collections.postulantes(tenant_id).add(candidateData);

        res.status(201).json({
            success: true,
            candidateId: candidateRef.id,
            message: 'Candidate created successfully'
        });

    } catch (error) {
        Logger.error('❌ Error creating candidate:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// ============================================
// VACANCIES ROUTES
// ============================================

// GET /api/vacancies - Get active vacancies for authenticated user's tenant
app.get('/api/vacancies', authMiddleware, tenantMiddleware, async (req, res) => {
    try {
        const tenant_id = req.user.tenant_id;
        const { tienda_id } = req.query;

        const allVacancies = [];

        if (tienda_id) {
            // Get vacancies for specific store
            const vacantesSnapshot = await collections.vacantes(tenant_id, tienda_id)
                .where('estado', '==', 'activo')
                .where('cuposDisponibles', '>', 0)
                .get();

            vacantesSnapshot.docs.forEach(vacanteDoc => {
                allVacancies.push({
                    id: vacanteDoc.id,
                    tienda_id,
                    ...vacanteDoc.data()
                });
            });
        } else {
            // Get all stores for this tenant
            const tiendasSnapshot = await collections.tiendas(tenant_id).get();

            // Get vacancies for each store
            for (const tiendaDoc of tiendasSnapshot.docs) {
                const tiendaId = tiendaDoc.id;
                const tiendaData = tiendaDoc.data();

                const vacantesSnapshot = await collections.vacantes(tenant_id, tiendaId)
                    .where('estado', '==', 'activo')
                    .where('cuposDisponibles', '>', 0)
                    .get();

                vacantesSnapshot.docs.forEach(vacanteDoc => {
                    allVacancies.push({
                        id: vacanteDoc.id,
                        tienda: {
                            id: tiendaId,
                            nombre: tiendaData.nombre,
                            distrito: tiendaData.distrito
                        },
                        ...vacanteDoc.data()
                    });
                });
            }
        }

        Logger.info(`📊 Retrieved ${allVacancies.length} vacancies for ${tenant_id}`);

        res.json({
            success: true,
            count: allVacancies.length,
            vacancies: allVacancies
        });

    } catch (error) {
        Logger.error('❌ Error in /api/vacancies:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// ============================================
// STORES ROUTES
// ============================================

// GET /api/stores - Get stores for authenticated user's tenant
app.get('/api/stores', authMiddleware, tenantMiddleware, async (req, res) => {
    try {
        const tenant_id = req.user.tenant_id;

        const tiendasSnapshot = await collections.tiendas(tenant_id).get();
        const stores = tiendasSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({
            success: true,
            count: stores.length,
            stores
        });

    } catch (error) {
        Logger.error('❌ Error in /api/stores:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// ============================================
// CONVERSATIONS ROUTES
// ============================================

// GET /api/conversations/:phone - Get conversation details (tenant-scoped)
app.get('/api/conversations/:phone', authMiddleware, tenantMiddleware, async (req, res) => {
    try {
        const { phone } = req.params;
        const tenant_id = req.user.tenant_id;

        const conversationDoc = await collections.conversacion(phone).get();

        if (!conversationDoc.exists) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Conversation not found'
            });
        }

        const conversationData = conversationDoc.data();

        // Verify conversation belongs to user's tenant
        if (conversationData.tenant_id !== tenant_id) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access to this conversation is not allowed'
            });
        }

        res.json({
            success: true,
            conversation: {
                id: conversationDoc.id,
                ...conversationData
            }
        });

    } catch (error) {
        Logger.error('❌ Error in /api/conversations:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// ============================================
// DATA LOADING (Admin only, multi-tenant aware)
// ============================================

app.post('/api/load-data', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        Logger.info('🔄 Data loading triggered via API');

        res.json({
            success: true,
            message: 'Use: npm run load-data to execute data loading script'
        });

    } catch (error) {
        Logger.error('❌ Error in /api/load-data:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// ============================================
// ERROR HANDLING
// ============================================

// Error handling middleware
app.use((err, req, res, next) => {
    Logger.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================
// SERVER START
// ============================================

app.listen(PORT, () => {
    Logger.success(`🚀 Multi-Tenant Server running on port ${PORT}`);
    Logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    Logger.info(`API Base URL: http://localhost:${PORT}`);
    console.log('');
    Logger.info('📡 Public endpoints:');
    Logger.info('   GET    /health');
    Logger.info('   POST   /api/auth/login');
    Logger.info('   POST   /api/chat (origin_id required)');
    console.log('');
    Logger.info('🔐 Protected endpoints (require authentication):');
    Logger.info('   GET    /api/auth/me');
    Logger.info('   POST   /api/auth/users (admin)');
    Logger.info('   GET    /api/tenant/config');
    Logger.info('   PUT    /api/tenant/config (admin)');
    Logger.info('   GET    /api/candidates');
    Logger.info('   POST   /api/candidates (recruiter+)');
    Logger.info('   GET    /api/vacancies');
    Logger.info('   GET    /api/stores');
    Logger.info('   GET    /api/conversations/:phone');
    console.log('');

    // Start cron jobs
    startConfirmationCron();
    console.log('');
});

export default app;

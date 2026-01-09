"use strict";
/**
 * Cloud Functions for LIAH - Recruitment Platform
 *
 * This file contains scheduled functions for:
 * - Daily RQ alert checking (configurable days without filling)
 * - Email notifications to recruiters
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerUnfilledCheck = exports.checkUnfilledRQs = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
// Define secret for Resend API
const resendApiKey = (0, params_1.defineSecret)('RESEND_API_KEY');
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
/**
 * Scheduled function that runs daily at 8:00 AM (Lima time)
 * Checks for RQs that have been in recruiting status for X+ days (configurable per holding)
 * and sends alert emails to assigned recruiters
 */
exports.checkUnfilledRQs = functions
    .runWith({
    timeoutSeconds: 300,
    memory: '256MB',
    secrets: [resendApiKey]
})
    .pubsub
    .schedule('0 8 * * *') // Every day at 8:00 AM
    .timeZone('America/Lima')
    .onRun(async (context) => {
    console.log('🔔 [ALERT] Starting daily RQ unfilled check...');
    const now = new Date();
    try {
        // Get all holdings with their alert settings
        const holdingsSnapshot = await db.collection('holdings').get();
        for (const holdingDoc of holdingsSnapshot.docs) {
            const holdingData = holdingDoc.data();
            const holdingId = holdingDoc.id;
            // Check if alerts are enabled for this holding
            if (holdingData.rqAlertsEnabled === false) {
                console.log(`[ALERT] Alerts disabled for holding: ${holdingId}`);
                continue;
            }
            // Get configurable days (default 7)
            const alertDays = holdingData.rqAlertDays || 7;
            const emailEnabled = holdingData.rqEmailNotifications !== false;
            const alertThreshold = new Date(now.getTime() - alertDays * 24 * 60 * 60 * 1000);
            console.log(`[ALERT] Processing holding ${holdingId} with ${alertDays} days threshold`);
            // Query RQs for this holding that are active and approved
            const rqsSnapshot = await db
                .collection('rqs')
                .where('holdingId', '==', holdingId)
                .where('status', '==', 'active')
                .where('approvalStatus', '==', 'approved')
                .get();
            console.log(`[ALERT] Found ${rqsSnapshot.size} active RQs for ${holdingId}`);
            const unfilledRQs = [];
            const batch = db.batch();
            for (const doc of rqsSnapshot.docs) {
                const rq = doc.data();
                // Check if RQ has been recruiting for X+ days
                const recruitmentStartedAt = rq.recruitment_started_at?.toDate()
                    || rq.approvedAt?.toDate()
                    || rq.createdAt?.toDate();
                if (recruitmentStartedAt && recruitmentStartedAt <= alertThreshold) {
                    // Mark as unfilled if not already
                    if (!rq.alert_unfilled) {
                        batch.update(doc.ref, {
                            alert_unfilled: true,
                            alert_unfilled_at: admin.firestore.Timestamp.now(),
                            alert_days_threshold: alertDays
                        });
                    }
                    unfilledRQs.push({
                        id: doc.id,
                        rqNumber: rq.rqNumber,
                        posicion: rq.posicion,
                        tiendaNombre: rq.tiendaNombre,
                        marcaNombre: rq.marcaNombre,
                        marcaId: rq.marcaId,
                        daysOpen: Math.floor((now.getTime() - recruitmentStartedAt.getTime()) / (1000 * 60 * 60 * 24))
                    });
                }
            }
            // Commit batch updates
            if (unfilledRQs.length > 0) {
                await batch.commit();
                console.log(`[ALERT] Marked ${unfilledRQs.length} RQs as unfilled for ${holdingId}`);
            }
            // Send emails if enabled
            if (emailEnabled && unfilledRQs.length > 0) {
                // Group RQs by marca for targeted notifications
                const rqsByMarca = unfilledRQs.reduce((acc, rq) => {
                    if (!acc[rq.marcaId]) {
                        acc[rq.marcaId] = {
                            marcaNombre: rq.marcaNombre,
                            rqs: []
                        };
                    }
                    acc[rq.marcaId].rqs.push(rq);
                    return acc;
                }, {});
                // Get recruiters for each marca and send notifications
                for (const [marcaId, data] of Object.entries(rqsByMarca)) {
                    // Find recruiters assigned to this marca
                    const recruitersSnapshot = await db
                        .collection('userAssignments')
                        .where('holdingId', '==', holdingId)
                        .where('role', '==', 'recruiter')
                        .where('active', '==', true)
                        .get();
                    // Filter recruiters assigned to this specific marca
                    const assignedRecruiters = recruitersSnapshot.docs
                        .map(d => d.data())
                        .filter((r) => r.assignedMarcas?.some((m) => m.marcaId === marcaId) ||
                        r.marcaId === marcaId);
                    for (const recruiter of assignedRecruiters) {
                        await sendAlertEmail(recruiter.email, recruiter.displayName, data.marcaNombre, data.rqs, alertDays, resendApiKey.value());
                    }
                }
            }
            console.log(`🔔 [ALERT] Completed check for ${holdingId}. ${unfilledRQs.length} RQs with ${alertDays}+ days unfilled.`);
        }
        return null;
    }
    catch (error) {
        console.error('[ALERT] Error in daily RQ check:', error);
        throw error;
    }
});
/**
 * Send alert email to recruiter about unfilled RQs
 */
async function sendAlertEmail(recruiterEmail, recruiterName, marcaNombre, rqs, alertDays, apiKey) {
    if (!apiKey) {
        console.log(`📧 [MOCK ALERT EMAIL] To: ${recruiterEmail}`);
        console.log(`RQs: ${rqs.map(r => r.rqNumber).join(', ')}`);
        return;
    }
    // Dynamically import Resend to avoid initialization issues
    const { Resend } = await Promise.resolve().then(() => __importStar(require('resend')));
    const resend = new Resend(apiKey);
    const rqsList = rqs.map(rq => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${rq.rqNumber || 'N/A'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${rq.posicion}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${rq.tiendaNombre}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #dc2626; font-weight: bold;">
                ${rq.daysOpen} días
            </td>
        </tr>
    `).join('');
    try {
        await resend.emails.send({
            from: 'LIAH Alertas <alertas@notifications.getliah.com>',
            to: recruiterEmail,
            subject: `🚨 ALERTA: ${rqs.length} posición(es) sin cubrir por más de ${alertDays} días - ${marcaNombre}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #dc2626, #f97316); padding: 20px; border-radius: 12px 12px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 20px;">
                            🚨 Alerta de RQs sin Cubrir
                        </h1>
                    </div>
                    
                    <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-top: none;">
                        <p style="color: #333; font-size: 16px;">
                            Hola <strong>${recruiterName || 'Recruiter'}</strong>,
                        </p>
                        
                        <p style="color: #333; font-size: 16px;">
                            Las siguientes posiciones de <strong>${marcaNombre}</strong> llevan más de <strong>${alertDays} días sin cubrirse</strong>:
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <thead>
                                <tr style="background: #f3f4f6;">
                                    <th style="padding: 12px; text-align: left; font-size: 14px;">RQ</th>
                                    <th style="padding: 12px; text-align: left; font-size: 14px;">Posición</th>
                                    <th style="padding: 12px; text-align: left; font-size: 14px;">Tienda</th>
                                    <th style="padding: 12px; text-align: left; font-size: 14px;">Días</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rqsList}
                            </tbody>
                        </table>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://liah.app/recruiter" 
                               style="background: linear-gradient(135deg, #7c3aed, #06b6d4); 
                                      color: white; 
                                      padding: 15px 30px; 
                                      text-decoration: none; 
                                      border-radius: 10px; 
                                      font-weight: bold;
                                      display: inline-block;">
                                Ver Dashboard de Reclutamiento
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px;">
                            Por favor, revisa estas posiciones y toma las acciones necesarias para acelerar el proceso de reclutamiento.
                        </p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 0 0 12px 12px;">
                        <p style="color: #999; font-size: 12px; margin: 0;">
                            Este es un mensaje automático de LIAH - Sistema de Alertas<br/>
                            © ${new Date().getFullYear()} LIAH
                        </p>
                    </div>
                </div>
            `
        });
        console.log(`✅ Alert email sent to: ${recruiterEmail}`);
    }
    catch (error) {
        console.error(`❌ Failed to send alert email to ${recruiterEmail}:`, error);
    }
}
/**
 * HTTP endpoint to manually trigger the unfilled RQ check
 * Useful for testing or manual intervention
 */
exports.triggerUnfilledCheck = functions
    .runWith({ secrets: [resendApiKey] })
    .https.onRequest(async (req, res) => {
    // Simple auth check - in production, use proper authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        const holdingId = req.query.holdingId;
        // Get holding settings
        let alertDays = 7;
        if (holdingId) {
            const holdingDoc = await db.collection('holdings').doc(holdingId).get();
            if (holdingDoc.exists) {
                alertDays = holdingDoc.data()?.rqAlertDays || 7;
            }
        }
        const alertThreshold = new Date(Date.now() - alertDays * 24 * 60 * 60 * 1000);
        let rqsQuery = db
            .collection('rqs')
            .where('status', '==', 'active')
            .where('approvalStatus', '==', 'approved');
        if (holdingId) {
            rqsQuery = rqsQuery.where('holdingId', '==', holdingId);
        }
        const rqsSnapshot = await rqsQuery.get();
        let unfilledCount = 0;
        for (const doc of rqsSnapshot.docs) {
            const rq = doc.data();
            const recruitmentStartedAt = rq.recruitment_started_at?.toDate()
                || rq.approvedAt?.toDate()
                || rq.createdAt?.toDate();
            if (recruitmentStartedAt && recruitmentStartedAt <= alertThreshold) {
                unfilledCount++;
            }
        }
        res.json({
            success: true,
            holdingId: holdingId || 'all',
            alertDays,
            totalActiveRQs: rqsSnapshot.size,
            unfilledRQs: unfilledCount,
            message: `Found ${unfilledCount} RQs with ${alertDays}+ days unfilled`
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
//# sourceMappingURL=index.js.map
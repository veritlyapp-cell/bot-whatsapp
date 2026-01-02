/**
 * Authentication Controller
 * Handles login, logout, and user management endpoints
 */

import AuthService from '../services/auth-service.js';
import Logger from '../utils/logger.js';

class AuthController {
    /**
     * Login endpoint
     * POST /api/auth/login
     */
    static async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Email and password are required'
                });
            }

            const result = await AuthService.login(email, password);

            res.json({
                success: true,
                token: result.token,
                user: result.user
            });

        } catch (error) {
            Logger.error('❌ Login error:', error);
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid credentials'
            });
        }
    }

    /**
     * Get current user
     * GET /api/auth/me
     */
    static async getCurrentUser(req, res) {
        try {
            // User data is already in req.user from authMiddleware
            const user = await AuthService.getUserById(req.user.uid);

            res.json({
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    nombre: user.nombre,
                    tenant_id: user.tenant_id,
                    role: user.role,
                    activo: user.activo
                }
            });

        } catch (error) {
            Logger.error('❌ Get current user error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to get user data'
            });
        }
    }

    /**
     * Create new user (admin only)
     * POST /api/auth/users
     */
    static async createUser(req, res) {
        try {
            const { email, password, nombre, role = 'viewer' } = req.body;
            const tenant_id = req.user.tenant_id; // Use authenticated user's tenant

            if (!email || !password || !nombre) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Email, password, and nombre are required'
                });
            }

            const newUser = await AuthService.createUser({
                email,
                password,
                nombre,
                tenant_id,
                role
            });

            res.status(201).json({
                success: true,
                user: newUser
            });

        } catch (error) {
            Logger.error('❌ Create user error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message || 'Failed to create user'
            });
        }
    }

    /**
     * Deactivate user (admin only)
     * DELETE /api/auth/users/:userId
     */
    static async deactivateUser(req, res) {
        try {
            const { userId } = req.params;

            await AuthService.deactivateUser(userId);

            res.json({
                success: true,
                message: 'User deactivated successfully'
            });

        } catch (error) {
            Logger.error('❌ Deactivate user error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to deactivate user'
            });
        }
    }
}

export default AuthController;

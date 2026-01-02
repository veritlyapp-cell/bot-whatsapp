/**
 * Authentication Middleware
 * Verifies Firebase Auth tokens and extracts user/tenant information
 */

import AuthService from '../services/auth-service.js';
import Logger from '../utils/logger.js';

/**
 * Middleware to verify Firebase Auth token
 */
export const authMiddleware = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header'
            });
        }

        const token = authHeader.split('Bearer ')[1];

        // Verify token
        const decodedToken = await AuthService.verifyToken(token);

        // Attach user data to request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            tenant_id: decodedToken.tenant_id,
            role: decodedToken.role
        };

        Logger.info(`✅ Authenticated: ${req.user.email} (${req.user.tenant_id})`);

        next();

    } catch (error) {
        Logger.error('❌ Authentication failed:', error);
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token'
        });
    }
};

/**
 * Middleware to require specific role
 * @param {string} requiredRole - Required role (viewer, recruiter, admin)
 */
export const requireRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        if (!AuthService.hasPermission(req.user.role, requiredRole)) {
            Logger.warn(`⚠️ Permission denied: ${req.user.email} requires ${requiredRole}`);
            return res.status(403).json({
                error: 'Forbidden',
                message: `Requires ${requiredRole} role or higher`
            });
        }

        next();
    };
};

export default authMiddleware;

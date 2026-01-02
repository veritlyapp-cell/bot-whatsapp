/**
 * Tenant Middleware
 * Validates tenant_id access and prevents cross-tenant data leakage
 */

import { collections } from '../config/firebase.js';
import Logger from '../utils/logger.js';

/**
 * Middleware to validate tenant access
 * Ensures user can only access their own tenant's data
 */
export const tenantMiddleware = async (req, res, next) => {
    try {
        // User must be authenticated first (authMiddleware should run before this)
        if (!req.user || !req.user.tenant_id) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User tenant information missing'
            });
        }

        const userTenantId = req.user.tenant_id;

        // Extract tenant_id from request (can be in params, query, or body)
        const requestTenantId = req.params.tenant_id ||
            req.query.tenant_id ||
            req.body.tenant_id;

        // If tenant_id is specified in request, validate it matches user's tenant
        if (requestTenantId && requestTenantId !== userTenantId) {
            Logger.warn(`🚨 Cross-tenant access attempt: ${req.user.email} tried to access ${requestTenantId}`);
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access to other tenant data is not allowed'
            });
        }

        // Verify tenant exists and is active
        const tenantDoc = await collections.tenantConfig(userTenantId).get();

        if (!tenantDoc.exists) {
            Logger.error(`❌ Tenant not found: ${userTenantId}`);
            return res.status(404).json({
                error: 'Not Found',
                message: 'Tenant not found'
            });
        }

        const tenantData = tenantDoc.data();

        if (!tenantData.activo) {
            Logger.warn(`⚠️ Inactive tenant access attempt: ${userTenantId}`);
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Tenant account is inactive'
            });
        }

        // Attach tenant data to request for easy access
        req.tenant = {
            tenant_id: userTenantId,
            nombre: tenantData.nombre,
            marca: tenantData.marca,
            ...tenantData
        };

        Logger.info(`✅ Tenant validated: ${userTenantId}`);

        next();

    } catch (error) {
        Logger.error('❌ Tenant validation failed:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Tenant validation failed'
        });
    }
};

export default tenantMiddleware;

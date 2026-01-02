/**
 * Tenant Controller
 * Handles tenant configuration and branding endpoints
 */

import TenantService from '../services/tenant-service.js';
import Logger from '../utils/logger.js';

class TenantController {
    /**
     * Get tenant configuration (logo, colors, branding)
     * GET /api/tenant/config
     */
    static async getConfig(req, res) {
        try {
            const tenant_id = req.user.tenant_id;

            const config = await TenantService.getTenantConfig(tenant_id);

            res.json({
                success: true,
                config
            });

        } catch (error) {
            Logger.error('❌ Get tenant config error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to get tenant configuration'
            });
        }
    }

    /**
     * Update tenant configuration (admin only)
     * PUT /api/tenant/config
     */
    static async updateConfig(req, res) {
        try {
            const tenant_id = req.user.tenant_id;
            const updates = req.body;

            // Prevent updating sensitive fields
            delete updates.tenant_id;
            delete updates.webhook_origin;
            delete updates.createdAt;

            await TenantService.updateTenantConfig(tenant_id, updates);

            res.json({
                success: true,
                message: 'Tenant configuration updated successfully'
            });

        } catch (error) {
            Logger.error('❌ Update tenant config error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to update tenant configuration'
            });
        }
    }
}

export default TenantController;

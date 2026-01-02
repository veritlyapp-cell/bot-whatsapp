/**
 * Tenant Service
 * Manages tenant configuration and origin_id mapping
 */

import { collections } from '../config/firebase.js';
import Logger from '../utils/logger.js';

class TenantService {
    // Cache for origin_id to tenant_id mapping
    static originToTenantCache = {};

    /**
     * Get tenant_id from origin_id
     * @param {string} origin_id - Origin ID from webhook
     * @returns {Promise<string>} - Tenant ID
     */
    static async getTenantIdFromOrigin(origin_id) {
        try {
            // Check cache first
            if (this.originToTenantCache[origin_id]) {
                return this.originToTenantCache[origin_id];
            }

            // Fallback mappings for development/testing
            const fallbackMappings = {
                'ngr-whatsapp': 'ngr',
                'ngr-web': 'ngr',
                'test-whatsapp': 'ngr',
                'demo': 'ngr'
            };

            if (fallbackMappings[origin_id]) {
                const tenant_id = fallbackMappings[origin_id];
                this.originToTenantCache[origin_id] = tenant_id;
                Logger.info(`📍 Fallback mapping: ${origin_id} → ${tenant_id}`);
                return tenant_id;
            }

            // Query Firestore for tenant with this origin_id
            const tenantsSnapshot = await collections.tenants()
                .where('webhook_origin', '==', origin_id)
                .limit(1)
                .get();

            if (tenantsSnapshot.empty) {
                throw new Error(`No tenant found for origin_id: ${origin_id}`);
            }

            const tenantDoc = tenantsSnapshot.docs[0];
            const tenant_id = tenantDoc.id;

            // Cache the mapping
            this.originToTenantCache[origin_id] = tenant_id;

            Logger.info(`📍 Mapped origin ${origin_id} → tenant ${tenant_id}`);
            return tenant_id;

        } catch (error) {
            Logger.error(`❌ Error mapping origin_id to tenant_id:`, error);
            throw error;
        }
    }

    /**
     * Get tenant configuration
     * @param {string} tenant_id - Tenant ID
     * @returns {Promise<Object>} - Tenant config
     */
    static async getTenantConfig(tenant_id) {
        try {
            const tenantDoc = await collections.tenantConfig(tenant_id).get();

            if (!tenantDoc.exists) {
                throw new Error(`Tenant not found: ${tenant_id}`);
            }

            const config = tenantDoc.data();

            return {
                tenant_id,
                nombre: config.nombre,
                marca: config.marca,
                logo: config.logo,
                colores: config.colores,
                contacto: config.contacto,
                webhook_origin: config.webhook_origin,
                activo: config.activo
            };

        } catch (error) {
            Logger.error(`❌ Error getting tenant config:`, error);
            throw error;
        }
    }

    /**
     * Get all active tenants
     * @returns {Promise<Array>} - Array of tenant configs
     */
    static async getAllTenants() {
        try {
            const snapshot = await collections.tenants()
                .where('activo', '==', true)
                .get();

            return snapshot.docs.map(doc => ({
                tenant_id: doc.id,
                ...doc.data()
            }));

        } catch (error) {
            Logger.error(`❌ Error getting all tenants:`, error);
            throw error;
        }
    }

    /**
     * Update tenant configuration
     * @param {string} tenant_id - Tenant ID
     * @param {Object} updates - Configuration updates
     * @returns {Promise<void>}
     */
    static async updateTenantConfig(tenant_id, updates) {
        try {
            await collections.tenantConfig(tenant_id).update({
                ...updates,
                updatedAt: new Date()
            });

            Logger.success(`✅ Tenant config updated: ${tenant_id}`);

        } catch (error) {
            Logger.error(`❌ Error updating tenant config:`, error);
            throw error;
        }
    }

    /**
     * Clear origin cache (useful after tenant updates)
     */
    static clearCache() {
        this.originToTenantCache = {};
        Logger.info('🗑️ Origin cache cleared');
    }
}

export default TenantService;

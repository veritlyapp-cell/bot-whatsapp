/**
 * Script to create initial admin users for each tenant
 * Run: node src/scripts/create-admin-users.js
 */

import AuthService from '../services/auth-service.js';
import TenantService from '../services/tenant-service.js';
import Logger from '../utils/logger.js';

const adminUsers = [
    {
        email: 'admin@papajohns.pe',
        password: 'PapaJohns2024!',
        nombre: 'Admin Papa Johns',
        tenant_id: 'ngr_papajohns',
        role: 'admin'
    },
    {
        email: 'admin@bembos.pe',
        password: 'Bembos2024!',
        nombre: 'Admin Bembos',
        tenant_id: 'ngr_bembos',
        role: 'admin'
    },
    {
        email: 'admin@dunkin.pe',
        password: 'Dunkin2024!',
        nombre: 'Admin Dunkin',
        tenant_id: 'ngr_dunkin',
        role: 'admin'
    },
    {
        email: 'admin@popeyes.pe',
        password: 'Popeyes2024!',
        nombre: 'Admin Popeyes',
        tenant_id: 'ngr_popeyes',
        role: 'admin'
    },
    {
        email: 'admin@donbelisario.pe',
        password: 'DonBelisario2024!',
        nombre: 'Admin Don Belisario',
        tenant_id: 'ngr_donbelisario',
        role: 'admin'
    },
    {
        email: 'admin@chinawok.pe',
        password: 'Chinawok2024!',
        nombre: 'Admin Chinawok',
        tenant_id: 'ngr_chinawok',
        role: 'admin'
    },
    {
        email: 'admin@sr.pe',
        password: 'SR2024!',
        nombre: 'Admin SR',
        tenant_id: 'ngr_sr',
        role: 'admin'
    }
];

async function createAdminUsers() {
    Logger.info('🔧 Creating admin users for all tenants...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const userData of adminUsers) {
        try {
            // Check if tenant exists
            const tenantConfig = await TenantService.getTenantConfig(userData.tenant_id);
            Logger.info(`📍 Creating user for: ${tenantConfig.nombre}`);

            // Create user
            const user = await AuthService.createUser(userData);
            Logger.success(`   ✅ Created: ${user.email}`);
            Logger.info(`   🔑 Password: ${userData.password}`);
            console.log('');

            successCount++;

        } catch (error) {
            Logger.error(`   ❌ Error creating ${userData.email}:`, error.message);
            console.log('');
            errorCount++;
        }
    }

    console.log('');
    Logger.info('═══════════════════════════════════════════');
    Logger.success(`✅ Successfully created ${successCount} admin users`);
    if (errorCount > 0) {
        Logger.warn(`⚠️  Failed to create ${errorCount} users`);
    }
    Logger.info('═══════════════════════════════════════════');
    console.log('');
    Logger.info('📋 Admin Credentials:');
    adminUsers.forEach(user => {
        Logger.info(`   ${user.email} / ${user.password} (${user.tenant_id})`);
    });
    console.log('');

    process.exit(0);
}

// Run the script
createAdminUsers().catch(error => {
    Logger.error('💥 Script failed:', error);
    process.exit(1);
});

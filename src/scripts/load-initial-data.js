/**
 * Script to load initial data into Firestore (Multi-Tenant)
 * Loads tenants, stores, and vacancies with tenant_id isolation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { db, collections } from '../config/firebase.js';
import Logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load tenant configurations
 */
async function loadTenants() {
    Logger.info('📦 Loading tenant configurations...');

    try {
        const filePath = path.join(__dirname, '../../data/tenant-data.json');
        const tenantsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        let totalTenants = 0;

        for (const tenant of tenantsData) {
            const tenantRef = collections.tenantConfig(tenant.tenant_id);

            await tenantRef.set({
                nombre: tenant.nombre,
                marca: tenant.marca,
                logo: tenant.logo,
                colores: tenant.colores,
                contacto: tenant.contacto,
                webhook_origin: tenant.webhook_origin,
                activo: tenant.activo !== undefined ? tenant.activo : true,
                createdAt: new Date(),
                updatedAt: new Date()
            }, { merge: true });

            Logger.info(`  ✓ Tenant created: ${tenant.nombre} (${tenant.tenant_id})`);
            totalTenants++;
        }

        Logger.success(`✅ Successfully loaded ${totalTenants} tenants`);
        return totalTenants;
    } catch (error) {
        Logger.error('❌ Error loading tenants:', error);
        throw error;
    }
}

/**
 * Load stores from maestra_tiendas.json into Firestore with tenant_id
 */
async function loadStores() {
    Logger.info('📦 Loading stores from maestra_tiendas.json...');

    try {
        const filePath = path.join(__dirname, '../../data/maestra_tiendas.json');
        const storesData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Map marca to tenant_id
        const marcaToTenantId = {
            'Papa Johns': 'ngr_papajohns',
            'Bembos': 'ngr_bembos',
            'Dunkin': 'ngr_dunkin',
            'Popeyes': 'ngr_popeyes',
            'Don Belisario': 'ngr_donbelisario',
            'Chinawok': 'ngr_chinawok',
            'SR': 'ngr_sr'
        };

        let totalStores = 0;

        for (const store of storesData) {
            const tenant_id = marcaToTenantId[store.marca];

            if (!tenant_id) {
                Logger.warn(`⚠️ Unknown marca: ${store.marca}, skipping...`);
                continue;
            }

            const tiendaId = store.codigo.toLowerCase();
            const tiendaRef = collections.tienda(tenant_id, tiendaId);

            await tiendaRef.set({
                tenant_id: tenant_id,
                codigo: store.codigo,
                nombre: store.nombre,
                direccion: store.direccion,
                distrito: store.distrito,
                zona: store.zona,
                gerente: store.gerente,
                email: store.email,
                telefono: store.telefono,
                marca: store.marca,
                activo: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }, { merge: true });

            totalStores++;
        }

        Logger.success(`✅ Successfully loaded ${totalStores} stores`);
        return totalStores;
    } catch (error) {
        Logger.error('❌ Error loading stores:', error);
        throw error;
    }
}

/**
 * Load vacancies from requerimientos_quincenales.csv into Firestore with tenant_id
 */
async function loadVacancies() {
    Logger.info('📦 Loading vacancies from requerimientos_quincenales.csv...');

    return new Promise((resolve, reject) => {
        const filePath = path.join(__dirname, '../../data/requerimientos_quincenales.csv');
        const vacancies = [];

        // Map marca to tenant_id
        const marcaToTenantId = {
            'Papa Johns': 'ngr_papajohns',
            'Bembos': 'ngr_bembos',
            'Dunkin': 'ngr_dunkin',
            'Popeyes': 'ngr_popeyes',
            'Don Belisario': 'ngr_donbelisario',
            'Chinawok': 'ngr_chinawok',
            'SR': 'ngr_sr'
        };

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                vacancies.push(row);
            })
            .on('end', async () => {
                try {
                    let totalVacancies = 0;

                    for (const vacancy of vacancies) {
                        const tenant_id = marcaToTenantId[vacancy.marca];

                        if (!tenant_id) {
                            Logger.warn(`⚠️ Unknown marca: ${vacancy.marca}, skipping...`);
                            continue;
                        }

                        const tiendaId = vacancy.codigo_tienda.toLowerCase();

                        // Create vacancy document
                        const vacanteRef = collections.vacantes(tenant_id, tiendaId).doc();

                        await vacanteRef.set({
                            tenant_id: tenant_id,
                            puesto: vacancy.puesto,
                            cupos: parseInt(vacancy.cupos),
                            cuposDisponibles: parseInt(vacancy.cupos),
                            tipoTurno: vacancy.tipo_turno,
                            fechaInicio: new Date(vacancy.fecha_inicio),
                            fechaFin: new Date(vacancy.fecha_fin),
                            marca: vacancy.marca,
                            codigoTienda: vacancy.codigo_tienda,
                            tiendaId: tiendaId,
                            estado: 'activo',
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });

                        totalVacancies++;
                    }

                    Logger.success(`✅ Successfully loaded ${totalVacancies} vacancies`);
                    resolve(totalVacancies);
                } catch (error) {
                    Logger.error('❌ Error loading vacancies:', error);
                    reject(error);
                }
            })
            .on('error', (error) => {
                Logger.error('❌ Error reading CSV file:', error);
                reject(error);
            });
    });
}

/**
 * Main execution
 */
async function main() {
    Logger.info('🚀 Starting multi-tenant data loading process...\n');

    try {
        const tenantCount = await loadTenants();
        console.log('');
        const storeCount = await loadStores();
        console.log('');
        const vacancyCount = await loadVacancies();

        console.log('');
        Logger.success('🎉 Data loading completed successfully!');
        Logger.info(`   Tenants: ${tenantCount}`);
        Logger.info(`   Stores: ${storeCount}`);
        Logger.info(`   Vacancies: ${vacancyCount}`);

        process.exit(0);
    } catch (error) {
        Logger.error('💥 Data loading failed:', error);
        process.exit(1);
    }
}

main();

/**
 * Store Matcher Service
 * Matches candidates with nearby stores based on district and available vacancies
 */

import { collections } from '../config/firebase.js';
import Logger from '../utils/logger.js';
import GeolocationService from './geolocation-service.js';

// District proximity mapping (simple version - can be enhanced with real geolocation)
const DISTRICT_ZONES = {
    'Lima Centro': ['San Isidro', 'Miraflores', 'San Borja', 'Lince', 'Pueblo Libre'],
    'Lima Este': ['Surco', 'La Molina', 'Ate'],
    'Lima Norte': ['San Miguel', 'Los Olivos'],
    'Lima Sur': ['Surquillo', 'Villa El Salvador']
};

// Create reverse mapping for quick lookups
const DISTRICT_TO_ZONE = {};
for (const [zone, districts] of Object.entries(DISTRICT_ZONES)) {
    districts.forEach(district => {
        DISTRICT_TO_ZONE[district.toLowerCase()] = zone;
    });
}

class StoreMatcher {
    /**
     * Get zone for a given district
     * @param {string} district - District name
     * @returns {string} - Zone name
     */
    static getZoneForDistrict(district) {
        const normalizedDistrict = district.toLowerCase().trim();
        return DISTRICT_TO_ZONE[normalizedDistrict] || null;
    }

    /**
     * Check if two districts are in the same zone
     * @param {string} district1 - First district
     * @param {string} district2 - Second district
     * @returns {boolean}
     */
    static areDistrictsInSameZone(district1, district2) {
        const zone1 = this.getZoneForDistrict(district1);
        const zone2 = this.getZoneForDistrict(district2);
        return zone1 && zone2 && zone1 === zone2;
    }

    /**
     * Find stores with active vacancies matching candidate criteria
     * @param {Object} candidateData - { distrito, disponibilidad, marcaId (optional) }
     * @returns {Promise<Array>} - Array of matching stores with vacancies
     */
    static async findMatchingStores(candidateData) {
        try {
            const { distrito, disponibilidad, tenant_id, lat, lng } = candidateData;
            Logger.info('🔍 Finding matching stores', { distrito, disponibilidad, tenant_id, lat, lng });

            if (!tenant_id) {
                Logger.error('❌ Tenant ID is required for finding matching stores');
                return [];
            }

            // 1. Determine Candidate Location (GPS or District Center)
            let candidateLocation = null;
            if (lat && lng) {
                candidateLocation = { lat, lng };
            } else if (distrito) {
                candidateLocation = GeolocationService.getDistrictCoordinates(distrito);
            }

            if (!candidateLocation) {
                Logger.warn(`⚠️ Could not determine location for district '${distrito}'`);
                // Fallback: If no location found, maybe return empty or fallback to old string matching? 
                // For now, let's require a valid location resolution.
                return [];
            }

            const matches = [];

            // 2. Get all stores for the tenant
            const tiendasSnapshot = await collections.tiendas(tenant_id).get();

            // 3. Search through stores
            for (const tiendaDoc of tiendasSnapshot.docs) {
                const tienda = { id: tiendaDoc.id, ...tiendaDoc.data() };

                // 4. Determine Store Location
                // Priority: explicit coords in DB > derived from district
                let storeLocation = null;
                if (tienda.lat && tienda.lng) {
                    storeLocation = { lat: parseFloat(tienda.lat), lng: parseFloat(tienda.lng) };
                } else if (tienda.coordinates) {
                    storeLocation = tienda.coordinates;
                } else if (tienda.distrito) {
                    storeLocation = GeolocationService.getDistrictCoordinates(tienda.distrito);
                }

                if (storeLocation) {
                    // 5. Calculate Distance
                    const distanceKm = GeolocationService.calculateDistance(
                        candidateLocation.lat, candidateLocation.lng,
                        storeLocation.lat, storeLocation.lng
                    );

                    // Filter by max distance (7km)
                    const MAX_DISTANCE_KM = 7;

                    if (distanceKm <= MAX_DISTANCE_KM) {
                        // Get active vacancies for this store
                        // Vacancies are subcollection of store in multi-tenant schema
                        const vacantesSnapshot = await collections.vacantes(tenant_id, tienda.id)
                            .where('estado', '==', 'activo')
                            .where('cuposDisponibles', '>', 0)
                            .get();

                        // Filter vacancies by shift compatibility
                        const compatibleVacancies = [];
                        vacantesSnapshot.docs.forEach(vacanteDoc => {
                            const vacante = { id: vacanteDoc.id, ...vacanteDoc.data() };
                            const isShiftCompatible =
                                vacante.tipoTurno === 'mixto' ||
                                disponibilidad === 'mixto' ||
                                vacante.tipoTurno === disponibilidad;

                            if (isShiftCompatible) {
                                compatibleVacancies.push(vacante);
                            }
                        });

                        if (compatibleVacancies.length > 0) {
                            matches.push({
                                tienda: {
                                    id: tienda.id,
                                    codigo: tienda.codigo,
                                    nombre: tienda.nombre,
                                    direccion: tienda.direccion,
                                    distrito: tienda.distrito,
                                    zona: tienda.zona,
                                    marca: tienda.marca || 'NGR', // Fallback if brand missing
                                    marcaId: tienda.marcaId, // might be undefined
                                    distanceKm: distanceKm
                                },
                                vacantes: compatibleVacancies,
                                totalCupos: compatibleVacancies.reduce((sum, v) => sum + v.cuposDisponibles, 0),
                                distancePriority: distanceKm // Lower distance is better
                            });
                        }
                    }
                }
            }

            // Sort by distance (asc) then total vacancies (desc)
            matches.sort((a, b) => {
                if (Math.abs(a.distancePriority - b.distancePriority) > 0.5) { // 0.5km difference matters
                    return a.distancePriority - b.distancePriority;
                }
                return b.totalCupos - a.totalCupos;
            });

            // Return top 3 matches
            const topMatches = matches.slice(0, 3);
            Logger.success(`✅ Found ${topMatches.length} matching stores within 7km for tenant ${tenant_id}`);
            return topMatches;

        } catch (error) {
            Logger.error('❌ Error finding matching stores:', error);
            throw error;
        }
    }

    /**
     * Get available vacancies for a specific store
     * @param {string} tenantId - Tenant ID
     * @param {string} tiendaId - Store ID
     * @returns {Promise<Array>} - Array of active vacancies
     */
    static async getStoreVacancies(tenantId, tiendaId) {
        try {
            const vacantesSnapshot = await collections.vacantes(tenantId, tiendaId)
                .where('estado', '==', 'activo')
                .where('cuposDisponibles', '>', 0)
                .get();

            return vacantesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            Logger.error('❌ Error getting store vacancies:', error);
            throw error;
        }
    }
}

export default StoreMatcher;

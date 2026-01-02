/**
 * Geolocation Service
 * Handles distance calculations and location resolution
 */

import Logger from '../utils/logger.js';

// Central coordinates for Lima districts (approximate)
const DISTRICT_COORDINATES = {
    // Lima Centro
    'lima': { lat: -12.0464, lng: -77.0428 },
    'breña': { lat: -12.0569, lng: -77.0536 },
    'jesús maría': { lat: -12.0756, lng: -77.0485 },
    'lince': { lat: -12.0874, lng: -77.0396 },
    'magdalena del mar': { lat: -12.0945, lng: -77.0680 },
    'miraflores': { lat: -12.1111, lng: -77.0316 },
    'pueblo libre': { lat: -12.0784, lng: -77.0628 },
    'san borja': { lat: -12.1023, lng: -77.0019 },
    'san isidro': { lat: -12.0950, lng: -77.0360 },
    'san miguel': { lat: -12.0838, lng: -77.0792 },
    'surquillo': { lat: -12.1126, lng: -77.0125 },
    'barranco': { lat: -12.1485, lng: -77.0210 },

    // Lima Norte
    'ancón': { lat: -11.7766, lng: -77.1720 },
    'carabayllo': { lat: -11.8767, lng: -77.0279 },
    'comas': { lat: -11.9368, lng: -77.0545 },
    'independencia': { lat: -11.9961, lng: -77.0560 },
    'los olivos': { lat: -11.9772, lng: -77.0700 },
    'puente piedra': { lat: -11.8683, lng: -77.0743 },
    'san martín de porres': { lat: -12.0084, lng: -77.0864 },
    'santa rosa': { lat: -11.8028, lng: -77.1697 },

    // Lima Sur
    'chorrillos': { lat: -12.1906, lng: -77.0069 },
    'lurín': { lat: -12.2741, lng: -76.8711 },
    'pachacámac': { lat: -12.2281, lng: -76.8617 },
    'san juan de miraflores': { lat: -12.1627, lng: -76.9636 },
    'santiago de surco': { lat: -12.1337, lng: -76.9863 },
    'surco': { lat: -12.1337, lng: -76.9863 }, // Alias
    'villa el salvador': { lat: -12.2197, lng: -76.9272 },
    'villa maría del triunfo': { lat: -12.1611, lng: -76.9298 },

    // Lima Este
    'ate': { lat: -12.0292, lng: -76.9360 },
    'ieneguilla': { lat: -12.1121, lng: -76.8189 },
    'el agustino': { lat: -12.0494, lng: -77.0016 },
    'la molina': { lat: -12.0830, lng: -76.9360 },
    'rimac': { lat: -12.0315, lng: -77.0298 }, // Alias for SJL proximity usually
    'san juan de lurigancho': { lat: -11.9723, lng: -77.0031 },
    'santa anita': { lat: -12.0433, lng: -76.9632 },

    // Callao
    'callao': { lat: -12.0562, lng: -77.1182 },
    'bellavista': { lat: -12.0620, lng: -77.1009 },
    'carmen de la legua': { lat: -12.0436, lng: -77.0945 },
    'la perla': { lat: -12.0664, lng: -77.1126 },
    'la punta': { lat: -12.0729, lng: -77.1643 },
    'ventanilla': { lat: -11.8797, lng: -77.1264 },
    'mi perú': { lat: -11.8596, lng: -77.1232 }
};

class GeolocationService {
    /**
     * Calculate distance between two points in km (Haversine formula)
     * @param {number} lat1 
     * @param {number} lon1 
     * @param {number} lat2 
     * @param {number} lon2 
     * @returns {number} Distance in km
     */
    static calculateDistance(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;

        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km

        return Math.round(d * 100) / 100; // Round to 2 decimal places
    }

    static deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

    /**
     * Get coordinates for a district name (fuzzy match)
     * @param {string} districtName 
     * @returns {Object|null} { lat, lng } or null if not found
     */
    static getDistrictCoordinates(districtName) {
        if (!districtName) return null;

        const normalized = districtName.toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents

        // Try direct match
        for (const [name, coords] of Object.entries(DISTRICT_COORDINATES)) {
            const normalizedKey = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
                return coords;
            }
        }

        return null;
    }

    /**
     * Parse location from WhatsApp message (Location attachment or text)
     * @param {Object} messageBody - The message content (text or object)
     * @returns {Object|null} { lat, lng } or { district } or null
     */
    static parseLocation(messageBody) {
        // If it's coordinates (from WhatsApp location attachment)
        // Note: The current simulator/bot wrapper passes message as string usually.
        // We'd need to adjust the controller to pass raw object if attachment.

        // For text input (District name)
        if (typeof messageBody === 'string') {
            const coords = this.getDistrictCoordinates(messageBody);
            if (coords) return { ...coords, type: 'district_center', name: messageBody };
        }

        return null;
    }
}

export default GeolocationService;

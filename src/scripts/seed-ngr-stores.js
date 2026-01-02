
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('../../firebase-service-account.json');

// Initialize Firebase Admin (Script independent)
if (!process.env.FIREBASE_CONFIG) { // Only init if not already (though in script it's standalone)
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();
const TENANT_ID = 'ngr_holding'; // Using a fixed tenant ID for the demo

// Real coordinates for some NGR locations in Lima
const STORES_DATA = [
    // --- BEMBOS ---
    {
        codigo: 'BEM-001',
        nombre: 'Bembos Larco',
        marca: 'Bembos',
        marcaId: 'bembos',
        direccion: 'Av. Jose Larco 1078, Miraflores',
        distrito: 'Miraflores',
        zona: 'Lima Centro',
        coordinates: { lat: -12.12648, lng: -77.02928 }, // Parque Salazar approx
        vacantes: [
            { puesto: 'Atención al Cliente', modalidad: 'Part Time', turno: 'Tarde', cupos: 5 },
            { puesto: 'Cocina', modalidad: 'Full Time', turno: 'Cierre', cupos: 2 }
        ]
    },
    {
        codigo: 'BEM-002',
        nombre: 'Bembos Javier Prado',
        marca: 'Bembos',
        marcaId: 'bembos',
        direccion: 'Av. Javier Prado Este 4000, Surco',
        distrito: 'Santiago de Surco',
        zona: 'Lima Este',
        coordinates: { lat: -12.08658, lng: -76.97541 }, // Jockey/U.Lima area
        vacantes: [
            { puesto: 'Motorizado', modalidad: 'Full Time', turno: 'Apertura', cupos: 3 }
        ]
    },
    {
        codigo: 'BEM-003',
        nombre: 'Bembos MegaPlaza',
        marca: 'Bembos',
        marcaId: 'bembos',
        direccion: 'Av. Alfredo Mendiola 3698, Independencia',
        distrito: 'Independencia',
        zona: 'Lima Norte',
        coordinates: { lat: -11.99427, lng: -77.06085 },
        vacantes: [
            { puesto: 'Producción', modalidad: 'Part Time', turno: 'Rotativo', cupos: 10 }
        ]
    },

    // --- PAPA JOHNS ---
    {
        codigo: 'PJ-001',
        nombre: 'Papa Johns Espinar',
        marca: 'Papa Johns',
        marcaId: 'papajohns',
        direccion: 'Av. Comandante Espinar 300, Miraflores',
        distrito: 'Miraflores',
        zona: 'Lima Centro',
        coordinates: { lat: -12.11893, lng: -77.03442 },
        vacantes: [
            { puesto: 'Pizzero', modalidad: 'Full Time', turno: 'Cierre', cupos: 4 }
        ]
    },
    {
        codigo: 'PJ-002',
        nombre: 'Papa Johns La Molina',
        marca: 'Papa Johns',
        marcaId: 'papajohns',
        direccion: 'Av. La Molina 1000',
        distrito: 'La Molina',
        zona: 'Lima Este',
        coordinates: { lat: -12.07294, lng: -76.94582 },
        vacantes: [
            { puesto: 'Atención al Cliente', modalidad: 'Part Time', turno: 'Noche', cupos: 2 }
        ]
    },

    // --- POPEYES ---
    {
        codigo: 'POP-001',
        nombre: 'Popeyes Real Plaza Centro Cívico',
        marca: 'Popeyes',
        marcaId: 'popeyes',
        direccion: 'Av. Garcilaso de la Vega 1337, Lima',
        distrito: 'Lima',
        zona: 'Lima Centro',
        coordinates: { lat: -12.05634, lng: -77.03720 },
        vacantes: [
            { puesto: 'Cocina', modalidad: 'Part Time', turno: 'Apertura', cupos: 3 }
        ]
    },

    // --- CHINAWOK ---
    {
        codigo: 'CW-001',
        nombre: 'Chinawok Mall del Sur',
        marca: 'Chinawok',
        marcaId: 'chinawok',
        direccion: 'Av. Los Lirios 300, SJM',
        distrito: 'San Juan de Miraflores',
        zona: 'Lima Sur',
        coordinates: { lat: -12.15833, lng: -76.98139 },
        vacantes: [
            { puesto: 'Ayudante de Cocina', modalidad: 'Full Time', turno: 'Rotativo', cupos: 5 }
        ]
    },

    // --- DUNKIN ---
    {
        codigo: 'DD-001',
        nombre: 'Dunkin Benavides',
        marca: 'Dunkin',
        marcaId: 'dunkin',
        direccion: 'Av. Alfredo Benavides 4500, Surco',
        distrito: 'Santiago de Surco',
        zona: 'Lima Este',
        coordinates: { lat: -12.12876, lng: -76.99321 },
        vacantes: [
            { puesto: 'Atención al Cliente', modalidad: 'Part Time', turno: 'Mañana', cupos: 2 }
        ]
    },

    // --- DON BELISARIO ---
    {
        codigo: 'DB-001',
        nombre: 'Don Belisario Plaza San Miguel',
        marca: 'Don Belisario',
        marcaId: 'donbelisario',
        direccion: 'Av. La Marina 2000, San Miguel',
        distrito: 'San Miguel',
        zona: 'Lima Norte', // Often grouped with Norte/Callao logic
        coordinates: { lat: -12.07725, lng: -77.08051 },
        vacantes: [
            { puesto: 'Mozo/Azafata', modalidad: 'Full Time', turno: 'Cierre', cupos: 6 }
        ]
    }
];

async function seedDatabase() {
    console.log(`🌱 Seeding database for Tenant: ${TENANT_ID}...`);

    try {
        // Ensure tenant exists (optional usually, but good for structure)
        // await db.collection('tenants').doc(TENANT_ID).set({ name: 'NGR Holding', type: 'holding' }, { merge: true });

        for (const storeData of STORES_DATA) {
            // 1. Create Store
            const storeRef = db.collection('tenants').doc(TENANT_ID).collection('tiendas').doc();

            // Extract vacancies array to separate it from store doc data
            const { vacantes, coordinates, ...storeFields } = storeData;

            // Flatten coordinates for direct indexing if needed, but keeping object structure is fine too
            // Standardizing coord names to what GeolocationService expects if flexible, 
            // but store-matcher.js checks for 'lat' and 'lng' properties directly or 'coordinates' object.
            // My StoreMatcher handles `store.coordinates` object.

            await storeRef.set({
                ...storeFields,
                coordinates: coordinates,
                lat: coordinates.lat, // Redundant but helpful for legacy scripts
                lng: coordinates.lng,
                createdAt: new Date(),
                status: 'active'
            });

            console.log(`✅ Store Created: ${storeData.nombre}`);

            // 2. Create Vacancies for this Store
            if (vacantes && vacantes.length > 0) {
                const vacantesRef = storeRef.collection('vacantes');

                for (const vacante of vacantes) {
                    await vacantesRef.add({
                        ...vacante,
                        estado: 'activo',
                        cuposDisponibles: vacante.cupos,
                        createdAt: new Date(),
                        rqId: `RQ-SEED-${Math.floor(Math.random() * 10000)}` // Mock RQ ID
                    });
                }
                console.log(`   ✨ Added ${vacantes.length} vacancies`);
            }
        }

        console.log('\n🎉 Seeding Completed! The bot is ready to find these locations.');

    } catch (error) {
        console.error('❌ Error Seeding:', error);
    }
}

seedDatabase();

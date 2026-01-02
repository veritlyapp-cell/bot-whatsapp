import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
// Option 1: Use service account JSON file (recommended)
// Option 2: Use environment variables
let credential;

try {
    // Try to load from JSON file first
    const serviceAccountPath = join(__dirname, '../../firebase-service-account.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
    console.log('✅ Firebase initialized with service account JSON file');
} catch (error) {
    // Fallback to environment variables
    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };
    credential = admin.credential.cert(serviceAccount);
    console.log('✅ Firebase initialized with environment variables');
}

admin.initializeApp({ credential });

export const db = admin.firestore();
export const auth = admin.auth();

// Firestore references for multi-tenant architecture
export const collections = {
    // Tenants - top level collection
    tenants: () => db.collection('tenants'),
    tenantConfig: (tenantId) => db.collection('tenants').doc(tenantId),

    // Tiendas - nested under tenant
    tiendas: (tenantId) => db.collection('tenants').doc(tenantId).collection('tiendas'),
    tienda: (tenantId, tiendaId) => db.collection('tenants').doc(tenantId).collection('tiendas').doc(tiendaId),

    // Vacantes - nested under tienda
    vacantes: (tenantId, tiendaId) =>
        db.collection('tenants').doc(tenantId).collection('tiendas').doc(tiendaId).collection('vacantes'),
    vacante: (tenantId, tiendaId, vacanteId) =>
        db.collection('tenants').doc(tenantId).collection('tiendas').doc(tiendaId).collection('vacantes').doc(vacanteId),

    // Postulantes - nested under tenant
    postulantes: (tenantId) => db.collection('tenants').doc(tenantId).collection('postulantes'),
    postulante: (tenantId, postulanteId) =>
        db.collection('tenants').doc(tenantId).collection('postulantes').doc(postulanteId),

    // Users - top level (dashboard users)
    users: () => db.collection('users'),
    user: (userId) => db.collection('users').doc(userId),

    // Conversaciones - top level (shared across tenants for phone uniqueness)
    conversaciones: () => db.collection('conversaciones'),
    conversacion: (phone) => db.collection('conversaciones').doc(phone)
};

export default admin;

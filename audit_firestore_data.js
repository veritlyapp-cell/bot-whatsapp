
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';

// Load env from both possible locations
if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
}
if (fs.existsSync('lia-frontend/.env.local')) {
    dotenv.config({ path: 'lia-frontend/.env.local' });
}

// In root, we might have a service account file or use default credentials
// Since I don't see a service account JSON, I'll check if FIREBASE_CONFIG is set
// or just try to initialize with project ID

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

async function auditData() {
    try {
        console.log("--- AUDIT: RQS ---");
        const rqsSnap = await db.collection('rqs').get();
        console.log("Total RQs:", rqsSnap.size);

        const statuses = {};
        rqsSnap.forEach(doc => {
            const data = doc.data();
            const status = data.status;
            statuses[status] = (statuses[status] || 0) + 1;
            if (status === 'active' || status === 'recruiting') {
                console.log(`- RQ ID: ${doc.id}, Status: ${status}, Position: ${data.posicion}, Tienda: ${data.tiendaNombre}, Brand: ${data.marcaId}, Holding: ${data.holdingId}`);
                if (data.tiendaNombre?.toLowerCase().includes('jockey')) {
                    console.log("  [FOUND JOCKEY] Coords:", data.coords || data.coordenadas || 'MISSING');
                }
            }
        });
        console.log("RQs by status:", statuses);

        console.log("\n--- AUDIT: MARCAS ---");
        const marcasSnap = await db.collection('marcas').get();
        marcasSnap.forEach(doc => {
            console.log(`- Marca ID: ${doc.id}, Nombre: ${doc.data().nombre}, Holding: ${doc.data().holdingId}, Activa: ${doc.data().activa}`);
        });

        console.log("\n--- AUDIT: HOLDINGS ---");
        const holdingsSnap = await db.collection('holdings').get();
        holdingsSnap.forEach(doc => {
            console.log(`- Holding ID: ${doc.id}, Slug: ${doc.data().slug}, Name: ${doc.data().nombre}`);
        });

    } catch (e) {
        console.error("Audit failed:", e);
    }
}

auditData();

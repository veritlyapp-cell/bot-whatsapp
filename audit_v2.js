
import admin from 'firebase-admin';

// Initialize with a dummy project ID if not set, 
// usually it works for public data or if ADC is set.
// But I'll try to get it from .env.local via a quick read
import fs from 'fs';
const env = fs.readFileSync('lia-frontend/.env.local', 'utf8');
const projectId = env.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.*)/)?.[1]?.trim();

const serviceAccount = JSON.parse(fs.readFileSync('firebase-service-account.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function run() {
    try {
        const possibleHoldingIds = ['ngr', 'ngr_holding', 'ngr_papajohns', 'ngr_bembos', 'ngr_popeyes', 'ngr_dunkin', 'ngr_donbelisario', 'ngr_chinawok'];
        const results = { rqs: [], talent_jobs: [] };

        console.log("--- AUDITING RQS (NGR) ---");
        const snap = await db.collection('rqs').get();
        snap.forEach(doc => {
            const d = doc.data();
            const matches = possibleHoldingIds.includes(d.holdingId) ||
                (d.marcaId && possibleHoldingIds.some(id => d.marcaId.toLowerCase().includes(id.split('_')[1] || id)));

            if (matches || (d.tiendaNombre && d.tiendaNombre.toLowerCase().includes('jockey'))) {
                results.rqs.push({ id: doc.id, ...d });
            }
        });

        console.log("\n--- AUDITING TALENT_JOBS (NGR) ---");
        const talentSnap = await db.collection('talent_jobs').get();
        talentSnap.forEach(doc => {
            const d = doc.data();
            const matches = possibleHoldingIds.includes(d.holdingId) ||
                (d.marcaId && possibleHoldingIds.some(id => d.marcaId.toLowerCase().includes(id.split('_')[1] || id)));

            if (matches || (d.tiendaNombre && d.tiendaNombre.toLowerCase().includes('jockey'))) {
                results.talent_jobs.push({ id: doc.id, ...d });
            }
        });

        console.log("\n--- AUDITING MARCAS (NGR) ---");
        const marcasSnap = await db.collection('marcas').get();
        results.marcas = [];
        marcasSnap.forEach(doc => {
            const d = doc.data();
            if (possibleHoldingIds.includes(d.holdingId) || d.nombre.toLowerCase().includes('bembos')) {
                results.marcas.push({ id: doc.id, ...d });
            }
        });

        fs.writeFileSync('audit_results.json', JSON.stringify(results, null, 2));
        console.log("Results saved to audit_results.json");
    } catch (e) {
        console.error(e);
    }
}

run();

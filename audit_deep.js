
import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('firebase-service-account.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function run() {
    try {
        const results = { holdings: [], marcas: [], rqs: [], talent_jobs: [] };

        console.log("--- AUDITING HOLDINGS ---");
        const holdingsSnap = await db.collection('holdings').get();
        holdingsSnap.forEach(doc => {
            results.holdings.push({ id: doc.id, ...doc.data() });
        });

        console.log("--- AUDITING MARCAS ---");
        const marcasSnap = await db.collection('marcas').get();
        marcasSnap.forEach(doc => {
            const d = doc.data();
            if (doc.id.includes('ngr') || (d.holdingId && d.holdingId.includes('ngr')) || (d.nombre && d.nombre.toLowerCase().includes('bembos'))) {
                results.marcas.push({ id: doc.id, ...d });
            }
        });

        console.log("--- AUDITING RQS (Keywords: Jockey/Bembos) ---");
        const rqsSnap = await db.collection('rqs').get();
        rqsSnap.forEach(doc => {
            const d = doc.data();
            const text = JSON.stringify(d).toLowerCase();
            if (text.includes('jockey') || text.includes('bembos') || text.includes('ngr')) {
                results.rqs.push({ id: doc.id, ...d });
            }
        });

        console.log("--- AUDITING NESTED VACANTES (ngr_holding) ---");
        const storesSnap = await db.collection('tenants').doc('ngr_holding').collection('tiendas').get();
        results.nested_vacantes = [];
        for (const storeDoc of storesSnap.docs) {
            const vacSnap = await storeDoc.ref.collection('vacantes').get();
            vacSnap.forEach(vDoc => {
                results.nested_vacantes.push({
                    id: vDoc.id,
                    tiendaId: storeDoc.id,
                    tiendaNombre: storeDoc.data().nombre,
                    ...vDoc.data()
                });
            });
        }
        console.log(`Found ${results.nested_vacantes.length} nested vacantes.`);

        fs.writeFileSync('audit_deep.json', JSON.stringify(results, null, 2));
        console.log("Deep audit saved to audit_deep.json");
    } catch (e) {
        console.error(e);
    }
}

run();

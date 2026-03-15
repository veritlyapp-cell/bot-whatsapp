
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (admin.apps.length === 0) {
    const serviceAccount = JSON.parse(
        readFileSync(join(__dirname, '../../firebase-service-account.json'), 'utf8')
    );
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkHoldings() {
    const snap = await db.collection('holdings').get();
    console.log(`Found ${snap.size} holdings:`);
    snap.forEach(doc => {
        const data = doc.data();
        console.log(`--- HOLDING: ${doc.id} (${data.nombre}) ---`);
        console.log(JSON.stringify(data, null, 2));
    });
}

checkHoldings().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

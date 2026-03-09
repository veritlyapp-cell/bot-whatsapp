
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
        const collections = await db.listCollections();
        console.log("Found top-level collections:", collections.map(c => c.id));

        // Check 'vacantes' top-level just in case
        if (collections.some(c => c.id === 'vacantes')) {
            const snap = await db.collection('vacantes').get();
            console.log(`Found ${snap.size} top-level vacantes`);
        }

    } catch (e) {
        console.error(e);
    }
}

run();

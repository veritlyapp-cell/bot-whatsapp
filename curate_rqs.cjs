
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function curateRQs() {
    console.log('--- Curating RQs for Portal Visibility ---');
    const rqsSnap = await db.collection('rqs').get();
    let count = 0;

    const batch = db.batch();

    rqsSnap.forEach(doc => {
        const data = doc.data();
        let needsUpdate = false;
        const update = {};

        // 1. Ensure holdingId exists if tenantId exists (backward compatibility)
        if (data.tenantId && !data.holdingId) {
            update.holdingId = data.tenantId;
            needsUpdate = true;
        }

        // 2. Ensure tenantId exists if holdingId exists (forward compatibility)
        if (data.holdingId && !data.tenantId) {
            update.tenantId = data.holdingId;
            needsUpdate = true;
        }

        // 3. Normalize status for portal query strings
        // If status is "activo" or "aprobado", encourage "recruiting" or "active"
        if (data.estado === 'aprobado' && data.status === 'active') {
            // This is fine, the portal checks both
        }

        if (needsUpdate) {
            batch.update(doc.ref, update);
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`Updated ${count} RQs with consistent IDs.`);
    } else {
        console.log('All RQs are already consistent.');
    }
}

curateRQs();

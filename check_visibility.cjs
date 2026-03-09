
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkRQsVisibility() {
    console.log('--- Checking RQs for Tambo ---');
    // Check both tenantId and holdingId as they are often used interchangeably in the code
    const rqsSnap = await db.collection('rqs')
        .where('holdingId', '==', 'tambo')
        .get();

    console.log(`Found ${rqsSnap.size} RQs for holdingId: tambo`);

    rqsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}, Puesto: ${data.puesto}, Status: ${data.status}, Estado: ${data.estado || 'MISSING'}, approvalStatus: ${data.approvalStatus}`);
    });

    const rqsSnap2 = await db.collection('rqs')
        .where('tenantId', '==', 'tambo')
        .get();

    console.log(`Found ${rqsSnap2.size} RQs for tenantId: tambo`);
    rqsSnap2.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}, Puesto: ${data.puesto}, Status: ${data.status}, Estado: ${data.estado || 'MISSING'}`);
    });
}

checkRQsVisibility();

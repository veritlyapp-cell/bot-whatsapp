
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanRelatedData() {
    const email = 'oscarqv@outlook.com';
    console.log(`Cleaning related data for: ${email}`);

    // 1. Check separate applications collection
    const appsSnap = await db.collection('applications')
        .where('email', '==', email)
        .get();

    const batch = db.batch();
    appsSnap.forEach(doc => {
        console.log(`Deleting application: ${doc.id}`);
        batch.delete(doc.ref);
    });

    // 2. Check interviews
    const interviewsSnap = await db.collection('interviews')
        .where('candidateEmail', '==', email)
        .get();

    interviewsSnap.forEach(doc => {
        console.log(`Deleting interview: ${doc.id}`);
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log('Cleanup completed.');
}

cleanRelatedData();

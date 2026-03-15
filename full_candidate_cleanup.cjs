
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fullCleanup(email) {
    console.log(`--- FULL CLEANUP FOR: ${email} ---`);
    const batch = db.batch();

    // 1. Candidates
    const candidatesSnap = await db.collection('candidates').where('email', '==', email).get();
    candidatesSnap.forEach(doc => {
        console.log(`Deleting candidate: ${doc.id}`);
        batch.delete(doc.ref);
    });

    // 2. Applications
    const appsSnap = await db.collection('applications').where('email', '==', email).get();
    appsSnap.forEach(doc => {
        console.log(`Deleting application: ${doc.id}`);
        batch.delete(doc.ref);
    });

    // 3. Interviews
    const interviewsSnap = await db.collection('interviews').where('candidateEmail', '==', email).get();
    interviewsSnap.forEach(doc => {
        console.log(`Deleting interview: ${doc.id}`);
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log('Done! All records for this email have been removed.');
}

fullCleanup('oscarqv88@gmail.com');

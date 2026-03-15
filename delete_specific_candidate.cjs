
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function findAndDeleteCandidate() {
    const email = 'oscarqv@outlook.com';
    console.log(`Searching for candidate: ${email}`);

    const candidatesSnap = await db.collection('candidates')
        .where('email', '==', email)
        .get();

    if (candidatesSnap.empty) {
        console.log('Candidate not found.');
        return;
    }

    const batch = db.batch();
    candidatesSnap.forEach(doc => {
        console.log(`Found candidate document ID: ${doc.id}`);
        console.log('Data:', JSON.stringify(doc.data(), null, 2));

        // Deleting the whole candidate record as requested
        batch.delete(doc.ref);
        console.log(`Marked for deletion: ${doc.id}`);
    });

    await batch.commit();
    console.log('Candidate(s) deleted successfully.');
}

findAndDeleteCandidate();

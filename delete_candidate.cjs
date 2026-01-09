const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCandidate() {
    const email = 'oscarqv88@gmail.com';
    console.log(`Searching for candidate with email: ${email}...`);

    const snap = await db.collection('candidates').where('email', '==', email).get();

    if (snap.empty) {
        console.log('Candidate not found');
        return;
    }

    for (const doc of snap.docs) {
        const candidateId = doc.id;
        console.log(`Found candidate: ${candidateId}`);

        // Delete applications associated with this candidate
        const appsSnap = await db.collection('applications').where('candidateId', '==', candidateId).get();
        for (const appDoc of appsSnap.docs) {
            await db.collection('applications').doc(appDoc.id).delete();
            console.log(`Deleted application: ${appDoc.id}`);
        }

        // Delete the candidate document
        await db.collection('candidates').doc(candidateId).delete();
        console.log(`Deleted candidate: ${candidateId}`);
    }
}

deleteCandidate().catch(console.error);

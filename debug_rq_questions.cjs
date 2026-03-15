
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkRQ() {
    const rqId = '1MuTL6HWEWTJj5iAYqW7';
    const doc = await db.collection('rqs').doc(rqId).get();
    if (doc.exists) {
        const data = doc.data();
        console.log('--- RQ Data ---');
        console.log('Puesto:', data.puesto);
        console.log('jobProfileId:', data.jobProfileId);
        console.log('killerQuestions (embedded):', JSON.stringify(data.killerQuestions, null, 2));

        const kqSub = await db.collection('rqs').doc(rqId).collection('killerQuestions').get();
        console.log('killerQuestions (subcollection) count:', kqSub.size);
        kqSub.forEach(d => console.log('KQ:', JSON.stringify(d.data(), null, 2)));

        if (data.jobProfileId) {
            console.log('\n--- Job Profile (jobProfiles) ---');
            const jp1 = await db.collection('jobProfiles').doc(data.jobProfileId).get();
            if (jp1.exists) console.log('Data:', JSON.stringify(jp1.data(), null, 2));
            else console.log('Not found in jobProfiles');

            console.log('\n--- Job Profile (job_profiles) ---');
            const jp2 = await db.collection('job_profiles').doc(data.jobProfileId).get();
            if (jp2.exists) console.log('Data:', JSON.stringify(jp2.data(), null, 2));
            else console.log('Not found in job_profiles');
        }
    }
}

checkRQ();

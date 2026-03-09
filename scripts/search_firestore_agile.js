
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('c:\\Users\\oscar\\Bot_Whatsapp\\firebase-service-account.json', 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function searchCollections() {
    const collections = await db.listCollections();
    for (const collection of collections) {
        console.log(`Searching collection: ${collection.id}`);
        const snapshot = await collection.get();
        snapshot.forEach(doc => {
            const data = JSON.stringify(doc.data());
            if (data.toLowerCase().includes('agile')) {
                console.log(`FOUND IN ${collection.id}/${doc.id}:`, doc.data());
            }
        });
    }
}

searchCollections().catch(console.error);

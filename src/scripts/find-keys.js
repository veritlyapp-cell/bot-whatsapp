
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

async function findKeys() {
    const snap = await db.collection('holdings').get();
    snap.forEach(doc => {
        const d = doc.data();
        const hasResend = !!(d.resendApiKey || d.config?.resend?.apiKey);
        console.log(`Holding ${d.slug}: Has Resend API Key: ${hasResend}`);
        if (hasResend) {
            console.log(`- Found key in ${d.resendApiKey ? 'root' : 'config.resend.apiKey'}`);
        }
    });
}

findKeys().then(() => process.exit(0));

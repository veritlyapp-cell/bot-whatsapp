
import { collections } from '../config/firebase.js';
import Logger from '../utils/logger.js';

async function readCandidate() {
    try {
        const phone = 'test_manual_1';
        const tenant_id = 'ngr'; // Assuming this is where it was stored (fallback)

        console.log(`Reading candidate ${phone} from tenant ${tenant_id}...`);

        const doc = await collections.postulante(tenant_id, phone).get();
        if (!doc.exists) {
            console.log('❌ Candidate not found');
            return;
        }

        const data = doc.data();
        console.log('✅ Candidate Data:');
        console.log(JSON.stringify(data, null, 2));

        if (data.entrevista && data.entrevista.fechaHora) {
            const d = data.entrevista.fechaHora.toDate();
            console.log('📅 Fecha Hora (JS Date):', d.toString());
            console.log('📅 Fecha Hora (ISO):', d.toISOString());

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            console.log('🔍 Checking against Tomorrow:', tomorrow.toString());
        }

    } catch (error) {
        console.error(error);
    }
}

readCandidate();

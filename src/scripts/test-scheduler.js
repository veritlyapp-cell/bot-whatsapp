
import Scheduler from '../services/scheduler.js';
import { collections } from '../config/firebase.js';
import admin from '../config/firebase.js';

async function test() {
    console.log('🧪 Testing Scheduler...');
    const tenantId = 'ngr';
    const candidateId = 'test_manual_1'; // Use a generic ID

    // Create mock candidate first
    try {
        console.log('Creating mock candidate...');
        await collections.postulante(tenantId, candidateId).set({
            id: candidateId,
            nombre: 'Test Scheduler',
            email: 'test@scheduler.com',
            dni: '12345678',
            telefono: candidateId,
            storeSelection: {
                tienda: {
                    id: 'T1',
                    nombre: 'Tienda Test',
                    marcaId: 'marca-test',
                    marca: 'Marca Test'
                }
            }
        });

        console.log('Scheduling interview...');
        const result = await Scheduler.scheduleInterview(tenantId, candidateId, {
            tiendaId: 'T1',
            vacanteId: 'V1',
            fechaHora: new Date().toISOString(),
            direccion: 'Test Addr'
        });

        console.log('✅ Success:', result);

        const updated = await collections.postulante(tenantId, candidateId).get();
        console.log('🔄 Updated Candidate:', JSON.stringify(updated.data(), null, 2));

    } catch (err) {
        console.error('❌ Error in test:', err);
    }
}

test();

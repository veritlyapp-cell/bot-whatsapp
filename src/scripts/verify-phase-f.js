
import { processConfirmationReminders } from '../cron/confirmation-cron.js';
import dotenv from 'dotenv';
dotenv.config();

const phone = '999995555'; // Use the phone from check-interview.js which has an interview tomorrow
const origin = 'ngr-whatsapp';

async function testConfirmationFlow() {
    console.log('=== STARTING PHASE F CONFIRMATION TEST ===');

    // 1. Trigger Cron Job Manually
    console.log('\n🔔 Triggering Cron Job...');
    await processConfirmationReminders();

    // 2. Simulate User Replying "Si"
    console.log(`\n📤 User (${phone}): "Si"`);

    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone,
                message: 'Si',
                origin_id: origin
            })
        });
        const data = await response.json();
        console.log(`🤖 Bot (${data.state}):\n${data.response}`);

        if (data.state === 'completado' || data.response.toLowerCase().includes('confirmado')) {
            console.log('✅ Confirmation Successful!');
        } else {
            console.log('❌ Confirmation logic likely failed. State:', data.state);
        }

    } catch (e) {
        console.error('❌ Error sending message:', e);
    }

    console.log('=== TEST COMPLETE ===');
}

testConfirmationFlow();

/**
 * Check Interview Flow
 * Verifies flow from Screening -> Interview Scheduling
 */

async function testInterview() {
    const phone = '999995561'; // New phone to avoid state issues
    const origin = 'ngr-whatsapp';

    const send = async (msg) => {
        try {
            console.log(`\n📤 User: "${msg}"`);
            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone,
                    message: msg,
                    origin_id: origin
                })
            });
            const data = await response.json();
            console.log(`🤖 Bot (${data.state}):\n${data.response}`);
            return data;
        } catch (e) {
            console.error('❌ Error:', e.cause || e.message);
        }
    };

    console.log('=== STARTING INTERVIEW TEST ===');

    // 0. Onboarding
    await send('Hola');
    await send('Si');
    await send('Maria Gonzales');
    await send('25');
    await send('87654321');
    await send('maria@test.com');
    await send('Si'); // Turnos
    await send('Si'); // Cierres

    // 1. Location & Stores
    await send('Miraflores');
    await send('1'); // Select store

    // 2. Vacancy & Screening
    await send('1'); // Select vacancy
    await send('Si'); // Exp

    // 3. Interview Scheduling
    // Bot should offer slots (mocked in gemini-chatbot.js)
    // "1. Mañana 10:00 AM" ...

    // Select Slot 1
    const resSchedule = await send('1');

    if (resSchedule.state === 'confirmado' || resSchedule.response.includes('agendada')) {
        console.log('✅ Interview scheduled successfully!');
    } else {
        console.log('❌ Failed to schedule interview.');
    }

    console.log('=== TEST COMPLETE ===');
}

testInterview();

/**
 * Check Screening Flow
 * Verifies flow from Location -> Store -> Vacancy -> Screening
 */

async function testScreening() {
    const phone = '999993333';
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

    console.log('=== STARTING SCREENING TEST ===');

    // Fast forward to location
    await send('Hola');
    await send('Si');
    await send('Pedro Ramirez');
    await send('22');
    await send('87654321');
    const resEmail = await send('pedro@test.com');
    await send('Si'); // Turnos
    const res = await send('Si'); // Cierres

    // Check if we reached location_input
    if (res.state !== 'location_input' && !res.response.includes('ubicación')) {
        console.log('⚠️ Warning: Might not be in location input yet. Current state:', res.state);
    }

    // 1. Send Location
    await send('Miraflores');

    // 2. Select Store (1)
    await send('1');

    // 3. Select Vacancy (1)
    await send('1');

    // 4. Screening Q1
    await send('Si');

    // 5. Screening Q2
    await send('Si');

    console.log('=== TEST COMPLETE ===');
}

testScreening();

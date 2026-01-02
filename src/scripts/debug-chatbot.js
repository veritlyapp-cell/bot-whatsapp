
import GeminiChatbot from '../ai/gemini-chatbot.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        console.log('--- Debugging GeminiChatbot ---');
        const bot = new GeminiChatbot();
        console.log('Bot initialized.');

        // Simulate "Hola" message
        console.log('Processing "Hola"...');
        const res = await bot.processMessage('99999DEBUG', 'Hola', 'ngr-whatsapp', 'ngr');
        console.log('Result:', res);

        // Simulate "Miraflores" (Location)
        console.log('Processing "Miraflores"...');
        const res2 = await bot.processMessage('99999DEBUG', 'Miraflores', 'ngr-whatsapp', 'ngr');
        console.log('Result 2:', res2);

        // Simulate "1" (Store Selection)
        console.log('Processing "1"...');
        const res3 = await bot.processMessage('99999DEBUG', '1', 'ngr-whatsapp', 'ngr');
        console.log('Result 3:', res3);

    } catch (error) {
        console.error('CRASH:', error);
    }
}

run();

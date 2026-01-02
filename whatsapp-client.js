/**
 * WhatsApp Web Client
 * Connects WhatsApp to the recruitment bot via whatsapp-web.js
 * 
 * Usage: node whatsapp-client.js
 * Then scan the QR code with your WhatsApp
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

// Configuration
const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3000/api/chat';
const ORIGIN_ID = process.env.ORIGIN_ID || 'ngr-whatsapp';

// Create WhatsApp client with local authentication (saves session)
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Display QR code for authentication
client.on('qr', (qr) => {
    console.clear();
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    qrcode.generate(qr, { small: true });
    console.log('');
    console.log('📱 Abre WhatsApp en tu teléfono');
    console.log('   → Ve a Configuración > Dispositivos vinculados');
    console.log('   → Toca "Vincular un dispositivo"');
    console.log('   → Escanea el código QR');
    console.log('');
});

// Client is ready
client.on('ready', () => {
    console.clear();
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ WHATSAPP CONECTADO EXITOSAMENTE            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('🤖 Bot de reclutamiento activo');
    console.log('📱 Envía un mensaje a este número desde cualquier WhatsApp');
    console.log('');
    console.log('💡 Para probar:');
    console.log('   1. Abre WhatsApp en OTRO teléfono o usa WhatsApp Web');
    console.log('   2. Envía "Hola" a este número');
    console.log('   3. El bot responderá automáticamente');
    console.log('');
    console.log('⏳ Esperando mensajes...');
    console.log('─'.repeat(60));
});

// Handle incoming messages
client.on('message', async (message) => {
    // Ignore group messages and status updates
    if (message.isGroupMsg || message.isStatus) {
        return;
    }

    const phone = message.from.replace('@c.us', '');
    const text = message.body;

    console.log(`\n📩 [${new Date().toLocaleTimeString()}] Mensaje de ${phone}: "${text}"`);

    try {
        // Send message to bot API
        const response = await fetch(BOT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: phone,
                message: text,
                origin_id: ORIGIN_ID
            })
        });

        const data = await response.json();

        if (data.success && data.response) {
            // Send bot response back to WhatsApp
            await message.reply(data.response);
            console.log(`🤖 [${new Date().toLocaleTimeString()}] Respuesta enviada: "${data.response.substring(0, 50)}..."`);
            console.log(`   Estado: ${data.state}`);
        } else {
            console.error('❌ Error en respuesta del bot:', data);
            await message.reply('Lo siento, tuve un problema técnico. ¿Podrías intentar de nuevo?');
        }

    } catch (error) {
        console.error('❌ Error al procesar mensaje:', error.message);
        await message.reply('Lo siento, el servicio no está disponible en este momento.');
    }
});

// Handle authentication failure
client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
});

// Handle disconnection
client.on('disconnected', (reason) => {
    console.log('🔴 WhatsApp desconectado:', reason);
    console.log('   Reinicia el script para reconectar');
});

// Initialize client
console.log('🔄 Iniciando cliente de WhatsApp...');
console.log('   Esto puede tomar unos segundos...');
client.initialize();

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

async function checkConfig() {
    console.log('🔍 Iniciando Diagnóstico de WhatsApp Business API...');
    console.log('--------------------------------------------------');

    if (!TOKEN || !PHONE_ID) {
        console.error('❌ ERROR: Faltan variables de entorno (WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID)');
        process.exit(1);
    }

    console.log(`✅ Token detectado (Prefijo: ${TOKEN.substring(0, 15)}...)`);
    console.log(`✅ Phone ID detectado: ${PHONE_ID}`);

    try {
        // 1. Verificar el Token y el ID de Teléfono
        console.log('\n📡 Verificando conexión con Meta...');
        const verifyUrl = `https://graph.facebook.com/v21.0/${PHONE_ID}`;
        const response = await fetch(verifyUrl, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ ERROR DE META:', data.error?.message || 'Error desconocido');
            console.error('Código de Error:', data.error?.code);
            console.error('Subcode:', data.error?.error_subcode);

            if (data.error?.code === 190) {
                console.log('💡 TIP: El token parece haber expirado o es inválido.');
            } else if (data.error?.code === 100) {
                console.log('💡 TIP: El Phone Number ID podría ser incorrecto.');
            }
        } else {
            console.log('✅ Conexión con Meta establecida!');
            console.log(`📱 Nombre mostrado: ${data.verified_name || 'No disponible'}`);
            console.log(`🏷️ Calidad: ${data.quality_rating || 'N/A'}`);
            console.log(`📦 Status: ${data.status || 'N/A'}`);
        }

        // 2. Intento de envío de mensaje de prueba (Hello World)
        console.log('\n📧 Intentando enviar mensaje de prueba a un número de test...');
        const testPhone = '51956833456'; // Número de Oscar para prueba
        const sendUrl = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;

        const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: testPhone,
                type: 'template',
                template: {
                    name: 'hello_world',
                    language: { code: 'en_US' }
                }
            })
        });

        const sendData = await sendResponse.json();

        if (!sendResponse.ok) {
            console.error('❌ FALLO EL ENVÍO DE PRUEBA:', sendData.error?.message);
            if (sendData.error?.error_subcode === 133010) {
                console.log('🚨 DIAGNÓSTICO: Cuenta no registrada (#133010).');
                console.log('   ESTO CONFIRMA que el Phone ID no está vinculado correctamente');
                console.log('   al WABA o no ha sido verificado en el Business Manager.');
            }
        } else {
            console.log('🚀 ¡MENSAJE DE PRUEBA ENVIADO CON ÉXITO!');
            console.log('ID Mensaje:', sendData.messages[0].id);
        }

    } catch (error) {
        console.error('❌ ERROR CRÍTICO DE RED:', error.message);
    }

    console.log('\n--------------------------------------------------');
    console.log('🏁 Diagnóstico finalizado.');
}

checkConfig();

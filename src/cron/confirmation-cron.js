/**
 * Confirmation Cron Job
 * Sends automated confirmation reminders 24h before interviews
 */

import cron from 'node-cron';
import Scheduler from '../services/scheduler.js';
import Logger from '../utils/logger.js';

import ConversationManager, { CONVERSATION_STATES } from '../ai/conversation-manager.js';

// ... other imports

/**
 * Send confirmation reminder to a candidate
 * @param {Object} candidate - Candidate with interview scheduled
 */
async function sendConfirmationReminder(candidate) {
    try {
        const { nombre, telefono, entrevista } = candidate;
        const fechaHora = entrevista.fechaHora?.toDate?.() || entrevista.fechaHora;

        // Format date and time
        const fecha = fechaHora.toLocaleDateString('es-PE');
        const hora = fechaHora.toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const message = `
¡Hola ${nombre}! 👋

Este es un recordatorio de tu entrevista programada para mañana:

📅 Fecha: ${fecha}
⏰ Hora: ${hora}
📍 Dirección: ${entrevista.direccion}

Por favor, confirma tu asistencia respondiendo "SÍ".
Si necesitas reprogramar, responde "REPROGRAMAR".

¡Te esperamos!
NGR - Grupo Intercorp
        `.trim();

        Logger.info(`📧 Sending reminder to ${telefono}:`, { nombre, fecha, hora });

        // In production, this would send via WhatsApp Business API
        // For MVP, we just log it
        if (process.env.WHATSAPP_SIMULATOR_ENABLED === 'true') {
            Logger.success(`📱 SIMULATED WhatsApp message to ${telefono}:`);
            console.log(message);
            console.log('');
        }

        // Update conversation context so bot knows to expect confirmation
        // Assuming tenant_id is available in candidate object or we can infer/pass it
        await ConversationManager.updateState(telefono, CONVERSATION_STATES.CONFIRMACION_PENDIENTE);

        return { success: true, telefono, message };

    } catch (error) {
        Logger.error(`❌ Error sending reminder to ${candidate.telefono}:`, error);
        return { success: false, telefono: candidate.telefono, error: error.message };
    }
}

/**
 * Process all confirmation reminders
 */
async function processConfirmationReminders() {
    try {
        Logger.info('🔔 Starting confirmation reminder job...');

        const candidates = await Scheduler.getCandidatesForTomorrowReminder();

        if (candidates.length === 0) {
            Logger.info('✅ No interviews scheduled for tomorrow');
            return;
        }

        Logger.info(`📋 Processing ${candidates.length} reminder(s)...`);

        const results = [];
        for (const candidate of candidates) {
            const result = await sendConfirmationReminder(candidate);
            results.push(result);

            // Add delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        Logger.success(`✅ Confirmation job completed: ${successful} sent, ${failed} failed`);

    } catch (error) {
        Logger.error('❌ Error in confirmation reminder job:', error);
    }
}

/**
 * Initialize cron job
 */
export function startConfirmationCron() {
    const hour = process.env.CONFIRMATION_CRON_HOUR || '8';
    const minute = process.env.CONFIRMATION_CRON_MINUTE || '0';

    // Cron expression: minute hour * * *
    const cronExpression = `${minute} ${hour} * * *`;

    Logger.info(`⏰ Scheduling confirmation cron job: ${cronExpression} (${hour}:${minute} daily)`);

    cron.schedule(cronExpression, async () => {
        Logger.info('⏰ Cron triggered: Confirmation reminders');
        await processConfirmationReminders();
    });

    Logger.success('✅ Confirmation cron job scheduled');
}

// For manual testing
export { processConfirmationReminders };

/**
 * WhatsApp Simulator - Multi-Tenant Version
 * Interactive CLI tool to test chatbot with origin_id support
 */

import readline from 'readline';
import GeminiChatbot from '../ai/gemini-chatbot.js';
import TenantService from '../services/tenant-service.js';
import Logger from '../utils/logger.js';

class WhatsAppSimulator {
    constructor() {
        this.chatbot = new GeminiChatbot();
        this.currentPhone = null;
        this.currentOriginId = null;
        this.currentTenantId = null;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async start() {
        console.clear();
        Logger.success('╔════════════════════════════════════════════════╗');
        Logger.success('║   WhatsApp Bot Simulator - Multi-Tenant      ║');
        Logger.success('╚════════════════════════════════════════════════╝');
        console.log('');

        await this.selectTenant();
    }

    async selectTenant() {
        try {
            // Get all active tenants
            const tenants = await TenantService.getAllTenants();

            console.log('📋 Tenants disponibles:\n');
            tenants.forEach((tenant, index) => {
                console.log(`   ${index + 1}. ${tenant.nombre} (${tenant.tenant_id})`);
                console.log(`      Origin ID: ${tenant.webhook_origin}`);
                console.log('');
            });

            this.rl.question('Selecciona un tenant (número): ', async (answer) => {
                const index = parseInt(answer) - 1;

                if (index >= 0 && index < tenants.length) {
                    const selectedTenant = tenants[index];
                    this.currentOriginId = selectedTenant.webhook_origin;
                    this.currentTenantId = selectedTenant.tenant_id;

                    console.clear();
                    Logger.success(`✅ Tenant seleccionado: ${selectedTenant.nombre}`);
                    Logger.info(`   Tenant ID: ${this.currentTenantId}`);
                    Logger.info(`   Origin ID: ${this.currentOriginId}`);
                    console.log('');

                    await this.getPhoneNumber();
                } else {
                    Logger.error('❌ Selección inválida');
                    process.exit(1);
                }
            });

        } catch (error) {
            Logger.error('❌ Error loading tenants:', error);
            process.exit(1);
        }
    }

    async getPhoneNumber() {
        this.rl.question('📱 Ingresa número de teléfono (ej: 987654321): ', async (phone) => {
            this.currentPhone = phone.trim();

            if (this.currentPhone.length !== 9 || !this.currentPhone.startsWith('9')) {
                Logger.warn('⚠️  Formato incorrecto, pero continuando...');
            }

            console.clear();
            Logger.success('╔════════════════════════════════════════════════╗');
            Logger.info(`║  Tenant: ${this.currentTenantId.padEnd(40)}║`);
            Logger.info(`║  Phone:  ${this.currentPhone.padEnd(40)}║`);
            Logger.success('╚════════════════════════════════════════════════╝');
            console.log('');
            Logger.info('💬 Conversación iniciada. Escribe "salir" para terminar.\n');

            await this.chat();
        });
    }

    async chat() {
        this.rl.question('👤 Tú: ', async (input) => {
            const message = input.trim();

            if (message.toLowerCase() === 'salir') {
                Logger.info('\n👋 ¡Hasta luego!');
                this.rl.close();
                process.exit(0);
                return;
            }

            if (!message) {
                await this.chat();
                return;
            }

            try {
                Logger.info(`⏳ Procesando mensaje...`);

                // Process message with origin_id and tenant_id
                const result = await this.chatbot.processMessage(
                    this.currentPhone,
                    message,
                    this.currentOriginId,
                    this.currentTenantId
                );

                console.log('');
                Logger.success('🤖 BOT:');
                console.log(result.response);
                console.log('');
                Logger.info(`📊 Estado: ${result.newState}`);

                if (result.actions && result.actions.length > 0) {
                    Logger.info(`⚙️  Acciones: ${result.actions.map(a => a.type).join(', ')}`);
                }

                console.log('');

            } catch (error) {
                Logger.error('\n❌ Error:', error.message);
                console.log('');
            }

            // Continue conversation
            await this.chat();
        });
    }
}

// Run simulator
const simulator = new WhatsAppSimulator();
simulator.start();

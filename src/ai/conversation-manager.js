/**
 * Conversation Manager (Multi-Tenant)
 * Manages conversation state and history in Firestore with tenant isolation
 */

import { collections } from '../config/firebase.js';
import Logger from '../utils/logger.js';

// Conversation states
export const CONVERSATION_STATES = {
    INICIO: 'inicio',
    TERMS: 'terms_acceptance',           // NEW: T&C acceptance
    DATOS_BASICOS: 'datos_basicos',
    HARD_FILTERS: 'hard_filters',         // NEW: Turnos/Cierres
    SALARY_EXPECTATION: 'salary_expectation', // NEW: Salary expectation check
    VALIDACION: 'validacion',
    LOCATION_INPUT: 'location_input',     // NEW: GPS or address
    TIENDAS: 'tiendas_sugeridas',
    SELECCION_VACANTE: 'seleccion_vacante',
    SCREENING: 'screening',               // NEW: RAG interview
    ENTREVISTA: 'programacion_entrevista',
    CONFIRMACION_PENDIENTE: 'confirmacion_pendiente', // NEW: Waiting for confirmation cron response
    CONFIRMADO: 'confirmado',
    COMPLETADO: 'completado',
    RECHAZADO: 'rechazado',               // NEW: Didn't pass filters
    ERROR: 'error'
};

class ConversationManager {
    /**
     * Get or create conversation for a phone number with tenant context
     * @param {string} phone - Phone number
     * @param {string} tenant_id - Tenant ID from origin_id mapping
     * @param {string} origin_id - Origin ID from webhook
     * @returns {Promise<Object>} - Conversation data
     */
    static async getOrCreateConversation(phone, tenant_id, origin_id) {
        try {
            const conversationRef = collections.conversacion(phone);
            const conversationDoc = await conversationRef.get();

            if (conversationDoc.exists) {
                const existingData = conversationDoc.data();

                // If conversation exists but tenant changed, reset it
                if (existingData.tenant_id !== tenant_id) {
                    Logger.warn(`⚠️ Tenant changed for ${phone}: ${existingData.tenant_id} → ${tenant_id}`);
                    await this.resetConversation(phone, tenant_id, origin_id);
                    return await this.getOrCreateConversation(phone, tenant_id, origin_id);
                }

                Logger.info(`📱 Retrieved existing conversation for ${phone} (${tenant_id})`);
                return {
                    id: conversationDoc.id,
                    ...existingData
                };
            }

            // Create new conversation
            const newConversation = {
                phone,
                tenant_id,
                origin_id,
                estado: CONVERSATION_STATES.INICIO,
                mensajes: [],
                candidateData: {},
                createdAt: new Date(),
                updatedAt: new Date(),
                activo: true
            };

            await conversationRef.set(newConversation);
            Logger.success(`✅ Created new conversation for ${phone} (${tenant_id})`);

            return {
                id: phone,
                ...newConversation
            };

        } catch (error) {
            Logger.error('❌ Error getting/creating conversation:', error);
            throw error;
        }
    }

    /**
     * Add message to conversation history
     * @param {string} phone - Phone number
     * @param {string} role - 'user' or 'assistant'
     * @param {string} content - Message content
     * @returns {Promise<void>}
     */
    static async addMessage(phone, role, content) {
        try {
            const conversationRef = collections.conversacion(phone);
            const conversationDoc = await conversationRef.get();

            if (!conversationDoc.exists) {
                Logger.warn(`⚠️ Conversation not found for ${phone}`);
                return;
            }

            const message = {
                role,
                content,
                timestamp: new Date()
            };

            await conversationRef.update({
                mensajes: [...(conversationDoc.data().mensajes || []), message],
                updatedAt: new Date()
            });

            Logger.info(`💬 Added ${role} message to conversation ${phone}`);

        } catch (error) {
            Logger.error('❌ Error adding message:', error);
            throw error;
        }
    }

    /**
     * Update conversation state
     * @param {string} phone - Phone number
     * @param {string} newState - New conversation state
     * @param {Object} additionalData - Additional data to update
     * @returns {Promise<void>}
     */
    static async updateState(phone, newState, additionalData = {}) {
        try {
            const conversationRef = collections.conversacion(phone);

            await conversationRef.update({
                estado: newState,
                ...additionalData,
                updatedAt: new Date()
            });

            Logger.info(`🔄 Updated conversation state to: ${newState} for ${phone}`);

        } catch (error) {
            Logger.error('❌ Error updating conversation state:', error);
            throw error;
        }
    }

    /**
     * Update candidate data in conversation
     * @param {string} phone - Phone number
     * @param {Object} candidateData - Candidate data to merge
     * @returns {Promise<void>}
     */
    static async updateCandidateData(phone, candidateData) {
        try {
            const conversationRef = collections.conversacion(phone);
            const conversationDoc = await conversationRef.get();

            const existingData = conversationDoc.exists
                ? conversationDoc.data().candidateData || {}
                : {};

            await conversationRef.update({
                candidateData: {
                    ...existingData,
                    ...candidateData
                },
                updatedAt: new Date()
            });

            Logger.info(`📝 Updated candidate data for ${phone}`, candidateData);

        } catch (error) {
            Logger.error('❌ Error updating candidate data:', error);
            throw error;
        }
    }

    /**
     * Get conversation history messages for AI context
     * @param {string} phone - Phone number
     * @param {number} limit - Maximum number of messages to retrieve
     * @returns {Promise<Array>} - Array of messages
     */
    static async getConversationHistory(phone, limit = 20) {
        try {
            const conversationRef = collections.conversacion(phone);
            const conversationDoc = await conversationRef.get();

            if (!conversationDoc.exists) {
                return [];
            }

            const mensajes = conversationDoc.data().mensajes || [];

            // Return last N messages
            return mensajes.slice(-limit);

        } catch (error) {
            Logger.error('❌ Error getting conversation history:', error);
            throw error;
        }
    }

    /**
     * Mark conversation as completed
     * @param {string} phone - Phone number
     * @returns {Promise<void>}
     */
    static async completeConversation(phone) {
        try {
            const conversationRef = collections.conversacion(phone);

            await conversationRef.update({
                estado: CONVERSATION_STATES.COMPLETADO,
                activo: false,
                completedAt: new Date(),
                updatedAt: new Date()
            });

            Logger.success(`✅ Conversation completed for ${phone}`);

        } catch (error) {
            Logger.error('❌ Error completing conversation:', error);
            throw error;
        }
    }

    /**
     * Reset conversation (start over)
     * @param {string} phone - Phone number
     * @param {string} tenant_id - Tenant ID
     * @param {string} origin_id - Origin ID
     * @returns {Promise<void>}
     */
    static async resetConversation(phone, tenant_id, origin_id) {
        try {
            const conversationRef = collections.conversacion(phone);

            await conversationRef.set({
                phone,
                tenant_id,
                origin_id,
                estado: CONVERSATION_STATES.INICIO,
                mensajes: [],
                candidateData: {},
                activo: true,
                resetAt: new Date(),
                updatedAt: new Date()
            }, { merge: true });

            Logger.info(`🔄 Conversation reset for ${phone} (${tenant_id})`);

        } catch (error) {
            Logger.error('❌ Error resetting conversation:', error);
            throw error;
        }
    }
}

export default ConversationManager;

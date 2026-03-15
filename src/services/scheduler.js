/**
 * Interview Scheduler Service
 * Manages interview scheduling, confirmation, and rescheduling (Multi-Tenant)
 */

import admin, { collections, db } from '../config/firebase.js';
import Logger from '../utils/logger.js';
import CalendarService from './calendar-service.js';
import { FieldValue } from 'firebase-admin/firestore';

class Scheduler {
    /**
     * Generate available time slots for interviews
     * @param {Date} startDate - Start date for scheduling
     * @param {number} daysAhead - Number of days to generate slots for
     * @returns {Array} - Array of available time slots
     */
    /**
     * Generate available time slots for interviews based on store configuration
     * @param {string} storeId - Store ID to get availability for
     * @param {Date} startDate - Start date for scheduling
     * @param {number} daysAhead - Number of days to generate slots for
     * @returns {Promise<Array>} - Array of available time slots
     */
    static async generateTimeSlots(storeId, startDate = new Date(), daysAhead = 7) {
        const slots = [];
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        try {
            let availability = null;
            if (storeId) {
                const storeDoc = await db.collection('tiendas').doc(storeId).get();
                if (storeDoc.exists) {
                    availability = storeDoc.data().availability;
                    Logger.info(`🕒 Using custom availability for store: ${storeId}`);
                }
            }

            const DAYS_OF_WEEK = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

            for (let day = 1; day <= daysAhead; day++) {
                const currentDate = new Date(start);
                currentDate.setDate(start.getDate() + day);
                const dayName = DAYS_OF_WEEK[currentDate.getDay()];

                // Get configuration for this day
                let dayEnabled = true;
                let dayRanges = [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '17:00' }]; // Defaults
                let interval = 30; // 30 mins default

                if (availability) {
                    interval = availability.slotInterval || 30;
                    if (availability.daysConfig && availability.daysConfig[dayName]) {
                        dayEnabled = availability.daysConfig[dayName].enabled;
                        dayRanges = availability.daysConfig[dayName].ranges || [];
                    } else if (availability.days) {
                        // Legacy support
                        dayEnabled = availability.days.includes(dayName);
                        dayRanges = dayEnabled ? [{ start: availability.startHour || '09:00', end: availability.endHour || '17:00' }] : [];
                    }
                } else if (dayName === 'domingo') {
                    dayEnabled = false; // Default: Sundays off
                }

                if (!dayEnabled || dayRanges.length === 0) continue;

                // For each range, generate slots
                for (const range of dayRanges) {
                    const [startH, startM] = range.start.split(':').map(Number);
                    const [endH, endM] = range.end.split(':').map(Number);

                    let currentTime = new Date(currentDate);
                    currentTime.setHours(startH, startM, 0, 0);

                    const endTime = new Date(currentDate);
                    endTime.setHours(endH, endM, 0, 0);

                    while (currentTime < endTime) {
                        slots.push({
                            date: new Date(currentTime),
                            display: this.formatSlotDisplay(currentTime)
                        });
                        // Move to next slot based on interval
                        currentTime.setMinutes(currentTime.getMinutes() + interval);
                    }
                }
            }

            // Filter by Calendar availability (Mock or Real)
            const calendarId = 'seleccion@ngr.com.pe';
            return await CalendarService.filterAvailableSlots(calendarId, slots);

        } catch (error) {
            Logger.error('❌ Error generating time slots:', error);
            // Fallback to basic slots if something fails
            return [];
        }
    }

    /**
     * Format time slot for display
     * @param {Date} date - Slot date/time
     * @returns {string} - Formatted display string
     */
    static formatSlotDisplay(date) {
        // Ensure date is a Date object
        const d = new Date(date);
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        const dayName = days[d.getDay()];
        const day = d.getDate();
        const month = months[d.getMonth()];
        const hour = d.getHours();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour;

        return `${dayName} ${day} ${month} - ${displayHour}:00 ${ampm}`;
    }

    /**
     * Schedule an interview for a candidate
     * @param {string} tenant_id - Tenant ID
     * @param {string} candidateId - Candidate ID
     * @param {Object} interviewData - { tiendaId, vacanteId, fechaHora, direccion }
     * @returns {Promise<Object>} - Scheduled interview data
     */
    static async scheduleInterview(tenant_id, candidateId, interviewData) {
        try {
            const { tiendaId, vacanteId, fechaHora, direccion } = interviewData;

            Logger.info('📅 Scheduling interview', { candidateId, tiendaId, fechaHora });

            // Get candidate data
            const candidateRef = collections.postulante(tenant_id, candidateId);
            const candidateDoc = await candidateRef.get();

            if (!candidateDoc.exists) {
                throw new Error('Candidate not found');
            }

            const candidateData = candidateDoc.data();

            // Extract Store Details from selection (saved during chat)
            let storeDetails = candidateData.storeSelection?.tienda;

            // Fallback if not found (unexpected, as selection is required)
            if (!storeDetails) {
                Logger.warn(`⚠️ No store selection found for candidate ${candidateId}. Using fallback.`);
                storeDetails = {
                    id: interviewData.tiendaId,
                    nombre: 'Tienda ' + interviewData.tiendaId,
                    marcaId: 'marca-unknown',
                    marca: 'NGR'
                };
            }

            // Create Calendar Event
            const calendarId = 'seleccion@ngr.com.pe';
            const startTime = new Date(fechaHora);
            const endTime = new Date(startTime);
            endTime.setHours(startTime.getHours() + 1);

            const eventData = {
                summary: `Entrevista: ${candidateData.nombre || 'Candidato'} - ${candidateData.selectedVacancy?.puesto || 'Puesto'}`,
                description: `Candidato: ${candidateData.nombre}\nDNI: ${candidateData.dni}\nTeléfono: ${candidateDoc.id}\nTienda: ${interviewData.tiendaNombre || tiendaId}`,
                start: { dateTime: startTime.toISOString() },
                end: { dateTime: endTime.toISOString() },
                attendees: [
                    { email: candidateData.email || 'candidato@test.com' }
                ]
            };

            const calendarEvent = await CalendarService.createEvent(calendarId, eventData);

            // Update candidate with interview details
            // Construct Application object for Dashboard Visibility
            const application = {
                id: `app_${Date.now()}`,
                tiendaId: storeDetails.id,
                tiendaNombre: storeDetails.nombre,
                marcaId: storeDetails.marcaId || 'marca-ngr',
                marcaNombre: storeDetails.marca || 'NGR',
                posicion: candidateData.selectedVacancy?.puesto || 'Puesto Generico',
                modalidad: candidateData.selectedVacancy?.modalidad || 'Part Time',
                turno: candidateData.selectedVacancy?.tipoTurno || 'Rotativo',
                status: 'interview_scheduled',
                appliedAt: new Date(),
                source: 'bot_whatsapp'
            };

            const appUnion = FieldValue.arrayUnion(application);
            console.log('DEBUG: FieldValue.arrayUnion result:', appUnion);

            // Update candidate with interview details AND application
            await candidateRef.update({
                entrevista: {
                    tiendaId,
                    vacanteId,
                    fechaHora: startTime,
                    direccion,
                    calendarEventId: calendarEvent.id,
                    calendarLink: calendarEvent.htmlLink,
                    estado: 'programada',
                    confirmada: false,
                    programadaAt: new Date()
                },
                estado: 'entrevista_programada',
                applications: FieldValue.arrayUnion(application),
                updatedAt: new Date()
            });

            Logger.success('✅ Interview scheduled successfully');

            return {
                candidateId,
                fechaHora: startTime,
                direccion,
                estado: 'programada',
                calendarLink: calendarEvent.htmlLink
            };

        } catch (error) {
            Logger.error('❌ Error scheduling interview:', error);
            throw error;
        }
    }

    /**
     * Confirm interview attendance
     * @param {string} tenant_id - Tenant ID
     * @param {string} candidateId - Candidate ID
     * @returns {Promise<boolean>}
     */
    static async confirmInterview(tenant_id, candidateId) {
        try {
            const candidateRef = collections.postulante(tenant_id, candidateId);

            await candidateRef.update({
                'entrevista.confirmada': true,
                'entrevista.confirmadaAt': new Date(),
                estado: 'entrevista_confirmada',
                updatedAt: new Date()
            });

            Logger.success(`✅ Interview confirmed for candidate: ${candidateId}`);
            return true;

        } catch (error) {
            Logger.error('❌ Error confirming interview:', error);
            throw error;
        }
    }

    /**
     * Reschedule an interview
     * @param {string} tenant_id - Tenant ID
     * @param {string} candidateId - Candidate ID
     * @param {Date} newDateTime - New interview date/time
     * @returns {Promise<Object>}
     */
    static async rescheduleInterview(tenant_id, candidateId, newDateTime) {
        try {
            const candidateRef = collections.postulante(tenant_id, candidateId);
            const candidateDoc = await candidateRef.get();

            if (!candidateDoc.exists) {
                throw new Error('Candidate not found');
            }

            const candidateData = candidateDoc.data();

            await candidateRef.update({
                'entrevista.fechaHora': new Date(newDateTime),
                'entrevista.reprogramada': true,
                'entrevista.reprogramadaAt': new Date(),
                'entrevista.confirmada': false,
                estado: 'entrevista_programada',
                updatedAt: new Date()
            });

            Logger.success(`✅ Interview rescheduled for candidate: ${candidateId}`);

            return {
                candidateId,
                fechaHora: new Date(newDateTime),
                direccion: candidateData.entrevista.direccion
            };

        } catch (error) {
            Logger.error('❌ Error rescheduling interview:', error);
            throw error;
        }
    }

    /**
     * Get candidates with interviews scheduled for tomorrow (for confirmation reminders)
     * @param {string} tenant_id - Tenant ID (optional, if null get all tenants)
     * @returns {Promise<Array>} - Array of candidates with tomorrow's interviews
     */
    static async getCandidatesForTomorrowReminder(tenant_id = null) {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

            const candidates = [];

            // If tenant_id specified, query that tenant only
            if (tenant_id) {
                const snapshot = await collections.postulantes(tenant_id)
                    .where('estado', 'in', ['entrevista_programada', 'entrevista_confirmada'])
                    .get();

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const interviewDate = data.entrevista?.fechaHora?.toDate();

                    if (interviewDate && interviewDate >= tomorrow && interviewDate < dayAfterTomorrow) {
                        candidates.push({
                            id: doc.id,
                            tenant_id,
                            ...data
                        });
                    }
                });
            } else {
                // Query all tenants
                const tenantsSnapshot = await collections.tenants().get();

                for (const tenantDoc of tenantsSnapshot.docs) {
                    const snapshot = await collections.postulantes(tenantDoc.id)
                        .where('estado', 'in', ['entrevista_programada', 'entrevista_confirmada'])
                        .get();

                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        const interviewDate = data.entrevista?.fechaHora?.toDate();

                        if (interviewDate && interviewDate >= tomorrow && interviewDate < dayAfterTomorrow) {
                            candidates.push({
                                id: doc.id,
                                tenant_id: tenantDoc.id,
                                ...data
                            });
                        }
                    });
                }
            }

            Logger.info(`📋 Found ${candidates.length} interviews scheduled for tomorrow`);
            return candidates;

        } catch (error) {
            Logger.error('❌ Error getting tomorrow\'s interviews:', error);
            throw error;
        }
    }
}

export default Scheduler;

/**
 * Calendar Service (Google Calendar Integration)
 * Manages event creation and availability checking.
 * Currently uses MOCK implementation if credentials are not available.
 */

import Logger from '../utils/logger.js';

class CalendarService {
    constructor() {
        this.useMock = process.env.USE_MOCK_AI === 'true';
    }

    /**
     * List events for a specific time range
     * @param {string} calendarId - Calendar ID (usually email)
     * @param {Date} timeMin - Start time
     * @param {Date} timeMax - End time
     * @returns {Promise<Array>} - List of events
     */
    static async listEvents(calendarId, timeMin, timeMax) {
        try {
            // Real implementation would use googleapis here
            // const calendar = google.calendar({ version: 'v3', auth });
            // ...

            // Mock Implementation
            Logger.info(`📅 [MOCK CALENDAR] Listing events for ${calendarId} between ${timeMin} and ${timeMax}`);

            // Return some fake busy slots for testing overlap
            // e.g. Busy tomorrow at 10 AM
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(10, 0, 0, 0);

            const eventEnd = new Date(tomorrow);
            eventEnd.setHours(11, 0, 0, 0);

            return [
                {
                    summary: 'Reunión de Equipo',
                    start: { dateTime: tomorrow.toISOString() },
                    end: { dateTime: eventEnd.toISOString() }
                }
            ];

        } catch (error) {
            Logger.error('❌ Error listing calendar events:', error);
            return [];
        }
    }

    /**
     * Create an event in the calendar
     * @param {string} calendarId - Calendar ID
     * @param {Object} eventDetails - { summary, description, start, end, attendees }
     * @returns {Promise<Object>} - Created event
     */
    static async createEvent(calendarId, eventDetails) {
        try {
            const { summary, description, start, end, attendees } = eventDetails;

            Logger.info(`📅 [MOCK CALENDAR] Creating event in ${calendarId}:`, { summary, start, end });

            // Mock response
            return {
                id: 'mock_event_' + Date.now(),
                status: 'confirmed',
                htmlLink: 'https://calendar.google.com/mock-link',
                ...eventDetails
            };

        } catch (error) {
            Logger.error('❌ Error creating calendar event:', error);
            throw error;
        }
    }

    /**
     * Check availability (get free slots intersecting with desired slots)
     * @param {string} calendarId - Calendar ID
     * @param {Array} potentialSlots - Array of { date: Date } objects
     * @returns {Promise<Array>} - Filtered available slots
     */
    static async filterAvailableSlots(calendarId, potentialSlots) {
        // Simplified check: Assume mostly free except the hardcoded mock event
        const busyEvents = await this.listEvents(calendarId, new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

        return potentialSlots.filter(slot => {
            const slotStart = new Date(slot.date);
            const slotEnd = new Date(slotStart);
            slotEnd.setHours(slotStart.getHours() + 1); // Assume 1 hour slots

            // Check collision
            const hasCollision = busyEvents.some(event => {
                const eventStart = new Date(event.start.dateTime);
                const eventEnd = new Date(event.end.dateTime);
                return (slotStart < eventEnd && slotEnd > eventStart);
            });

            return !hasCollision;
        });
    }
}

export default CalendarService;

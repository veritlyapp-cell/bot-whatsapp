/**
 * Candidate Validation Service
 * Validates candidate eligibility based on business rules
 */

import Logger from '../utils/logger.js';

class CandidateValidator {
    /**
     * Validate DNI format (Peruvian ID)
     * @param {string} dni - DNI number
     * @returns {Object} - { valid: boolean, message: string }
     */
    static validateDNI(dni) {
        if (!dni) {
            return { valid: false, message: 'DNI es requerido' };
        }

        // Remove any spaces or special characters
        const cleanDNI = dni.toString().replace(/\D/g, '');

        if (cleanDNI.length !== 8) {
            return { valid: false, message: 'DNI debe tener 8 dígitos' };
        }

        if (!/^\d{8}$/.test(cleanDNI)) {
            return { valid: false, message: 'DNI debe contener solo números' };
        }

        return { valid: true, dni: cleanDNI };
    }

    /**
     * Validate age eligibility
     * @param {string|Date} birthDate - Birth date
     * @returns {Object} - { valid: boolean, age: number, message: string }
     */
    static validateAge(birthDate) {
        if (!birthDate) {
            return { valid: false, message: 'Fecha de nacimiento es requerida' };
        }

        const birth = new Date(birthDate);
        const today = new Date();

        if (isNaN(birth.getTime())) {
            return { valid: false, message: 'Fecha de nacimiento inválida' };
        }

        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }

        if (age < 18) {
            return { valid: false, age, message: 'Debes ser mayor de 18 años' };
        }

        if (age > 60) {
            return { valid: false, age, message: 'La edad máxima para postular es 60 años' };
        }

        return { valid: true, age };
    }

    /**
     * Validate shift availability
     * @param {string} availability - Candidate's shift preference
     * @param {string} requiredShift - Vacancy's required shift
     * @returns {Object} - { valid: boolean, message: string }
     */
    static validateShiftAvailability(availability, requiredShift) {
        if (!availability) {
            return { valid: false, message: 'Disponibilidad de turno es requerida' };
        }

        const validShifts = ['rotativos', 'cierres', 'mixto'];
        const normalizedAvailability = availability.toLowerCase().trim();
        const normalizedRequired = requiredShift.toLowerCase().trim();

        if (!validShifts.includes(normalizedAvailability)) {
            return {
                valid: false,
                message: `Disponibilidad debe ser: ${validShifts.join(', ')}`
            };
        }

        // If vacancy requires rotativos and candidate can do rotativos or mixto, it's valid
        // If vacancy requires cierres and candidate can do cierres or mixto, it's valid
        // If vacancy requires mixto, candidate can have any availability

        if (normalizedRequired === 'mixto') {
            return { valid: true };
        }

        if (normalizedRequired === normalizedAvailability || normalizedAvailability === 'mixto') {
            return { valid: true };
        }

        return {
            valid: false,
            message: `Esta vacante requiere disponibilidad para turnos ${requiredShift}`
        };
    }

    /**
     * Validate phone number
     * @param {string} phone - Phone number
     * @returns {Object} - { valid: boolean, phone: string, message: string }
     */
    static validatePhone(phone) {
        if (!phone) {
            return { valid: false, message: 'Teléfono es requerido' };
        }

        // Clean phone number
        const cleanPhone = phone.toString().replace(/\D/g, '');

        // Peruvian mobile numbers are 9 digits starting with 9
        if (cleanPhone.length !== 9) {
            return { valid: false, message: 'Teléfono debe tener 9 dígitos' };
        }

        if (!cleanPhone.startsWith('9')) {
            return { valid: false, message: 'Teléfono móvil debe empezar con 9' };
        }

        return { valid: true, phone: cleanPhone };
    }

    /**
     * Validate full name
     * @param {string} name - Full name
     * @returns {Object} - { valid: boolean, message: string }
     */
    static validateName(name) {
        if (!name) {
            return { valid: false, message: 'Nombre completo es requerido' };
        }

        const trimmedName = name.trim();

        if (trimmedName.length < 3) {
            return { valid: false, message: 'Nombre debe tener al menos 3 caracteres' };
        }

        // Check if name has at least two words (first name and last name)
        const nameParts = trimmedName.split(/\s+/);
        if (nameParts.length < 2) {
            return { valid: false, message: 'Debes ingresar nombre y apellido' };
        }

        // Check if name contains only letters, spaces, and common Spanish characters
        if (!/^[a-zA-ZáéíóúñÑÁÉÍÓÚ\s]+$/.test(trimmedName)) {
            return { valid: false, message: 'Nombre debe contener solo letras' };
        }

        return { valid: true, name: trimmedName };
    }

    /**
     * Validate all candidate data
     * @param {Object} candidateData - All candidate data
     * @param {string} tenant_id - Tenant ID for isolated validation
     * @returns {Object} - { valid: boolean, errors: Array, data: Object }
     */
    static validateCandidate(candidateData, tenant_id) {
        const errors = [];
        const validatedData = { tenant_id };

        // Validate name
        const nameResult = this.validateName(candidateData.nombre);
        if (!nameResult.valid) {
            errors.push(nameResult.message);
        } else {
            validatedData.nombre = nameResult.name;
        }

        // Validate DNI
        const dniResult = this.validateDNI(candidateData.dni);
        if (!dniResult.valid) {
            errors.push(dniResult.message);
        } else {
            validatedData.dni = dniResult.dni;
        }

        // Validate phone
        const phoneResult = this.validatePhone(candidateData.telefono);
        if (!phoneResult.valid) {
            errors.push(phoneResult.message);
        } else {
            validatedData.telefono = phoneResult.phone;
        }

        // Validate age
        const ageResult = this.validateAge(candidateData.fechaNacimiento);
        if (!ageResult.valid) {
            errors.push(ageResult.message);
        } else {
            validatedData.edad = ageResult.age;
            validatedData.fechaNacimiento = new Date(candidateData.fechaNacimiento);
        }

        // Add other validated fields
        if (candidateData.distrito) {
            validatedData.distrito = candidateData.distrito.trim();
        }

        if (candidateData.disponibilidad) {
            validatedData.disponibilidad = candidateData.disponibilidad.toLowerCase().trim();
        }

        const isValid = errors.length === 0;

        if (isValid) {
            Logger.info(`✅ Candidate validation passed (${tenant_id})`, validatedData);
        } else {
            Logger.warn(`⚠️ Candidate validation failed (${tenant_id})`, { errors });
        }

        return {
            valid: isValid,
            errors,
            data: isValid ? validatedData : null
        };
    }
}

export default CandidateValidator;

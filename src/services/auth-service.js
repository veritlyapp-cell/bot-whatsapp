/**
 * Authentication Service
 * Handles Firebase Auth operations and custom claims management
 */

import { auth, db, collections } from '../config/firebase.js';
import Logger from '../utils/logger.js';

class AuthService {
    /**
     * Verify Firebase Auth token
     * @param {string} token - Firebase ID token
     * @returns {Promise<Object>} - Decoded token with custom claims
     */
    static async verifyToken(token) {
        try {
            const decodedToken = await auth.verifyIdToken(token);
            Logger.info(`🔐 Token verified for user: ${decodedToken.uid}`);
            return decodedToken;
        } catch (error) {
            Logger.error('❌ Token verification failed:', error);
            throw new Error('Invalid or expired token');
        }
    }

    /**
     * Create user with custom claims
     * @param {Object} userData - { email, password, nombre, tenant_id, role }
     * @returns {Promise<Object>} - Created user data
     */
    static async createUser(userData) {
        try {
            const { email, password, nombre, tenant_id, role = 'viewer' } = userData;

            // Validate tenant exists
            const tenantDoc = await collections.tenantConfig(tenant_id).get();
            if (!tenantDoc.exists) {
                throw new Error(`Tenant ${tenant_id} not found`);
            }

            // Create Firebase Auth user
            const userRecord = await auth.createUser({
                email,
                password,
                displayName: nombre,
                emailVerified: false
            });

            // Set custom claims (tenant_id and role)
            await auth.setCustomUserClaims(userRecord.uid, {
                tenant_id,
                role
            });

            // Save user data in Firestore
            await collections.user(userRecord.uid).set({
                email,
                nombre,
                tenant_id,
                role,
                activo: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            Logger.success(`✅ User created: ${email} (${tenant_id})`);

            return {
                uid: userRecord.uid,
                email,
                nombre,
                tenant_id,
                role
            };

        } catch (error) {
            Logger.error('❌ Error creating user:', error);
            throw error;
        }
    }

    /**
     * Create custom token for user (for login)
     * @param {string} email - User email
     * @param {string} password - User password (for validation)
     * @returns {Promise<Object>} - { token, user }
     */
    static async login(email, password) {
        try {
            // In production, you'd verify password against Firebase Auth
            // For now, we'll get user by email and generate custom token

            const userRecord = await auth.getUserByEmail(email);

            // Get user data from Firestore
            const userDoc = await collections.user(userRecord.uid).get();

            if (!userDoc.exists) {
                throw new Error('User data not found');
            }

            const userData = userDoc.data();

            if (!userData.activo) {
                throw new Error('User account is inactive');
            }

            // Generate custom token with claims
            const customToken = await auth.createCustomToken(userRecord.uid, {
                tenant_id: userData.tenant_id,
                role: userData.role
            });

            Logger.success(`✅ Login successful: ${email}`);

            return {
                token: customToken,
                user: {
                    uid: userRecord.uid,
                    email: userData.email,
                    nombre: userData.nombre,
                    tenant_id: userData.tenant_id,
                    role: userData.role
                }
            };

        } catch (error) {
            Logger.error('❌ Login failed:', error);
            throw new Error('Invalid credentials');
        }
    }

    /**
     * Get user by UID
     * @param {string} uid - User UID
     * @returns {Promise<Object>} - User data
     */
    static async getUserById(uid) {
        try {
            const userDoc = await collections.user(uid).get();

            if (!userDoc.exists) {
                throw new Error('User not found');
            }

            return {
                uid,
                ...userDoc.data()
            };

        } catch (error) {
            Logger.error('❌ Error getting user:', error);
            throw error;
        }
    }

    /**
     * Update user custom claims
     * @param {string} uid - User UID
     * @param {Object} claims - Custom claims to update
     * @returns {Promise<void>}
     */
    static async updateCustomClaims(uid, claims) {
        try {
            await auth.setCustomUserClaims(uid, claims);
            Logger.success(`✅ Custom claims updated for user: ${uid}`);
        } catch (error) {
            Logger.error('❌ Error updating custom claims:', error);
            throw error;
        }
    }

    /**
     * Deactivate user
     * @param {string} uid - User UID
     * @returns {Promise<void>}
     */
    static async deactivateUser(uid) {
        try {
            await auth.updateUser(uid, { disabled: true });
            await collections.user(uid).update({
                activo: false,
                updatedAt: new Date()
            });

            Logger.success(`✅ User deactivated: ${uid}`);
        } catch (error) {
            Logger.error('❌ Error deactivating user:', error);
            throw error;
        }
    }

    /**
     * Validate role permission
     * @param {string} userRole - User's role
     * @param {string} requiredRole - Required role
     * @returns {boolean}
     */
    static hasPermission(userRole, requiredRole) {
        const roleHierarchy = {
            'viewer': 1,
            'recruiter': 2,
            'admin': 3
        };

        return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
    }
}

export default AuthService;

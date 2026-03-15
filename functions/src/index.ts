/**
 * Cloud Functions for LIAH - Recruitment Platform
 * 
 * This file contains scheduled functions for:
 * - Daily RQ alert checking (configurable days without filling)
 * - Email notifications to recruiters
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';

// Define secret for Resend API
const resendApiKey = defineSecret('RESEND_API_KEY');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

/**
 * Scheduled function that runs daily at 8:00 AM (Lima time)
 * Checks for RQs that have been in recruiting status for X+ days (configurable per holding)
 * and sends alert emails to assigned recruiters
 */
export const checkUnfilledRQs = functions
    .runWith({
        timeoutSeconds: 300,
        memory: '256MB',
        secrets: [resendApiKey]
    })
    .pubsub
    .schedule('0 8 * * *')  // Every day at 8:00 AM
    .timeZone('America/Lima')
    .onRun(async (context) => {
        console.log('🔔 [ALERT] Starting daily RQ unfilled check...');

        const now = new Date();

        try {
            // Get all holdings with their alert settings
            const holdingsSnapshot = await db.collection('holdings').get();

            for (const holdingDoc of holdingsSnapshot.docs) {
                const holdingData = holdingDoc.data();
                const holdingId = holdingDoc.id;

                // Check if alerts are enabled for this holding
                if (holdingData.rqAlertsEnabled === false) {
                    console.log(`[ALERT] Alerts disabled for holding: ${holdingId}`);
                    continue;
                }

                // Get configurable days (default 7)
                const alertDays = holdingData.rqAlertDays || 7;
                const emailEnabled = holdingData.rqEmailNotifications !== false;
                const alertThreshold = new Date(now.getTime() - alertDays * 24 * 60 * 60 * 1000);

                console.log(`[ALERT] Processing holding ${holdingId} with ${alertDays} days threshold`);

                // Query RQs for this holding that are active and approved
                const rqsSnapshot = await db
                    .collection('rqs')
                    .where('holdingId', '==', holdingId)
                    .where('status', '==', 'active')
                    .where('approvalStatus', '==', 'approved')
                    .get();

                console.log(`[ALERT] Found ${rqsSnapshot.size} active RQs for ${holdingId}`);

                const unfilledRQs: any[] = [];
                const batch = db.batch();

                for (const doc of rqsSnapshot.docs) {
                    const rq = doc.data();

                    // Check if RQ has been recruiting for X+ days
                    const recruitmentStartedAt = rq.recruitment_started_at?.toDate()
                        || rq.approvedAt?.toDate()
                        || rq.createdAt?.toDate();

                    if (recruitmentStartedAt && recruitmentStartedAt <= alertThreshold) {
                        // Mark as unfilled if not already
                        if (!rq.alert_unfilled) {
                            batch.update(doc.ref, {
                                alert_unfilled: true,
                                alert_unfilled_at: admin.firestore.Timestamp.now(),
                                alert_days_threshold: alertDays
                            });
                        }

                        unfilledRQs.push({
                            id: doc.id,
                            rqNumber: rq.rqNumber,
                            posicion: rq.posicion,
                            tiendaNombre: rq.tiendaNombre,
                            marcaNombre: rq.marcaNombre,
                            marcaId: rq.marcaId,
                            daysOpen: Math.floor((now.getTime() - recruitmentStartedAt.getTime()) / (1000 * 60 * 60 * 24))
                        });
                    }
                }

                // Commit batch updates
                if (unfilledRQs.length > 0) {
                    await batch.commit();
                    console.log(`[ALERT] Marked ${unfilledRQs.length} RQs as unfilled for ${holdingId}`);
                }

                // Send emails if enabled
                if (emailEnabled && unfilledRQs.length > 0) {
                    // Group RQs by marca for targeted notifications
                    const rqsByMarca = unfilledRQs.reduce((acc: any, rq) => {
                        if (!acc[rq.marcaId]) {
                            acc[rq.marcaId] = {
                                marcaNombre: rq.marcaNombre,
                                rqs: []
                            };
                        }
                        acc[rq.marcaId].rqs.push(rq);
                        return acc;
                    }, {});

                    // Get recruiters for each marca and send notifications
                    for (const [marcaId, data] of Object.entries(rqsByMarca as Record<string, any>)) {
                        // Find recruiters assigned to this marca
                        const recruitersSnapshot = await db
                            .collection('userAssignments')
                            .where('holdingId', '==', holdingId)
                            .where('role', '==', 'recruiter')
                            .where('active', '==', true)
                            .get();

                        // Filter recruiters assigned to this specific marca
                        const assignedRecruiters = recruitersSnapshot.docs
                            .map(d => d.data())
                            .filter((r: any) =>
                                r.assignedMarcas?.some((m: any) => m.marcaId === marcaId) ||
                                r.marcaId === marcaId
                            );

                        for (const recruiter of assignedRecruiters) {
                            await sendAlertEmail(
                                recruiter.email,
                                recruiter.displayName,
                                data.marcaNombre,
                                data.rqs,
                                alertDays,
                                resendApiKey.value()
                            );
                        }
                    }
                }

                console.log(`🔔 [ALERT] Completed check for ${holdingId}. ${unfilledRQs.length} RQs with ${alertDays}+ days unfilled.`);
            }

            return null;

        } catch (error) {
            console.error('[ALERT] Error in daily RQ check:', error);
            throw error;
        }
    });

/**
 * Send alert email to recruiter about unfilled RQs
 */
async function sendAlertEmail(
    recruiterEmail: string,
    recruiterName: string,
    marcaNombre: string,
    rqs: any[],
    alertDays: number,
    apiKey: string
): Promise<void> {
    if (!apiKey) {
        console.log(`📧 [MOCK ALERT EMAIL] To: ${recruiterEmail}`);
        console.log(`RQs: ${rqs.map(r => r.rqNumber).join(', ')}`);
        return;
    }

    // Dynamically import Resend to avoid initialization issues
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const rqsList = rqs.map(rq => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${rq.rqNumber || 'N/A'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${rq.posicion}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${rq.tiendaNombre}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #dc2626; font-weight: bold;">
                ${rq.daysOpen} días
            </td>
        </tr>
    `).join('');

    try {
        await resend.emails.send({
            from: 'LIAH Alertas <alertas@notifications.getliah.com>',
            to: recruiterEmail,
            subject: `🚨 ALERTA: ${rqs.length} posición(es) sin cubrir por más de ${alertDays} días - ${marcaNombre}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #dc2626, #f97316); padding: 20px; border-radius: 12px 12px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 20px;">
                            🚨 Alerta de RQs sin Cubrir
                        </h1>
                    </div>
                    
                    <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-top: none;">
                        <p style="color: #333; font-size: 16px;">
                            Hola <strong>${recruiterName || 'Recruiter'}</strong>,
                        </p>
                        
                        <p style="color: #333; font-size: 16px;">
                            Las siguientes posiciones de <strong>${marcaNombre}</strong> llevan más de <strong>${alertDays} días sin cubrirse</strong>:
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <thead>
                                <tr style="background: #f3f4f6;">
                                    <th style="padding: 12px; text-align: left; font-size: 14px;">RQ</th>
                                    <th style="padding: 12px; text-align: left; font-size: 14px;">Posición</th>
                                    <th style="padding: 12px; text-align: left; font-size: 14px;">Tienda</th>
                                    <th style="padding: 12px; text-align: left; font-size: 14px;">Días</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rqsList}
                            </tbody>
                        </table>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://liah.app/recruiter" 
                               style="background: linear-gradient(135deg, #7c3aed, #06b6d4); 
                                      color: white; 
                                      padding: 15px 30px; 
                                      text-decoration: none; 
                                      border-radius: 10px; 
                                      font-weight: bold;
                                      display: inline-block;">
                                Ver Dashboard de Reclutamiento
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px;">
                            Por favor, revisa estas posiciones y toma las acciones necesarias para acelerar el proceso de reclutamiento.
                        </p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 0 0 12px 12px;">
                        <p style="color: #999; font-size: 12px; margin: 0;">
                            Este es un mensaje automático de LIAH - Sistema de Alertas<br/>
                            © ${new Date().getFullYear()} LIAH
                        </p>
                    </div>
                </div>
            `
        });

        console.log(`✅ Alert email sent to: ${recruiterEmail}`);
    } catch (error) {
        console.error(`❌ Failed to send alert email to ${recruiterEmail}:`, error);
    }
}

/**
 * HTTP endpoint to manually trigger the unfilled RQ check
 * Useful for testing or manual intervention
 */
export const triggerUnfilledCheck = functions
    .runWith({ secrets: [resendApiKey] })
    .https.onRequest(async (req, res) => {
        // Simple auth check - in production, use proper authentication
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        try {
            const holdingId = req.query.holdingId as string;

            // Get holding settings
            let alertDays = 7;
            if (holdingId) {
                const holdingDoc = await db.collection('holdings').doc(holdingId).get();
                if (holdingDoc.exists) {
                    alertDays = holdingDoc.data()?.rqAlertDays || 7;
                }
            }

            const alertThreshold = new Date(Date.now() - alertDays * 24 * 60 * 60 * 1000);

            let rqsQuery = db
                .collection('rqs')
                .where('status', '==', 'active')
                .where('approvalStatus', '==', 'approved');

            if (holdingId) {
                rqsQuery = rqsQuery.where('holdingId', '==', holdingId) as any;
            }

            const rqsSnapshot = await rqsQuery.get();

            let unfilledCount = 0;

            for (const doc of rqsSnapshot.docs) {
                const rq = doc.data();
                const recruitmentStartedAt = rq.recruitment_started_at?.toDate()
                    || rq.approvedAt?.toDate()
                    || rq.createdAt?.toDate();

                if (recruitmentStartedAt && recruitmentStartedAt <= alertThreshold) {
                    unfilledCount++;
                }
            }

            res.json({
                success: true,
                holdingId: holdingId || 'all',
                alertDays,
                totalActiveRQs: rqsSnapshot.size,
                unfilledRQs: unfilledCount,
                message: `Found ${unfilledCount} RQs with ${alertDays}+ days unfilled`
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

/**
 * Helper to send FCM Push Notification to a specific user
 */
async function sendPushNotification(userId: string, title: string, body: string, url: string = '/') {
    try {
        // Get user's push token
        const tokenDoc = await db.collection('push_tokens').doc(userId).get();
        if (!tokenDoc.exists) {
            console.log(`[PUSH] No token found for user: ${userId}`);
            return;
        }

        const { token, active } = tokenDoc.data() || {};
        if (!token || active === false) return;

        const message = {
            notification: {
                title,
                body
            },
            data: {
                url,
                click_action: url
            },
            token: token
        };

        const response = await admin.messaging().send(message);
        console.log(`[PUSH] Sent successfully to ${userId}:`, response);
    } catch (error) {
        console.error(`[PUSH] Error sending to ${userId}:`, error);
    }
}

/**
 * Trigger: When a new notification is created in Firestore, send a Push Notification
 */
export const onNotificationCreated = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        // Try to find the user by email to get their ID for the token lookup
        // Use userAssignments collection to find the userId
        const userSnapshot = await db.collection('userAssignments')
            .where('email', '==', data.recipientEmail)
            .limit(1)
            .get();

        if (userSnapshot.empty) {
            console.log(`[PUSH] User not found for email: ${data.recipientEmail}`);
            return;
        }

        const userId = userSnapshot.docs[0].id;
        const url = data.data?.link || '/';

        await sendPushNotification(userId, data.title, data.message, url);
    });

/**
 * Trigger: Inform Supervisor when a new RQ is created in their store
 */
export const onRQCreatedNotifySupervisor = functions.firestore
    .document('rqs/{rqId}')
    .onCreate(async (snapshot) => {
        const rq = snapshot.data();
        if (!rq) return;

        const holdingId = rq.holdingId;
        const tiendaId = rq.tiendaId;

        // Find supervisors for this store
        const supervisorsSnapshot = await db.collection('userAssignments')
            .where('holdingId', '==', holdingId)
            .where('role', '==', 'supervisor')
            .where('active', '==', true)
            .get();

        const storeSupervisors = supervisorsSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((s: any) => s.assignedStores?.some((t: any) => t.tiendaId === tiendaId));

        for (const supervisor of storeSupervisors) {
            await sendPushNotification(
                supervisor.id,
                '🆕 Nuevo RQ Pendiente',
                `Se ha creado un nuevo RQ #${rq.rqNumber || ''} para ${rq.posicion} en ${rq.tiendaNombre}. Requiere tu aprobación.`,
                '/supervisor'
            );
        }
    });

/**
 * Trigger: Notify relevant roles when RQ status changes
 */
export const onRQStatusChange = functions.firestore
    .document('rqs/{rqId}')
    .onUpdate(async (change) => {
        const before = change.before.data();
        const after = change.after.data();

        if (!before || !after) return;

        // 1. Notify Jefe de Marca when Supervisor approves
        if (before.approvalStatus === 'pending' && after.approvalStatus === 'approved' && !after.finalApproval) {
            const jefesSnapshot = await db.collection('userAssignments')
                .where('holdingId', '==', after.holdingId)
                .where('role', '==', 'jefe_marca')
                .where('active', '==', true)
                .get();

            // Filter for the specific brand
            const brandJefes = jefesSnapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter((j: any) => j.assignedMarca?.marcaId === after.marcaId || j.marcaId === after.marcaId);

            for (const jefe of brandJefes) {
                await sendPushNotification(
                    jefe.id,
                    '⚡ RQ Pendiente de Firma',
                    `El RQ #${after.rqNumber} ha sido aprobado por el supervisor y requiere tu validación final.`,
                    '/jefe-marca'
                );
            }
        }

        // 2. Notify Creator and Recruiters when final approval is given
        if (!before.finalApproval && after.finalApproval) {
            // Notify Creator (if email exists)
            if (after.createdByEmail) {
                const creatorSnapshot = await db.collection('userAssignments')
                    .where('email', '==', after.createdByEmail)
                    .limit(1)
                    .get();

                if (!creatorSnapshot.empty) {
                    await sendPushNotification(
                        creatorSnapshot.docs[0].id,
                        '🎊 RQ Aprobado Final',
                        `Tu RQ #${after.rqNumber} para ${after.posicion} ha sido aprobado completamente y ya está en reclutamiento.`,
                        '/supervisor'
                    );
                }
            }

            // Notify Recruiters
            const recruitersSnapshot = await db.collection('userAssignments')
                .where('holdingId', '==', after.holdingId)
                .where('role', 'in', ['recruiter', 'brand_recruiter'])
                .where('active', '==', true)
                .get();

            const brandRecruiters = recruitersSnapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter((r: any) =>
                    r.assignedMarcas?.some((m: any) => m.marcaId === after.marcaId) ||
                    r.marcaId === after.marcaId
                );

            for (const recruiter of brandRecruiters) {
                await sendPushNotification(
                    recruiter.id,
                    '🎯 Nuevo RQ para Reclutar',
                    `Se ha liberado el RQ #${after.rqNumber} (${after.posicion}) para ${after.marcaNombre}.`,
                    '/recruiter'
                );
            }
        }

        // 3. Notify Creator when rejected
        if (before.approvalStatus !== 'rejected' && after.approvalStatus === 'rejected') {
            if (after.createdByEmail) {
                const creatorSnapshot = await db.collection('userAssignments')
                    .where('email', '==', after.createdByEmail)
                    .limit(1)
                    .get();

                if (!creatorSnapshot.empty) {
                    await sendPushNotification(
                        creatorSnapshot.docs[0].id,
                        '❌ RQ Rechazado',
                        `El RQ #${after.rqNumber} ha sido rechazado. Motivo: ${after.rejectionReason || 'No especificado'}`,
                        '/supervisor'
                    );
                }
            }
        }
    });

/**
 * Trigger: Notify Recruiters when a new application is received
 */
export const onNewApplicationNotifyRecruiters = functions.firestore
    .document('applications/{appId}')
    .onCreate(async (snapshot) => {
        const app = snapshot.data();
        if (!app) return;

        const { holdingId, marcaId, candidateName, jobTitle } = app;

        // Find recruiters for this brand
        const recruitersSnapshot = await db.collection('userAssignments')
            .where('holdingId', '==', holdingId)
            .where('role', 'in', ['recruiter', 'brand_recruiter'])
            .where('active', '==', true)
            .get();

        const brandRecruiters = recruitersSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((r: any) =>
                r.assignedMarcas?.some((m: any) => m.marcaId === marcaId) ||
                r.marcaId === marcaId
            );

        for (const recruiter of brandRecruiters) {
            await sendPushNotification(
                recruiter.id,
                '📩 Nueva Postulación',
                `${candidateName} se ha postulado para ${jobTitle}.`,
                `/recruiter?candidate=${app.candidateId}`
            );
        }
    });


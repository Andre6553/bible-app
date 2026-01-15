import { supabase } from '../config/supabaseClient';
import emailjs from '@emailjs/browser';

/**
 * EMAILJS CONFIGURATION
 * Provide your keys from the EmailJS dashboard here:
 */
const EMAILJS_SERVICE_ID = "service_l839cpe"; // e.g., "service_xxxx"
const EMAILJS_TEMPLATE_ID = "template_qnwbobo"; // e.g., "template_xxxx"
const EMAILJS_PUBLIC_KEY = "bdiN24ztnf0riZdjb"; // Found in Account -> Public Key

/**
 * Email Service - Handles administrative and user notifications.
 * NOTE: This service is structured to be used with a provider like EmailJS, Resend, or a custom backend.
 * Currently, it logs to console and remains ready for API key injection.
 */

const ADMIN_EMAIL = 'andre.ecprint@gmail.com';

/**
 * Check if a specific email notification is enabled in app_settings
 */
const isEmailEnabled = async (key) => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .single();

        if (error) return false;
        return data.value === 'true';
    } catch (err) {
        return false;
    }
};

/**
 * Helper to fetch a string setting from app_settings
 */
const getSetting = async (key, defaultValue = '') => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .single();

        if (error) return defaultValue;
        return data.value || defaultValue;
    } catch (err) {
        return defaultValue;
    }
};

/**
 * Send a professional welcome email to a new user.
 */
export const sendWelcomeEmail = async (userEmail, force = false) => {
    if (!userEmail) return;

    if (!force) {
        const enabled = await isEmailEnabled('user_welcome_email_enabled');
        if (!enabled) {
            console.log('[EmailService] Welcome email is disabled in settings.');
            return;
        }
    }

    const subject = "Welcome to Omni Bible - Your Spiritual Journey Starts Here";

    // Fetch template from DB or use fallback
    const fallbackBody = `
Dear New Member,

Welcome to Omni Bible! We are thrilled to have you join our community. Omni Bible is designed to be more than just a reader; it's a comprehensive tool to help you dive deeper into God's Word every day.

Here are some of the powerful features you can now explore:
• Read across 8+ versions (including AFR53, AFR83, KJV, NLT, and more).
• Parallel Reading: Compare versions side-by-side for deeper understanding.
• Personal Studies: Create Inductive Bible Studies and Word Studies with AI assistance.
• Highlights & Notes: Color-code your favorite verses and keep personal journals.
• Daily Inspiration: Get fresh, AI-generated devotionals tailored to your interests.
• Fully Responsive: Access your studies seamlessly on both PC and mobile.

We hope Omni Bible becomes a valuable companion in your walk of faith. If you have any questions or feedback, feel free to reach out.

Blessings,
The Omni Bible Team
    `.trim();

    const body = await getSetting('email_template_welcome_body', fallbackBody);

    console.log(`[EmailService] 📧 SENDING WELCOME EMAIL TO: ${userEmail}`);
    console.log(`Subject: ${subject}\n\n${body}`);

    // REAL DELIVERY via EmailJS
    if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
        try {
            await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_ID,
                {
                    email: userEmail,
                    subject: subject,
                    message: body,
                    to_name: "Valued Member"
                },
                EMAILJS_PUBLIC_KEY
            );
            console.log(`[EmailService] ✅ Success! Welcome email delivered to ${userEmail}`);
        } catch (error) {
            console.error(`[EmailService] ❌ Failed to deliver via EmailJS:`, error);
        }
    } else {
        console.warn('[EmailService] ⚠️ Skipping real delivery: EmailJS keys are missing.');
    }
};

/**
 * Notify the admin about a new user joining.
 */
export const notifyAdminOfNewUser = async (userId, userEmail = null, force = false) => {
    if (!force) {
        const enabled = await isEmailEnabled('admin_new_user_email_enabled');
        if (!enabled) {
            console.log('[EmailService] Admin notification is disabled in settings.');
            return;
        }
    }

    const subject = "New Membership Alert: Omni Bible";

    // Fetch template from DB or use fallback
    const fallbackBody = `
Hello Andre,

A new user has just joined Omni Bible!

Details:
• User ID: {{userId}}
• Email: {{userEmail}}
• Time: {{time}}

You can view more details and user analytics on the Stats Dashboard.

Best regards,
Omni Bible System
    `.trim();

    let body = await getSetting('email_template_admin_body', fallbackBody);

    // Replace placeholders
    body = body
        .replace('{{userId}}', userId)
        .replace('{{userEmail}}', userEmail || 'Anonymous Guest')
        .replace('{{time}}', new Date().toLocaleString());

    console.log(`[EmailService] 🔔 NOTIFYING ADMIN: ${ADMIN_EMAIL}`);
    console.log(`Subject: ${subject}\n\n${body}`);

    // REAL DELIVERY via EmailJS
    if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
        try {
            await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_ID,
                {
                    email: ADMIN_EMAIL,
                    subject: subject,
                    message: body,
                    to_name: "Andre"
                },
                EMAILJS_PUBLIC_KEY
            );
            console.log(`[EmailService] ✅ Success! Admin notification delivered to ${ADMIN_EMAIL}`);
        } catch (error) {
            console.error(`[EmailService] ❌ Failed to deliver via EmailJS:`, error);
        }
    }
};

/**
 * Service-level check for "New Joiners" since user last viewed stats.
 * Used for the passive notification logic on the Stats page.
 */
export const checkForNewJoinsAndNotify = async (currentCount) => {
    try {
        const { data: setting } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'last_notified_user_count')
            .single();

        const lastCount = parseInt(setting?.value || '0');

        if (currentCount > lastCount) {
            const difference = currentCount - lastCount;
            console.log(`[EmailService] 🆕 detected ${difference} new users!`);

            // 1. Update the count FIRST to prevent repeat notifications (Fail-Safe)
            const { error: updateError } = await supabase.from('app_settings').upsert({
                key: 'last_notified_user_count',
                value: currentCount.toString(),
                updated_at: new Date().toISOString()
            });

            if (updateError) {
                console.error('[EmailService] ❌ Failed to update notification count. Aborting email to prevent loop.', updateError);
                return;
            }

            // 2. Notify admin only if DB update succeeded
            await notifyAdminOfNewUser('Multiple', `${difference} new users joined since last check.`);
        }
    } catch (err) {
        console.error('[EmailService] Error in background check:', err);
    }
};

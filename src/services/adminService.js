import { supabase } from '../config/supabaseClient';

/**
 * Log an API call to the database
 * @param {string} endpoint - The name of the function/endpoint called (e.g., 'getWordStudy')
 * @param {string} status - 'success' or 'error'
 * @param {string} model - The AI model used (optional, e.g., 'gemini-pro')
 * @param {object} metadata - Any extra data to store
 */
export const logApiCall = async (endpoint, status, model = 'gemini', metadata = {}) => {
    console.log(`📊 [API Tracker] Logging call: ${endpoint} | Status: ${status} | Model: ${model}`);
    try {
        const { data, error } = await supabase
            .from('api_usage_logs')
            .insert([
                {
                    endpoint,
                    status,
                    model,
                    metadata
                }
            ])
            .select();

        if (error) {
            console.error('❌ [API Tracker] Error logging API call:', error);
        } else {
            console.log('✅ [API Tracker] Successfully logged:', data);
        }
    } catch (err) {
        console.error('❌ [API Tracker] Failed to log API call:', err);
    }
};

/**
 * Get API usage statistics for a date range
 * @param {Date} startDate 
 * @param {Date} endDate 
 */
export const getApiUsageStats = async (startDate, endDate) => {
    try {
        // Ensure dates are ISO strings
        const start = startDate.toISOString();
        const end = endDate.toISOString();

        const { data, error } = await supabase
            .from('api_usage_logs')
            .select('*')
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { success: true, data };
    } catch (error) {
        console.error('Error fetching API stats:', error);
        return { success: false, error: error.message };
    }
};
/**
 * Get email notification settings
 */
export const getEmailNotificationSettings = async () => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .in('key', ['admin_new_user_email_enabled', 'user_welcome_email_enabled']);

        if (error) throw error;

        const settings = {
            adminNotify: false,
            userWelcome: false
        };

        data.forEach(item => {
            if (item.key === 'admin_new_user_email_enabled') settings.adminNotify = item.value === 'true';
            if (item.key === 'user_welcome_email_enabled') settings.userWelcome = item.value === 'true';
        });

        return { success: true, data: settings };
    } catch (error) {
        console.error('Error fetching email settings:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Toggle an email notification setting
 */
export const toggleEmailNotification = async (key, enabled) => {
    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key,
                value: enabled ? 'true' : 'false',
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error(`Error toggling email setting ${key}:`, error);
        return { success: false, error: error.message };
    }
};

/**
 * Get email templates from app_settings
 */
export const getEmailTemplates = async () => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .in('key', ['email_template_welcome_body', 'email_template_admin_body']);

        if (error) throw error;

        const templates = {
            welcome: '',
            admin: ''
        };

        data.forEach(item => {
            if (item.key === 'email_template_welcome_body') templates.welcome = item.value;
            if (item.key === 'email_template_admin_body') templates.admin = item.value;
        });

        return { success: true, data: templates };
    } catch (error) {
        console.error('Error fetching email templates:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Update an email template
 */
export const updateEmailTemplate = async (key, value) => {
    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key,
                value,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error(`Error updating email template ${key}:`, error);
        return { success: false, error: error.message };
    }
};

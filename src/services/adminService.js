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
/**
 * Get detailed user info by email (including limits)
 */
export const getUserDetailsByEmail = async (email) => {
    try {
        // [SECURE FETCH] Use RPC to assume Admin role and bypass RLS
        const { data: profiles, error } = await supabase
            .rpc('get_profile_by_email', { target_email: email });

        // Removed .limit(1) to show ALL duplicate profiles

        if (error) throw error;

        if (!profiles || profiles.length === 0) {
            return { success: false, error: 'User not found in user_profiles table.' };
        }

        return { success: true, data: profiles };
    } catch (error) {
        console.error('Error fetching user details:', error);
        return { success: false, error: 'User not found or error fetching details.' };
    }
};

/**
 * Update a user's subscription status/role (Admin Only)
 * Uses the secure 'update_user_subscription_status' RPC
 * @param {string} targetUserId - The ID of the user to update
 * @param {string} newStatus - 'admin', 'premium', 'tester', 'tester_finger', or '' (reset)
 */
export const updateUserStatus = async (targetUserId, newStatus) => {
    try {
        const { data, error } = await supabase.rpc('update_user_subscription_status', {
            target_user_id: targetUserId,
            new_status: newStatus
        });

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error updating user status:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get overall Trivia statistics for the dashboard
 */
export const getTriviaDashboardStats = async () => {
    try {
        // 1. Total Questions Answered
        const { count: totalQuestions, error: qError } = await supabase
            .from('user_trivia_history')
            .select('*', { count: 'exact', head: true });

        // 2. Total Correct
        const { count: totalCorrect, error: cError } = await supabase
            .from('user_trivia_history')
            .select('*', { count: 'exact', head: true })
            .eq('is_correct', true);

        // 3. Unique Users
        // Since Supabase doesn't easily support 'distinct' count on a column via JS without RPC, 
        // we'll fetch the user_ids and count unique ones manually for now (assuming smallish history)
        // Optimization: Use a view or RPC for this later.
        const { data: userHistory, error: uError } = await supabase
            .from('user_trivia_history')
            .select('user_id');

        const uniqueUsers = new Set(userHistory?.map(h => h.user_id)).size;

        // 4. Activity per day (Last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: dailyActivity, error: dError } = await supabase
            .from('user_trivia_history')
            .select('answered_at')
            .gte('answered_at', thirtyDaysAgo.toISOString());

        // Process daily activity
        const activityMap = {};
        dailyActivity?.forEach(item => {
            const date = item.answered_at.split('T')[0];
            activityMap[date] = (activityMap[date] || 0) + 1;
        });

        // 5. Total Questions in DB
        const { count: dbQuestionsCount } = await supabase
            .from('trivia_questions')
            .select('*', { count: 'exact', head: true });

        return {
            success: true,
            data: {
                totalQuestions: totalQuestions || 0,
                totalCorrect: totalCorrect || 0,
                uniqueUsers,
                activityByDate: activityMap,
                dbQuestionsCount: dbQuestionsCount || 0
            }
        };

    } catch (error) {
        console.error('Error fetching trivia dashboard stats:', error);
        return { success: false, error: error.message };
    }
};

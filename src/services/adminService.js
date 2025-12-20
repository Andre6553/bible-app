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

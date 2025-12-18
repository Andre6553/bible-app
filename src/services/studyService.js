import { supabase } from '../config/supabaseClient';
import { getUserId } from './bibleService';

/**
 * Study Service - Handles Inductive Bible Study data
 */

export const getInductiveStudies = async () => {
    const userId = getUserId();
    try {
        const { data, error } = await supabase
            .from('inductive_studies')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return { success: true, studies: data || [] };
    } catch (err) {
        console.error('Error fetching studies:', err);
        return { success: false, error: err.message };
    }
};

export const getStudyById = async (id) => {
    try {
        const { data, error } = await supabase
            .from('inductive_studies')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return { success: true, study: data };
    } catch (err) {
        console.error('Error fetching study by ID:', err);
        return { success: false, error: err.message };
    }
};

export const saveInductiveStudy = async (study) => {
    const userId = getUserId();
    try {
        const studyData = {
            ...study,
            user_id: userId,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('inductive_studies')
            .upsert(studyData, { onConflict: 'id' })
            .select()
            .single();

        if (error) throw error;
        return { success: true, study: data };
    } catch (err) {
        console.error('Error saving study:', err);
        return { success: false, error: err.message };
    }
};

export const deleteInductiveStudy = async (id) => {
    try {
        const { error } = await supabase
            .from('inductive_studies')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('Error deleting study:', err);
        return { success: false, error: err.message };
    }
};

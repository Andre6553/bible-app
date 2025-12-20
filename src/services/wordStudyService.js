import { supabase } from '../config/supabaseClient';
import { getUserId } from './bibleService';

/**
 * Save or update a word study
 */
export const saveWordStudy = async (study) => {
    try {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('word_studies')
            .upsert({
                ...study,
                user_id: userId
            }, {
                onConflict: 'user_id, book_id, chapter, verse, word'
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error saving word study:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all saved word studies for the current user
 */
export const getSavedWordStudies = async () => {
    try {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('word_studies')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, studies: data };
    } catch (error) {
        console.error('Error fetching saved word studies:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Delete a saved word study
 */
export const deleteWordStudy = async (id) => {
    try {
        const { error } = await supabase
            .from('word_studies')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error deleting word study:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check if a specific word study is already saved
 */
export const checkIsWordStudySaved = async (bookId, chapter, verse, word) => {
    try {
        const userId = getUserId();
        const { data, error } = await supabase
            .from('word_studies')
            .select('id')
            .eq('user_id', userId)
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .eq('verse', verse)
            .eq('word', word)
            .maybeSingle();

        if (error) throw error;
        return { success: true, saved: !!data, id: data?.id };
    } catch (error) {
        console.error('Error checking saved status:', error);
        return { success: false, error: error.message };
    }
};

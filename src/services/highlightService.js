/**
 * Highlight & Notes Service
 * Handles verse highlighting, notes, study collections, and labels
 */

import { supabase } from '../config/supabaseClient';
import { getUserId } from './bibleService';

// =====================================================
// Highlight Functions
// =====================================================

/**
 * Get all highlights for a chapter
 * Cross-version: highlights show in ALL Bible versions
 */
export const getChapterHighlights = async (bookId, chapter, version) => {
    const userId = await getUserId();
    try {
        // Note: version param kept for API compatibility but not used in query
        const { data, error } = await supabase
            .from('verse_highlights')
            .select('*')
            .eq('user_id', userId)
            .eq('book_id', bookId)
            .eq('chapter', chapter);
        // Removed .eq('version', version) - highlights now cross-version

        if (error) throw error;

        // Return as map: verse number -> color
        const highlightMap = {};
        data?.forEach(h => {
            highlightMap[h.verse] = h.color;
        });
        return { success: true, highlights: highlightMap };
    } catch (err) {
        console.error('Error fetching highlights:', err);
        return { success: false, highlights: {} };
    }
};

/**
 * Save or update a verse highlight
 * Cross-version: same highlight applies to all Bible versions
 */
export const saveHighlight = async (bookId, chapter, verse, version, color) => {
    const userId = await getUserId();
    try {
        // First, delete any existing highlight for this verse (any version)
        await supabase
            .from('verse_highlights')
            .delete()
            .eq('user_id', userId)
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .eq('verse', verse);

        // Then insert the new highlight
        const { error } = await supabase
            .from('verse_highlights')
            .insert({
                user_id: userId,
                book_id: bookId,
                chapter,
                verse,
                version, // Still store version for reference
                color
            });

        if (error) throw error;
        console.log('✅ Highlight saved (cross-version)');
        return { success: true };
    } catch (err) {
        console.error('Error saving highlight:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Save highlights for multiple verses at once (Bulk)
 * @param {Array} verseList - Array of { bookId, chapter, verse, version }
 * @param {string} color - Hex color code
 * @param {string} [label] - Optional specific tag/label for these highlights
 */
export const saveBulkHighlights = async (verseList, color, label) => {
    const userId = await getUserId();
    if (!verseList || verseList.length === 0) return { success: true };

    try {
        // 1. Group by Book and Chapter for efficient deletion
        const groups = {};
        verseList.forEach(v => {
            const key = `${v.bookId}-${v.chapter}`;
            if (!groups[key]) {
                groups[key] = { bookId: v.bookId, chapter: v.chapter, verses: [] };
            }
            groups[key].verses.push(v.verse);
        });

        // 2. Delete existing highlights for these verses (cross-version)
        // We do this concurrently for each book/chapter group
        const deletePromises = Object.values(groups).map(group => {
            return supabase
                .from('verse_highlights')
                .delete()
                .eq('user_id', userId)
                .eq('book_id', group.bookId)
                .eq('chapter', group.chapter)
                .in('verse', group.verses);
        });

        await Promise.all(deletePromises);

        // 3. Insert new highlights
        const updates = verseList.map(v => ({
            user_id: userId,
            book_id: v.bookId,
            chapter: v.chapter,
            verse: v.verse,
            version: v.version || 'AFR53', // Default if missing
            color,
            label: label || null, // [NEW] Store specific label if provided
            created_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
            .from('verse_highlights')
            .insert(updates);

        if (insertError) throw insertError;

        console.log(`✅ Bulk saved ${verseList.length} highlights`);
        return { success: true, count: verseList.length };
    } catch (err) {
        console.error('Error saving bulk highlights:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Remove highlights for multiple verses at once (Bulk)
 */
export const removeBulkHighlights = async (verseList) => {
    const userId = await getUserId();
    if (!verseList || verseList.length === 0) return { success: true };

    try {
        // Group by Book and Chapter for efficient deletion
        const groups = {};
        verseList.forEach(v => {
            const key = `${v.bookId}-${v.chapter}`;
            if (!groups[key]) {
                groups[key] = { bookId: v.bookId, chapter: v.chapter, verses: [] };
            }
            groups[key].verses.push(v.verse);
        });

        const deletePromises = Object.values(groups).map(group => {
            return supabase
                .from('verse_highlights')
                .delete()
                .eq('user_id', userId)
                .eq('book_id', group.bookId)
                .eq('chapter', group.chapter)
                .in('verse', group.verses);
        });

        await Promise.all(deletePromises);

        console.log(`✅ Bulk removed ${verseList.length} highlights`);
        return { success: true, count: verseList.length };
    } catch (err) {
        console.error('Error removing bulk highlights:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Remove a verse highlight
 * Cross-version: removes highlight from all versions
 */
export const removeHighlight = async (bookId, chapter, verse, version) => {
    const userId = await getUserId();
    try {
        // Remove highlight regardless of version
        const { error } = await supabase
            .from('verse_highlights')
            .delete()
            .eq('user_id', userId)
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .eq('verse', verse);
        // Removed .eq('version', version) - removes from all versions

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('Error removing highlight:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Delete highlights by their IDs (Bulk Delete)
 * @param {Array<string>} ids - List of highlight UUIDs
 */
export const deleteHighlightsByIds = async (ids) => {
    if (!ids || ids.length === 0) return { success: true };
    const userId = await getUserId();

    try {
        const { error } = await supabase
            .from('verse_highlights')
            .delete()
            .eq('user_id', userId)
            .in('id', ids);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('Error bulk deleting highlights by ID:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Get all highlights for a user (for Profile page)
 */
export const getAllHighlights = async () => {
    const userId = await getUserId();
    try {
        const { data, error } = await supabase
            .from('verse_highlights')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, highlights: data || [] };
    } catch (err) {
        console.error('Error fetching all highlights:', err);
        return { success: false, highlights: [] };
    }
};

/**
 * Get highlights for specific colors (On-Demand Loading)
 * @param {Array<string>} colors - List of hex color codes
 */
export const getHighlightsByColors = async (colors) => {
    const userId = await getUserId();
    if (!colors || colors.length === 0) return { success: true, highlights: [] };

    try {
        const { data, error } = await supabase
            .from('verse_highlights')
            .select('*')
            .eq('user_id', userId)
            .in('color', colors)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, highlights: data || [] };
    } catch (err) {
        console.error('Error fetching highlights by color:', err);
        return { success: false, highlights: [] };
    }
};

/**
 * Fetch text for specific highlights (for filtering)
 */
export const fetchHighlightTexts = async (highlights) => {
    if (!highlights || highlights.length === 0) return [];

    try {
        // 1. Group by book/chapter/version
        const groups = {};
        highlights.forEach(h => {
            const key = `${h.book_id}-${h.chapter}-${h.version}`;
            if (!groups[key]) {
                groups[key] = { bookId: h.book_id, chapter: h.chapter, version: h.version, verses: [] };
            }
            groups[key].verses.push(h.verse);
        });

        // 2. Fetch concurrently (batched)
        // Optimization: Process groups in chunks of 10 to avoid browser connection limits
        const groupValues = Object.values(groups);
        const results = [];
        const CHUNK_SIZE = 10;

        for (let i = 0; i < groupValues.length; i += CHUNK_SIZE) {
            const chunk = groupValues.slice(i, i + CHUNK_SIZE);
            const chunkPromises = chunk.map(async (g) => {
                const { data } = await supabase
                    .from('verses')
                    .select('verse, text')
                    .eq('book_id', g.bookId)
                    .eq('chapter', g.chapter)
                    .eq('version', g.version)
                    .in('verse', g.verses);
                return { key: `${g.bookId}-${g.chapter}-${g.version}`, data: data || [] };
            });
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
        }

        // 3. Map back
        const textMap = {};
        results.forEach(r => {
            r.data.forEach(v => {
                textMap[`${r.key}-${v.verse}`] = v.text;
            });
        });

        return highlights.map(h => ({
            ...h,
            text: textMap[`${h.book_id}-${h.chapter}-${h.version}-${h.verse}`] || ''
        }));
    } catch (err) {
        console.error('Error enriching highlights:', err);
        return highlights; // Return original if fail
    }
};

/**
 * Get all highlight color categories/labels for a user
 */
export const getHighlightCategories = async () => {
    const userId = await getUserId();
    try {
        const { data, error } = await supabase
            .from('highlight_categories')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;

        // Return as map: color -> label
        const categoryMap = {};
        data?.forEach(c => {
            categoryMap[c.color] = c.label;
        });
        return { success: true, categories: categoryMap };
    } catch (err) {
        console.error('Error fetching highlight categories:', err);
        return { success: false, categories: {} };
    }
};

/**
 * Save or update a highlight color category/label
 */
export const saveHighlightCategory = async (color, label) => {
    const userId = await getUserId();
    try {
        const { error } = await supabase
            .from('highlight_categories')
            .upsert({
                user_id: userId,
                color,
                label,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,color'
            });

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('Error saving highlight category:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Delete an entire category and all its associated highlights
 * @param {string} labelToDelete - The name of the category to remove
 */
export const deleteCategory = async (labelToDelete) => {
    const userId = await getUserId();
    try {
        // 1. Get all categories for this user
        const { data: catData, error: catError } = await supabase
            .from('highlight_categories')
            .select('*')
            .eq('user_id', userId);

        if (catError) throw catError;

        const colorsToRemoveHighlightsFrom = [];
        const categoriesToUpdate = [];
        const categoriesToDelete = [];

        // 2. Identify which colors are affected
        catData?.forEach(cat => {
            const labels = cat.label.split(/[,，、;|]/).map(l => l.trim()).filter(l => l);
            if (labels.includes(labelToDelete)) {
                // This color is used for this category
                colorsToRemoveHighlightsFrom.push(cat.color);

                // Check if this was a multi-label color
                const remainingLabels = labels.filter(l => l !== labelToDelete);
                if (remainingLabels.length > 0) {
                    categoriesToUpdate.push({
                        color: cat.color,
                        newLabel: remainingLabels.join(', ')
                    });
                } else {
                    categoriesToDelete.push(cat.color);
                }
            }
        });

        // 3. Remove all highlights for affected colors
        // 3. Remove all highlights for affected colors
        // [MODIFIED] We do NOT auto-delete highlights here anymore.
        // The Deep Delete logic in Profile.jsx handles selective deletion of highlights.
        // If we delete by color here, we risk deleting shared highlights (e.g. Glo/Bely).
        /*
        if (colorsToRemoveHighlightsFrom.length > 0) {
            const { error: highlightError } = await supabase
                .from('verse_highlights')
                .delete()
                .eq('user_id', userId)
                .in('color', colorsToRemoveHighlightsFrom);

            if (highlightError) throw highlightError;
        }
        */

        // 4. Update or Delete category records
        for (const update of categoriesToUpdate) {
            await supabase
                .from('highlight_categories')
                .update({ label: update.newLabel, updated_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('color', update.color);
        }

        if (categoriesToDelete.length > 0) {
            await supabase
                .from('highlight_categories')
                .delete()
                .eq('user_id', userId)
                .in('color', categoriesToDelete);
        }

        return { success: true };
    } catch (err) {
        console.error('Error deleting category:', err);
        return { success: false, error: err.message };
    }
};

// =====================================================
// Study Collections
// =====================================================

/**
 * Get all study collections for a user
 */
export const getStudyCollections = async () => {
    const userId = await getUserId();
    try {
        const { data, error } = await supabase
            .from('study_collections')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return { success: true, collections: data || [] };
    } catch (err) {
        console.error('Error fetching study collections:', err);
        return { success: false, collections: [] };
    }
};

/**
 * Create a new study collection
 */
export const createStudyCollection = async (name, description = '', color = '#6366f1') => {
    const userId = await getUserId();
    try {
        const { data, error } = await supabase
            .from('study_collections')
            .insert({
                user_id: userId,
                name,
                description,
                color
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, collection: data };
    } catch (err) {
        console.error('Error creating study collection:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Delete a study collection
 */
export const deleteStudyCollection = async (studyId) => {
    try {
        const { error } = await supabase
            .from('study_collections')
            .delete()
            .eq('id', studyId);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('Error deleting study collection:', err);
        return { success: false, error: err.message };
    }
};

// =====================================================
// Notes
// =====================================================

/**
 * Get note for a specific verse
 */
export const getVerseNote = async (bookId, chapter, verse, version) => {
    const userId = await getUserId();
    try {
        const { data, error } = await supabase
            .from('verse_notes')
            .select(`
                *,
                study_collections (id, name, color),
                note_labels (
                    user_labels (id, name, color)
                )
            `)
            .eq('user_id', userId)
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .eq('verse', verse)
            .eq('version', version)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
        return { success: true, note: data };
    } catch (err) {
        console.error('Error fetching verse note:', err);
        return { success: false, note: null };
    }
};

/**
 * Save a verse note
 */
export const saveNote = async (bookId, chapter, verse, version, noteText, studyId = null, labelIds = []) => {
    const userId = await getUserId();
    try {
        // Upsert the note
        const { data: note, error: noteError } = await supabase
            .from('verse_notes')
            .upsert({
                user_id: userId,
                book_id: bookId,
                chapter,
                verse,
                version,
                note_text: noteText,
                study_id: studyId,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,book_id,chapter,verse,version'
            })
            .select()
            .single();

        if (noteError) throw noteError;

        // Update labels if provided
        if (labelIds.length > 0 && note) {
            // Remove old labels
            await supabase.from('note_labels').delete().eq('note_id', note.id);

            // Add new labels
            const labelLinks = labelIds.map(labelId => ({
                note_id: note.id,
                label_id: labelId
            }));
            await supabase.from('note_labels').insert(labelLinks);
        }

        console.log('✅ Note saved');
        return { success: true, note };
    } catch (err) {
        console.error('Error saving note:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Delete a verse note
 */
export const deleteNote = async (noteId) => {
    try {
        const { error } = await supabase
            .from('verse_notes')
            .delete()
            .eq('id', noteId);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('Error deleting note:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Get all notes for a user
 */
export const getAllNotes = async () => {
    const userId = await getUserId();
    try {
        const { data, error } = await supabase
            .from('verse_notes')
            .select(`
                *,
                study_collections (id, name, color),
                note_labels (
                    user_labels (id, name, color)
                )
            `)
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return { success: true, notes: data || [] };
    } catch (err) {
        console.error('Error fetching all notes:', err);
        return { success: false, notes: [] };
    }
};

// =====================================================
// Labels
// =====================================================

/**
 * Get all labels for a user
 */
export const getLabels = async () => {
    const userId = await getUserId();
    try {
        const { data, error } = await supabase
            .from('user_labels')
            .select('*')
            .eq('user_id', userId)
            .order('name');

        if (error) throw error;
        return { success: true, labels: data || [] };
    } catch (err) {
        console.error('Error fetching labels:', err);
        return { success: false, labels: [] };
    }
};

/**
 * Create a new label
 */
export const createLabel = async (name, color = '#64748b') => {
    const userId = await getUserId();
    try {
        const { data, error } = await supabase
            .from('user_labels')
            .insert({
                user_id: userId,
                name,
                color
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, label: data };
    } catch (err) {
        console.error('Error creating label:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Delete a label
 */
export const deleteLabel = async (labelId) => {
    try {
        const { error } = await supabase
            .from('user_labels')
            .delete()
            .eq('id', labelId);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('Error deleting label:', err);
        return { success: false, error: err.message };
    }
};

// =====================================================
// Highlight Colors
// =====================================================

export const HIGHLIGHT_COLORS = [
    { name: 'yellow', color: '#eab308', bg: 'rgba(234, 179, 8, 0.3)' },
    { name: 'green', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.3)' },
    { name: 'blue', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.3)' },
    { name: 'red', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.3)' },
    { name: 'rose', color: '#fb7185', bg: 'rgba(251, 113, 133, 0.3)' },
    { name: 'teal', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.3)' },
    { name: 'indigo', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.3)' },
    { name: 'orange', color: '#f97316', bg: 'rgba(249, 115, 22, 0.3)' },
    { name: 'amber', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.3)' },
    { name: 'pink', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.3)' },
    { name: 'purple', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.3)' },
    { name: 'gray', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.3)' }
];

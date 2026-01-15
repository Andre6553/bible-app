/**
 * Offline Service - Handles offline Bible storage using IndexedDB
 */

import { openDB } from 'idb';
import { supabase } from '../config/supabaseClient';

const DB_NAME = 'bible-offline';
const DB_VERSION = 1;
const STORE_NAME = 'versions';

// Initialize IndexedDB
const initDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'version_id' });
            }
        }
    });
};

/**
 * Check if a version is downloaded
 */
export const isVersionDownloaded = async (versionId) => {
    try {
        const db = await initDB();
        const data = await db.get(STORE_NAME, versionId);
        return !!data;
    } catch (err) {
        console.error('Error checking download status:', err);
        return false;
    }
};

/**
 * Get all downloaded versions
 */
export const getDownloadedVersions = async () => {
    try {
        const db = await initDB();
        const all = await db.getAll(STORE_NAME);
        return all.map(v => ({
            version_id: v.version_id,
            downloaded_at: v.downloaded_at,
            size_bytes: v.size_bytes
        }));
    } catch (err) {
        console.error('Error getting downloaded versions:', err);
        return [];
    }
};

/**
 * Download a Bible version for offline use
 * Handles large datasets by fetching in batches (Supabase 1000 row limit)
 * @param {string} versionId - Version ID (e.g., 'AFR53', 'KJV')
 * @param {function} onProgress - Progress callback (0-100)
 */
export const downloadVersion = async (versionId, onProgress) => {
    try {
        onProgress?.(0);

        // 1. Fetch all books meta
        const { data: books, error: booksError } = await supabase
            .from('books')
            .select('*')
            .order('order');

        if (booksError) throw booksError;
        onProgress?.(5);

        // 2. Fetch all verses for this version in BATHCES
        // A full Bible is ~31,102 verses. Default Supabase limit is 1000.
        console.log(`📥 Starting full download for ${versionId}...`);
        let allVerses = [];
        let offset = 0;
        const BATCH_SIZE = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: batch, error: versesError } = await supabase
                .from('verses')
                .select('id, book_id, chapter, verse, text')
                .eq('version', versionId)
                .order('id') // Order by ID for stable pagination
                .range(offset, offset + BATCH_SIZE - 1);

            if (versesError) throw versesError;

            if (batch && batch.length > 0) {
                allVerses = [...allVerses, ...batch];
                offset += BATCH_SIZE;

                // Update progress (estimate 32 batches for 31k verses)
                // We'll map 5% -> 85% range
                const progress = Math.min(85, 5 + Math.round((allVerses.length / 31102) * 80));
                onProgress?.(progress);
                console.log(`📡 Downloaded ${allVerses.length} verses...`);

                if (batch.length < BATCH_SIZE) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        onProgress?.(85);
        console.log(`🔍 Verifying ${versionId} data integrity...`);

        // 3. Verification: Ensure we have a complete Bible
        // A standard Bible has ~31,102 verses. We allow some leeway (e.g. 30,000) 
        // to account for version differences, but 1000 or 5000 is clearly incomplete.
        const MIN_EXPECTED_VERSES = 30000;
        if (allVerses.length < MIN_EXPECTED_VERSES) {
            throw new Error(`Incomplete download: Only ${allVerses.length} verses found. Expected at least ${MIN_EXPECTED_VERSES}.`);
        }

        // 4. Organize verses by book and chapter
        const booksData = books.map(book => {
            const bookVerses = allVerses.filter(v => v.book_id === book.id);
            const chapters = {};

            bookVerses.forEach(v => {
                if (!chapters[v.chapter]) {
                    chapters[v.chapter] = [];
                }
                chapters[v.chapter].push({
                    id: v.id,
                    verse: v.verse,
                    text: v.text
                    // Note: red_letters omitted as requested (disabled)
                });
            });

            return {
                ...book,
                chapters
            };
        });

        onProgress?.(95);

        // 5. Calculate storage size
        const jsonString = JSON.stringify(booksData);
        const sizeBytes = new Blob([jsonString]).size;

        // 6. Store in IndexedDB (Atomic Save)
        const db = await initDB();
        await db.put(STORE_NAME, {
            version_id: versionId,
            downloaded_at: new Date().toISOString(),
            size_bytes: sizeBytes,
            books: booksData
        });

        onProgress?.(100);
        console.log(`✅ Verified & Saved ${versionId} (${allVerses.length} verses, ${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

        return { success: true, sizeBytes, verseCount: allVerses.length };
    } catch (err) {
        console.error('❌ Offline Download Failed:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Get a chapter from offline storage
 */
export const getOfflineChapter = async (bookId, chapter, versionId) => {
    try {
        const db = await initDB();
        const versionData = await db.get(STORE_NAME, versionId);

        if (!versionData) return null;

        // Use loose equality for bookId comparison (string vs int)
        const book = versionData.books.find(b => b.id == bookId);
        if (!book) return null;

        const chapterData = book.chapters[chapter];
        if (!chapterData) return null;

        // Return in same format as Supabase response
        return chapterData.map(v => ({
            ...v,
            book_id: bookId,
            chapter,
            version: versionId,
            books: { name_full: book.name_full }
        }));
    } catch (err) {
        console.error('Error getting offline chapter:', err);
        return null;
    }
};

/**
 * Delete a downloaded version
 */
export const deleteOfflineVersion = async (versionId) => {
    try {
        const db = await initDB();
        await db.delete(STORE_NAME, versionId);
        console.log(`🗑️ Deleted offline version: ${versionId}`);
        return { success: true };
    } catch (err) {
        console.error('Error deleting version:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Get total storage used by offline versions
 */
export const getStorageUsage = async () => {
    try {
        const db = await initDB();
        const all = await db.getAll(STORE_NAME);
        const totalBytes = all.reduce((sum, v) => sum + (v.size_bytes || 0), 0);
        return {
            bytes: totalBytes,
            formatted: formatBytes(totalBytes)
        };
    } catch (err) {
        console.error('Error getting storage usage:', err);
        return { bytes: 0, formatted: '0 B' };
    }
};

/**
 * Format bytes to human readable
 */
const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export { formatBytes };

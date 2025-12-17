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
 * @param {string} versionId - Version ID (e.g., 'AFR53', 'KJV')
 * @param {function} onProgress - Progress callback (0-100)
 */
export const downloadVersion = async (versionId, onProgress) => {
    try {
        onProgress?.(0);

        // Fetch all books
        const { data: books, error: booksError } = await supabase
            .from('books')
            .select('*')
            .order('order');

        if (booksError) throw booksError;
        onProgress?.(5);

        // Fetch all verses for this version
        const { data: verses, error: versesError } = await supabase
            .from('verses')
            .select('*')
            .eq('version', versionId)
            .order('book_id')
            .order('chapter')
            .order('verse');

        if (versesError) throw versesError;
        onProgress?.(70);

        // Organize verses by book and chapter
        const booksData = books.map(book => {
            const bookVerses = verses.filter(v => v.book_id === book.id);
            const chapters = {};

            bookVerses.forEach(v => {
                if (!chapters[v.chapter]) {
                    chapters[v.chapter] = [];
                }
                chapters[v.chapter].push({
                    id: v.id,
                    verse: v.verse,
                    text: v.text
                });
            });

            return {
                ...book,
                chapters
            };
        });

        onProgress?.(85);

        // Calculate storage size (rough estimate)
        const jsonString = JSON.stringify(booksData);
        const sizeBytes = new Blob([jsonString]).size;

        // Store in IndexedDB
        const db = await initDB();
        await db.put(STORE_NAME, {
            version_id: versionId,
            downloaded_at: new Date().toISOString(),
            size_bytes: sizeBytes,
            books: booksData
        });

        onProgress?.(100);
        console.log(`✅ Downloaded ${versionId} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

        return { success: true, sizeBytes };
    } catch (err) {
        console.error('Error downloading version:', err);
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

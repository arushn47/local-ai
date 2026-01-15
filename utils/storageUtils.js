import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Upload a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} folder - The folder name ('chat-images' or 'documents')
 * @param {string} userId - The user's ID
 * @returns {Promise<{url: string, path: string} | null>} The download URL and path, or null on error
 */
export const uploadFile = async (file, folder, userId) => {
    if (!userId) {
        console.error('[Storage] No user ID provided');
        return null;
    }

    try {
        // Create a unique filename
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${folder}/${userId}/${fileName}`;

        console.log(`[Storage] Uploading to ${filePath}`);

        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        console.log('[Storage] Upload successful:', url);

        return {
            url,
            path: filePath,
            folder
        };
    } catch (e) {
        console.error('[Storage] Unexpected error:', e);
        return null;
    }
};

/**
 * Upload an image to chat-images folder
 * @param {File} file - The image file
 * @param {string} userId - The user's ID
 * @returns {Promise<{url: string, path: string} | null>}
 */
export const uploadImage = async (file, userId) => {
    return uploadFile(file, 'chat-images', userId);
};

/**
 * Upload a document to documents folder
 * @param {File} file - The document file (PDF, etc.)
 * @param {string} userId - The user's ID
 * @returns {Promise<{url: string, path: string} | null>}
 */
export const uploadDocument = async (file, userId) => {
    return uploadFile(file, 'documents', userId);
};

/**
 * Delete a file from Firebase Storage
 * @param {string} path - The file path
 * @returns {Promise<boolean>} True if deleted successfully
 */
export const deleteFile = async (path) => {
    try {
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
        return true;
    } catch (e) {
        console.error('[Storage] Delete error:', e);
        return false;
    }
};

/**
 * Get download URL for a file (Firebase URLs don't expire by default)
 * @param {string} path - The file path
 * @returns {Promise<string | null>} The download URL or null
 */
export const getFileUrl = async (path) => {
    try {
        const storageRef = ref(storage, path);
        return await getDownloadURL(storageRef);
    } catch (e) {
        console.error('[Storage] URL error:', e);
        return null;
    }
};

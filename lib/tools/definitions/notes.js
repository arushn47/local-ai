/**
 * Notes Tool - User notes management (Firebase)
 */

import { TOOL_CATEGORIES } from '../categories.js';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, limit as firestoreLimit, serverTimestamp } from 'firebase/firestore';

export const notesTool = {
    name: 'notes',
    description: 'Create, read, and manage user notes.',
    category: TOOL_CATEGORIES.SAFE,
    isStub: false,

    parameters: {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                enum: ['create', 'read', 'list'],
                description: 'Operation to perform'
            },
            content: {
                type: 'string',
                description: 'Note content (for create)'
            },
            limit: {
                type: 'number',
                default: 5,
                description: 'Max notes to return (for list)'
            }
        },
        required: ['operation']
    },

    async execute(params, context) {
        const { userId } = context;
        const { operation, content, limit = 5 } = params;

        if (!userId) {
            return { error: 'Notes require authentication' };
        }

        try {
            switch (operation) {
                case 'create':
                    if (!content) {
                        return { error: 'Content required for create' };
                    }
                    await addDoc(collection(db, 'notes'), {
                        userId,
                        content,
                        createdAt: serverTimestamp()
                    });
                    return { success: true, message: `Note saved: "${content}"` };

                case 'list':
                case 'read':
                    const q = query(
                        collection(db, 'notes'),
                        where('userId', '==', userId),
                        orderBy('createdAt', 'desc'),
                        firestoreLimit(limit)
                    );
                    const snapshot = await getDocs(q);
                    const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    return {
                        notes,
                        formatted: notes.length
                            ? notes.map((n, i) => `${i + 1}. ${n.content}`).join('\n')
                            : 'No notes found'
                    };

                default:
                    return { error: `Unknown operation: ${operation}` };
            }
        } catch (error) {
            return { error: `Notes operation failed: ${error.message}` };
        }
    }
};

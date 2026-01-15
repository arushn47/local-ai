/**
 * Tasks Tool - User task management (Firebase)
 */

import { TOOL_CATEGORIES } from '../categories.js';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, updateDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

export const tasksTool = {
    name: 'tasks',
    description: 'Create, complete, and list user tasks and reminders.',
    category: TOOL_CATEGORIES.SAFE,
    isStub: false,

    parameters: {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                enum: ['create', 'complete', 'list'],
                description: 'Operation to perform'
            },
            content: {
                type: 'string',
                description: 'Task content (for create)'
            },
            taskId: {
                type: 'string',
                description: 'Task ID or search term (for complete)'
            }
        },
        required: ['operation']
    },

    async execute(params, context) {
        const { userId } = context;
        const { operation, content, taskId } = params;

        if (!userId) {
            return { error: 'Tasks require authentication' };
        }

        try {
            switch (operation) {
                case 'create':
                    if (!content) {
                        return { error: 'Content required for create' };
                    }
                    await addDoc(collection(db, 'tasks'), {
                        userId,
                        content,
                        completed: false,
                        createdAt: serverTimestamp()
                    });
                    return { success: true, message: `Task added: "${content}"` };

                case 'list':
                    const q = query(
                        collection(db, 'tasks'),
                        where('userId', '==', userId),
                        where('completed', '==', false),
                        orderBy('createdAt', 'desc')
                    );
                    const snapshot = await getDocs(q);
                    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    return {
                        tasks,
                        formatted: tasks.length
                            ? tasks.map(t => `[ ] ${t.content}`).join('\n')
                            : 'No pending tasks'
                    };

                case 'complete':
                    if (!taskId) {
                        return { error: 'Task ID or search term required' };
                    }
                    // Find task by content match
                    const searchQuery = query(
                        collection(db, 'tasks'),
                        where('userId', '==', userId),
                        where('completed', '==', false)
                    );
                    const searchSnapshot = await getDocs(searchQuery);
                    const matchingTask = searchSnapshot.docs.find(doc =>
                        doc.data().content.toLowerCase().includes(taskId.toLowerCase())
                    );

                    if (!matchingTask) {
                        return { error: `Task not found: "${taskId}"` };
                    }

                    await updateDoc(doc(db, 'tasks', matchingTask.id), {
                        completed: true,
                        updatedAt: serverTimestamp()
                    });
                    return { success: true, message: `Task completed: "${taskId}"` };

                default:
                    return { error: `Unknown operation: ${operation}` };
            }
        } catch (error) {
            return { error: `Tasks operation failed: ${error.message}` };
        }
    }
};

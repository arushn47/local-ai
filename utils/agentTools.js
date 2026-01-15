
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, updateDoc, query, where, orderBy, limit, serverTimestamp, doc } from 'firebase/firestore';
import { searchWeb, formatSearchResults } from '@/utils/searchUtils';

// Helper to check for math expressions
const isMathExpression = (text) => {
    const mathRegex = /^[\d\s\.\+\-\*\/\(\)\^%]+$/;
    const hasOperator = /[\+\-\*\/\^%]/;
    const cleanText = text.trim().replace('=', '');
    return mathRegex.test(cleanText) && hasOperator.test(cleanText);
};

// Safe calculator
const calculate = (expression) => {
    try {
        const cleanExpr = expression.replace(/[^0-9+\-*/().%^]/g, '');
        if (!cleanExpr) return null;
        // eslint-disable-next-line
        const result = new Function(`return (${cleanExpr})`)();
        if (!isFinite(result) || isNaN(result)) return null;
        return result;
    } catch (e) {
        return null;
    }
};

/**
 * Main Agent Tool Engine
 * @param {string} inputText - The user's input text
 * @param {string|null} userId - The authenticated user's ID (null if not logged in)
 * @param {string|null} accessToken - Not used with Firebase (kept for API compatibility)
 * @returns {Promise<string|null>} Tool result message or null
 */
export const runAgentTools = async (inputText, userId = null, accessToken = null) => {
    const text = inputText.toLowerCase().trim();
    let toolResult = null;

    const headers = { 'Content-Type': 'application/json' };

    // --- 0. Web Search Tool ---
    if (text.startsWith('search for ') || text.startsWith('search: ') ||
        text.startsWith('look up ') || text.startsWith('find info about ')) {
        const queryText = inputText
            .replace(/^(search for|search:|look up|find info about)\s*/i, '')
            .trim();

        if (queryText) {
            try {
                console.log('[Agent] Searching for:', queryText);
                const results = await searchWeb(queryText);
                toolResult = formatSearchResults(results);
            } catch (e) {
                toolResult = `[Search Tool] Error: ${e.message}`;
            }
        }
    }

    // --- 1. Calculator Tool ---
    if (!toolResult && (text.startsWith('calculate ') || text.startsWith('solve '))) {
        const expr = text.replace(/^(calculate|solve)\s+/, '');
        const result = calculate(expr);
        if (result !== null) {
            toolResult = `[Calculator Tool] Result: ${result}`;
        }
    } else if (!toolResult && isMathExpression(inputText)) {
        const result = calculate(inputText);
        if (result !== null) {
            toolResult = `[Calculator Tool] Result: ${result}`;
        }
    }

    // --- 1.5 Calendar Tool ---
    if (!toolResult && (
        text.includes('my calendar') ||
        text.includes('my schedule') ||
        text.includes("what's on my calendar") ||
        text.startsWith('show calendar')
    )) {
        try {
            const response = await fetch('/api/calendar', { headers });
            const data = await response.json();

            if (data.needsAuth) {
                toolResult = `[Calendar Tool] Google Calendar not connected. Please go to Settings to connect your Google account.`;
            } else if (data.error) {
                toolResult = `[Calendar Tool] Error: ${data.error}`;
            } else {
                toolResult = data.formatted || '[Calendar Tool] No events found';
            }
        } catch (e) {
            toolResult = `[Calendar Tool] Error fetching calendar: ${e.message}`;
        }
    }

    // --- 1.6 Email Tool ---
    if (!toolResult && (
        text.includes('my email') ||
        text.includes('my inbox') ||
        text.includes('check email') ||
        text.includes('unread email') ||
        text.startsWith('show email')
    )) {
        try {
            const response = await fetch('/api/email', { headers });
            const data = await response.json();

            if (data.needsAuth) {
                toolResult = `[Email Tool] Google not connected. Please go to Settings → Integrations to connect your Google account.`;
            } else if (data.error) {
                toolResult = `[Email Tool] Error: ${data.error}`;
            } else {
                toolResult = data.formatted || '[Email Tool] No emails found';
            }
        } catch (e) {
            toolResult = `[Email Tool] Error fetching emails: ${e.message}`;
        }
    }

    // --- 1.7 Knowledge Base (RAG) Tool ---
    if (!toolResult && (text.startsWith('learn from:') || text.startsWith('remember this:'))) {
        if (!userId) {
            toolResult = `[Knowledge Tool] Please sign in to save knowledge.`;
        } else {
            const content = inputText.substring(inputText.indexOf(':') + 1).trim();
            const docName = `Note ${new Date().toLocaleString()}`;

            try {
                const response = await fetch('/api/knowledge', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ documentName: docName, text: content }),
                });
                const data = await response.json();

                if (data.error) {
                    toolResult = `[Knowledge Tool] Error: ${data.error}`;
                } else {
                    toolResult = `[Knowledge Tool] Learned from text (stored as "${docName}").`;
                }
            } catch (e) {
                toolResult = `[Knowledge Tool] Error learning: ${e.message}`;
            }
        }
    }

    // --- 2. Notes Tool (Firebase) ---
    if (!toolResult && (text.startsWith('add note:') || text.startsWith('create note:'))) {
        if (!userId) {
            toolResult = `[Notes Tool] Please sign in to save notes.`;
        } else {
            const content = inputText.substring(inputText.indexOf(':') + 1).trim();
            try {
                await addDoc(collection(db, 'notes'), {
                    userId,
                    content,
                    createdAt: serverTimestamp()
                });
                toolResult = `[Notes Tool] Saved note: "${content}"`;
            } catch (e) {
                toolResult = `[Notes Tool] Error saving note: ${e.message}`;
            }
        }
    }

    // Show notes
    if (!toolResult && (text.includes('show notes') || text.includes('my notes') || text.includes('list notes'))) {
        if (!userId) {
            toolResult = `[Notes Tool] Please sign in to view your notes.`;
        } else {
            try {
                const q = query(
                    collection(db, 'notes'),
                    where('userId', '==', userId),
                    orderBy('createdAt', 'desc'),
                    limit(5)
                );
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    toolResult = `[Notes Tool] You have no notes.`;
                } else {
                    const notesList = snapshot.docs.map((doc, i) => `${i + 1}. ${doc.data().content}`).join('\n');
                    toolResult = `[Notes Tool] Your recent notes:\n${notesList}`;
                }
            } catch (e) {
                toolResult = `[Notes Tool] Error fetching notes: ${e.message}`;
            }
        }
    }

    // --- 3. Tasks Tool (Firebase) ---
    if (!toolResult && (text.startsWith('add task:') || text.startsWith('create task:') || text.startsWith('remind me to'))) {
        if (!userId) {
            toolResult = `[Tasks Tool] Please sign in to add tasks.`;
        } else {
            let content = inputText;
            if (text.startsWith('add task:') || text.startsWith('create task:')) {
                content = inputText.substring(inputText.indexOf(':') + 1).trim();
            } else {
                content = inputText.replace(/remind me to/i, '').trim();
            }

            try {
                await addDoc(collection(db, 'tasks'), {
                    userId,
                    content,
                    completed: false,
                    createdAt: serverTimestamp()
                });
                toolResult = `[Tasks Tool] Added task: "${content}"`;
            } catch (e) {
                toolResult = `[Tasks Tool] Error adding task: ${e.message}`;
            }
        }
    }

    // Show tasks
    if (!toolResult && (text.includes('show tasks') || text.includes('my tasks') || text.includes('todo list'))) {
        if (!userId) {
            toolResult = `[Tasks Tool] Please sign in to view your tasks.`;
        } else {
            try {
                const q = query(
                    collection(db, 'tasks'),
                    where('userId', '==', userId),
                    where('completed', '==', false),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    toolResult = `[Tasks Tool] You have no pending tasks.`;
                } else {
                    const tasksList = snapshot.docs.map((doc) => `[ ] ${doc.data().content}`).join('\n');
                    toolResult = `[Tasks Tool] Your tasks:\n${tasksList}`;
                }
            } catch (e) {
                toolResult = `[Tasks Tool] Error fetching tasks: ${e.message}`;
            }
        }
    }

    // Complete task
    if (!toolResult && (text.startsWith('complete task:') || text.startsWith('finish task:'))) {
        if (!userId) {
            toolResult = `[Tasks Tool] Please sign in to manage tasks.`;
        } else {
            const search = inputText.substring(inputText.indexOf(':') + 1).trim().toLowerCase();
            try {
                const q = query(
                    collection(db, 'tasks'),
                    where('userId', '==', userId),
                    where('completed', '==', false)
                );
                const snapshot = await getDocs(q);

                const matchingTask = snapshot.docs.find(doc =>
                    doc.data().content.toLowerCase().includes(search)
                );

                if (matchingTask) {
                    await updateDoc(doc(db, 'tasks', matchingTask.id), {
                        completed: true,
                        updatedAt: serverTimestamp()
                    });
                    toolResult = `[Tasks Tool] Marked task as complete: "${search}"`;
                } else {
                    toolResult = `[Tasks Tool] Could not find task matching "${search}"`;
                }
            } catch (e) {
                toolResult = `[Tasks Tool] Error completing task: ${e.message}`;
            }
        }
    }

    return toolResult;
};

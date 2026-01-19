'use client';

import React, { useState, useEffect, useRef } from 'react';

import ChatInput from '@components/ChatInput';
import ChatMessage from '@components/ChatMessage';
import ModelSelector from '@components/ModelSelector';
import Sidebar from '@components/Sidebar';
import UserMenu from '@components/UserMenu';
import SettingsModal from '@components/SettingsModal';
import AuthOverlay from '@components/AuthOverlay';
import DeleteConfirmationModal from '@components/DeleteConfirmationModal';
import AgentStepVisualizer, { useAgentSteps } from '@components/AgentStepVisualizer';
import WakeWordIndicator from '@components/WakeWordIndicator';
import VoiceModeOverlay from '@components/VoiceModeOverlay';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore';
import { classifyTask, getModelLabel } from '@/utils/taskClassifier';
import { initTTS, speak, stopSpeaking, isSpeechSynthesisSupported, createStreamingTTS } from '@/utils/voiceUtils';
import { runAgentTools } from '@/utils/agentTools';

// --- Main App Component ---

export default function App() {
    const [chats, setChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [isAIGenerating, setIsAIGenerating] = useState(false);
    const [chatToDelete, setChatToDelete] = useState(null);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [abortController, setAbortController] = useState(null);
    const [selectedModel, setSelectedModel] = useState('auto');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [editingMessage, setEditingMessage] = useState(null);
    const chatEndRef = useRef(null);
    const runningRef = useRef(true);
    const [hasTTSSupport, setHasTTSSupport] = useState(false);
    const lastSpokenRef = useRef(null);
    const streamingTTSRef = useRef(null);

    // Auth State
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);

    // Backend info (derived from SSE meta events per request)
    const [backendMeta, setBackendMeta] = useState(null);

    // Agent tools are always enabled; keep steps for visualization.
    const { steps: agentSteps, isThinking: agentThinking, handleSSEEvent, reset: resetAgentSteps } = useAgentSteps();

    // Wake Word State
    const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
    const chatInputRef = useRef(null);

    // Voice Mode Overlay State
    const [voiceModeOpen, setVoiceModeOpen] = useState(false);

    // Prevent mic contention: suspend wake word while Voice Mode is active.
    const wakeWordActive = wakeWordEnabled && !voiceModeOpen;

    // Check if Firebase is configured and user is logged in
    const useFirebasePersistence = Boolean(
        user?.uid &&
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    );

    // Firebase Auth listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setAuthLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Initialize TTS on mount
    useEffect(() => {
        const setupTTS = async () => {
            if (isSpeechSynthesisSupported()) {
                setHasTTSSupport(true);
                await initTTS();
            }
        };
        setupTTS();
    }, []);

    // Sidebar visibility on resize
    useEffect(() => {
        const checkSize = () => {
            setIsSidebarOpen(window.innerWidth >= 768);
        };
        checkSize();
        window.addEventListener('resize', checkSize);
        return () => window.removeEventListener('resize', checkSize);
    }, []);

    // Scroll to end on chat update/generation
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chats, isAIGenerating]);

    // Load chats (Firestore when authed, otherwise localStorage)
    useEffect(() => {
        let cancelled = false;

        const loadFromLocalStorage = () => {
            try {
                const savedChats = localStorage.getItem('chats');
                if (savedChats) {
                    const parsedChats = JSON.parse(savedChats);
                    if (Array.isArray(parsedChats) && parsedChats.length > 0) {
                        if (!cancelled) {
                            setChats(parsedChats);
                            setActiveChatId(parsedChats[0].id);
                        }
                        return true;
                    }
                }
            } catch (error) {
                console.error('Failed to load chats from localStorage', error);
            }
            return false;
        };

        const loadFromFirestore = async () => {
            if (!user?.uid) return;

            console.log('[Firestore] Loading chats for user:', user.uid);

            try {
                const chatsRef = collection(db, 'chats');
                const q = query(
                    chatsRef,
                    where('userId', '==', user.uid),
                    orderBy('updatedAt', 'desc')
                );
                const snapshot = await getDocs(q);

                const loadedChats = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    messages: []
                }));

                console.log('[Firestore] Loaded chats:', loadedChats.length);

                if (cancelled) return;

                if (loadedChats.length === 0) {
                    // Create initial chat
                    const newChatRef = await addDoc(collection(db, 'chats'), {
                        userId: user.uid,
                        title: 'New Chat',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });

                    if (!cancelled) {
                        const newChat = { id: newChatRef.id, title: 'New Chat', messages: [] };
                        setChats([newChat]);
                        setActiveChatId(newChatRef.id);
                    }
                    return;
                }

                setChats(loadedChats);
                setActiveChatId(loadedChats[0].id);
            } catch (error) {
                console.error('[Firestore] Failed to load chats:', error);
                // Fallback to localStorage
                loadFromLocalStorage();
            }
        };

        (async () => {
            if (useFirebasePersistence) {
                await loadFromFirestore();
            } else {
                const loaded = loadFromLocalStorage();
                if (!loaded) createNewChat();
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useFirebasePersistence, user?.uid]);

    // Save chats to localStorage (guest mode only)
    useEffect(() => {
        if (useFirebasePersistence) return;
        if (chats.length > 0) {
            localStorage.setItem('chats', JSON.stringify(chats));
        } else {
            localStorage.removeItem('chats');
        }
    }, [chats, useFirebasePersistence]);

    // Load messages for the active chat (Firestore)
    useEffect(() => {
        if (!useFirebasePersistence || !activeChatId) return;

        // Ensure activeChatId is a valid string
        if (typeof activeChatId !== 'string' || !activeChatId.trim()) {
            console.warn('[Firestore] Invalid activeChatId:', activeChatId);
            return;
        }

        let cancelled = false;

        const loadMessages = async () => {
            try {
                const messagesRef = collection(db, 'chats', String(activeChatId), 'messages');
                const q = query(messagesRef, orderBy('createdAt', 'asc'));
                const snapshot = await getDocs(q);

                if (cancelled) return;

                const mapped = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    sender: doc.data().role,
                    text: doc.data().content,
                    images: doc.data().images || [],
                    created_at: doc.data().createdAt?.toDate?.()
                }));

                setChats((prevChats) =>
                    prevChats.map((chat) =>
                        chat.id === activeChatId ? { ...chat, messages: mapped } : chat
                    )
                );
            } catch (error) {
                console.error('Failed to load messages from Firestore', error);
            }
        };

        loadMessages();
        return () => {
            cancelled = true;
        };
    }, [useFirebasePersistence, activeChatId]);

    const createNewChat = async () => {
        // Reset backend memory for fresh conversation
        try {
            await fetch('/api/reset', { method: 'POST' });
        } catch (err) {
            console.error('Failed to reset backend memory:', err);
        }

        if (useFirebasePersistence) {
            try {
                const newChatRef = await addDoc(collection(db, 'chats'), {
                    userId: user.uid,
                    title: 'New Chat',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                const newChat = { id: newChatRef.id, title: 'New Chat', messages: [] };
                setChats((prev) => [newChat, ...prev]);
                setActiveChatId(newChatRef.id);
                return newChatRef.id;
            } catch (error) {
                console.error('Failed to create chat in Firestore', error);
                return null;
            }
        }

        // Use UUID for localStorage
        const newChatId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `local-${Date.now()}`;
        const newChat = {
            id: newChatId,
            title: 'New Chat',
            messages: [],
        };
        setChats((prev) => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        return newChat.id;
    };

    const handleDeleteChat = async () => {
        if (!chatToDelete) return;

        if (useFirebasePersistence) {
            try {
                // Delete messages subcollection first
                const messagesRef = collection(db, 'chats', chatToDelete, 'messages');
                const messagesSnapshot = await getDocs(messagesRef);
                const batch = writeBatch(db);
                messagesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();

                // Delete the chat document
                await deleteDoc(doc(db, 'chats', chatToDelete));
            } catch (e) {
                console.error('Failed to delete chat in Firestore', e);
            }
        }

        const newChats = chats.filter((chat) => chat.id !== chatToDelete);
        setChats(newChats);
        if (activeChatId === chatToDelete) {
            if (newChats.length > 0) {
                setActiveChatId(newChats[0].id);
            } else {
                createNewChat();
            }
        }
        setChatToDelete(null);
    };

    const handleDeleteAllChats = async () => {
        if (useFirebasePersistence) {
            try {
                // Delete all user's chats
                const chatsRef = collection(db, 'chats');
                const q = query(chatsRef, where('userId', '==', user.uid));
                const snapshot = await getDocs(q);

                for (const chatDoc of snapshot.docs) {
                    // Delete messages
                    const messagesRef = collection(db, 'chats', chatDoc.id, 'messages');
                    const messagesSnapshot = await getDocs(messagesRef);
                    const batch = writeBatch(db);
                    messagesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    // Delete chat
                    await deleteDoc(chatDoc.ref);
                }

                // Create new initial chat
                const newChatRef = await addDoc(collection(db, 'chats'), {
                    userId: user.uid,
                    title: 'New Chat',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                setChats([{ id: newChatRef.id, title: 'New Chat', messages: [] }]);
                setActiveChatId(newChatRef.id);
                setShowDeleteAllModal(false);
                return;
            } catch (e) {
                console.error('Delete-all failed', e);
            }
        }

        const newChatId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `local-${Date.now()}`;
        const newChat = { id: newChatId, title: 'New Chat', messages: [] };
        setChats([newChat]);
        setActiveChatId(newChat.id);
        setShowDeleteAllModal(false);
    };

    const handleRenameChat = async (chatId, newTitle) => {
        setChats(prevChats =>
            prevChats.map(chat =>
                chat.id === chatId ? { ...chat, title: newTitle } : chat
            )
        );

        if (useFirebasePersistence) {
            try {
                await updateDoc(doc(db, 'chats', chatId), {
                    title: newTitle,
                    updatedAt: serverTimestamp()
                });
            } catch (error) {
                console.error('Failed to rename chat in Firestore', error);
            }
        }
    };

    const handleStopGeneration = () => {
        runningRef.current = false;
        stopSpeaking();
        if (streamingTTSRef.current) {
            streamingTTSRef.current.stop();
            streamingTTSRef.current = null;
        }
        if (abortController) {
            abortController.abort();
            setIsAIGenerating(false);
            setAbortController(null);
        }
    };

    const updateChatMessages = (newMessages) => {
        setChats((prevChats) =>
            prevChats.map((chat) =>
                chat.id === activeChatId ? { ...chat, messages: newMessages } : chat
            )
        );
    };

    const handleEditMessage = (messageId, text) => {
        const activeChat = chats.find(c => c.id === activeChatId);
        if (!activeChat) return;

        const messageIndex = activeChat.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        setEditingMessage({ id: messageId, text, messageIndex });
    };

    const handleSendMessage = async ({ text, files, documents = [], inputMethod }) => {
        console.log('[handleSendMessage] Called with:', { text, filesCount: files.length, documentsCount: documents.length, inputMethod });

        let chatId = activeChatId;
        if (!chatId) {
            console.log('[handleSendMessage] No active chat, creating new one...');
            try {
                chatId = await createNewChat();
                console.log('[handleSendMessage] Created new chat:', chatId);
            } catch (err) {
                console.error('[handleSendMessage] Failed to create chat:', err);
            }
        }

        if (!chatId) {
            if (chats.length > 0) {
                chatId = chats[0].id;
            } else {
                alert('Please sign in or create a chat first');
                return;
            }
        }

        runningRef.current = true;
        // When Voice Mode overlay is open, it manages TTS itself.
        // Avoid double-speaking by disabling page-level streaming TTS.
        const shouldSpeak = inputMethod === 'voice' && hasTTSSupport && !voiceModeOpen;

        // Convert files to base64 for now (simplified - no Supabase storage)
        let imageUrls = [];
        for (const fileItem of files) {
            if (fileItem.file) {
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(fileItem.file);
                });
                imageUrls.push(base64);
            }
        }

        const userMessageId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : String(Date.now());

        const userMessage = {
            id: userMessageId,
            sender: 'user',
            text: text.trim(),
            images: imageUrls,
            documents: [],
        };

        let activeChat = chats.find((chat) => chat.id === chatId);
        if (!activeChat) {
            activeChat = { id: chatId, messages: [], title: 'New Chat' };
        }

        let baseMessages = activeChat?.messages || [];
        if (editingMessage?.messageIndex !== undefined) {
            // Delete truncated messages from Firestore
            if (useFirebasePersistence) {
                const toDelete = baseMessages.slice(editingMessage.messageIndex);
                for (const msg of toDelete) {
                    if (msg.id) {
                        try {
                            await deleteDoc(doc(db, 'chats', chatId, 'messages', msg.id));
                        } catch (e) {
                            console.error('Failed to delete message', e);
                        }
                    }
                }
            }
            baseMessages = baseMessages.slice(0, editingMessage.messageIndex);
        }

        const updatedMessages = [...baseMessages, userMessage];
        updateChatMessages(updatedMessages);
        setEditingMessage(null);
        setIsAIGenerating(true);

        // Persist user message to Firestore
        if (useFirebasePersistence) {
            try {
                await addDoc(collection(db, 'chats', chatId, 'messages'), {
                    role: 'user',
                    content: userMessage.text,
                    images: imageUrls.length ? imageUrls : null,
                    createdAt: serverTimestamp()
                });

                // Auto-title if still default
                const activeChatRow = chats.find((c) => c.id === chatId);
                const maybeTitle = (activeChatRow?.title && activeChatRow.title !== 'New Chat')
                    ? null
                    : (userMessage.text || '').slice(0, 40);

                await updateDoc(doc(db, 'chats', chatId), {
                    updatedAt: serverTimestamp(),
                    ...(maybeTitle ? { title: maybeTitle } : {})
                });

                if (maybeTitle) {
                    setChats(prev => prev.map(c => (c.id === chatId ? { ...c, title: maybeTitle } : c)));
                }
            } catch (error) {
                console.error('Failed to persist message to Firestore', error);
            }
        }

        const controller = new AbortController();
        setAbortController(controller);

        let modelToUse = selectedModel;
        let autoSelectReason = null;

        if (selectedModel === 'auto') {
            const hasImage = imageUrls.length > 0;
            const classification = classifyTask(userMessage.text, hasImage);
            modelToUse = classification.model;
            autoSelectReason = classification.reason;
        }

        // Run agent tools
        let toolResult = null;
        try {
            toolResult = await runAgentTools(text, user?.uid, null);
            if (toolResult) {
                console.log('[Agent] Tool executed:', toolResult);
            }
        } catch (e) {
            console.error('[Agent] Tool execution failed:', e);
        }

        try {
            let finalContent = text;

            if (documents?.length) {
                const docsBlock = documents
                    .map((doc, i) => {
                        const name = doc?.name ? String(doc.name) : `document-${i + 1}.pdf`;
                        const docText = doc?.text ? String(doc.text) : '';
                        return `[${name}]\n${docText}`;
                    })
                    .join('\n\n');

                finalContent += `\n\n<user_documents>\n${docsBlock}\n</user_documents>`;
            }

            if (toolResult) {
                finalContent += `\n\n<system_tool_output>\n${toolResult}\n</system_tool_output>`;
            }

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: finalContent,
                    file_data: imageUrls[0] || null,
                    model: modelToUse,
                    chat_id: String(chatId),
                    voice_mode: inputMethod === 'voice',
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                let errorText = `Error: ${res.status} ${res.statusText}`;
                try {
                    const errorData = await res.json();
                    errorText = errorData.details || errorData.error || errorText;
                } catch (e) { }
                throw new Error(errorText);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');

            let aiMessage = null;
            let aiMessageId = null;
            let actualModelUsed = modelToUse;

            if (shouldSpeak) {
                streamingTTSRef.current = createStreamingTTS();
            }

            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    if (shouldSpeak && streamingTTSRef.current) {
                        streamingTTSRef.current.finish();
                    }
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter((line) => line.trim() !== '');

                for (const line of lines) {
                    if (line === 'data: [DONE]' || line.includes('"event":"done"')) {
                        break;
                    }
                    try {
                        const json = JSON.parse(line.replace(/^data: /, ''));

                        if (json.event === 'meta') {
                            if (json.model) actualModelUsed = json.model;
                            setBackendMeta({
                                backend: json.backend || null,
                                model: json.model || null,
                                baseUrl: json.baseUrl || null,
                            });
                            continue;
                        }

                        if (json.token && runningRef.current) {
                            if (!aiMessage) {
                                aiMessageId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                                    ? crypto.randomUUID()
                                    : String(Date.now() + 1);
                                const modelDisplayName = getModelLabel(actualModelUsed);
                                const headerText = autoSelectReason
                                    ? `**${modelDisplayName}** _${autoSelectReason}_`
                                    : `**${modelDisplayName}**`;
                                aiMessage = {
                                    id: aiMessageId,
                                    sender: 'assistant',
                                    text: `${headerText}\n\n${json.token}`,
                                };
                                updateChatMessages([...updatedMessages, aiMessage]);
                            } else {
                                aiMessage.text += json.token;
                                setChats(prevChats => {
                                    return prevChats.map(chat => {
                                        if (chat.id !== chatId) return chat;
                                        const messages = chat.messages.slice(0, -1);
                                        return {
                                            ...chat,
                                            messages: [...messages, { ...aiMessage }],
                                        };
                                    });
                                });

                                if (shouldSpeak && streamingTTSRef.current) {
                                    streamingTTSRef.current.addChunk(aiMessage.text);
                                }
                            }
                        }

                        if (json.error) {
                            throw new Error(json.error);
                        }
                    } catch (err) {
                        if (err.message.includes('JSON')) {
                            console.warn('Invalid JSON chunk:', line);
                        } else {
                            throw err;
                        }
                    }
                }
            }

            // Persist assistant message
            if (useFirebasePersistence && aiMessage?.text) {
                try {
                    await addDoc(collection(db, 'chats', chatId, 'messages'), {
                        role: 'assistant',
                        content: aiMessage.text,
                        createdAt: serverTimestamp()
                    });

                    await updateDoc(doc(db, 'chats', chatId), {
                        updatedAt: serverTimestamp()
                    });
                } catch (error) {
                    console.error('Failed to persist assistant message', error);
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('[handleSendMessage] Generation stopped by user.');
            } else {
                console.error('[handleSendMessage] Error:', err.message);
                const errorResponseMessage = {
                    id: Date.now() + 1,
                    sender: 'assistant',
                    text: `Sorry, I ran into an error.\n\n**Details:**\n\`\`\`\n${err.message}\n\`\`\``,
                };
                updateChatMessages([...updatedMessages, errorResponseMessage]);
            }
        } finally {
            setIsAIGenerating(false);
            setAbortController(null);
        }
    };

    const activeChat = chats.find((chat) => chat.id === activeChatId);
    const lastMessage = activeChat?.messages[activeChat.messages.length - 1];
    const showTypingIndicator = isAIGenerating && lastMessage?.sender === 'user';

    const TypingIndicator = () => (
        <div className="flex items-start gap-4 p-4 my-2">
            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold bg-white/10 text-white">
                AI
            </div>
            <div className="flex-1 whitespace-pre-wrap pt-3.5 text-gray-200 flex items-center gap-1">
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" />
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-black text-white font-sans">
            {chatToDelete && (
                <DeleteConfirmationModal
                    onConfirm={handleDeleteChat}
                    onCancel={() => setChatToDelete(null)}
                    title="Delete Chat?"
                    message="Are you sure you want to delete this chat? This action cannot be undone."
                />
            )}
            {showDeleteAllModal && (
                <DeleteConfirmationModal
                    onConfirm={handleDeleteAllChats}
                    onCancel={() => setShowDeleteAllModal(false)}
                    title="Delete All Chats?"
                    message="Are you sure you want to delete all your chats? This action is permanent and cannot be undone."
                />
            )}
            <Sidebar
                chats={chats}
                onSelectChat={setActiveChatId}
                onCreateNewChat={createNewChat}
                activeChatId={activeChatId}
                onDeleteClick={setChatToDelete}
                onRenameChat={handleRenameChat}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                onDeleteAllClick={() => setShowDeleteAllModal(true)}
            />
            <div className="flex-1 flex flex-col h-screen bg-neutral-950">
                <header className="flex items-center justify-between p-3 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-full md:hidden hover:bg-white/10">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                            </svg>
                        </button>
                        <ModelSelector model={selectedModel} setModel={setSelectedModel} />
                        {backendMeta?.backend === 'gemini' && (
                            <div
                                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs md:text-sm font-medium bg-blue-500/10 text-blue-200 border border-blue-500/20 max-w-[55vw] md:max-w-none"
                                title="Cloud mode: Gemini 2.5 Flash is used regardless of your selected model."
                            >
                                <span className="hidden sm:inline">Cloud Only:</span>
                                <span className="sm:hidden">Cloud:</span>
                                <span className="font-semibold truncate">{getModelLabel(backendMeta.model || 'gemini-2.5-flash')}</span>
                                <span className="hidden md:inline text-blue-200/70">(other selections ignored)</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <WakeWordIndicator
                            enabled={wakeWordActive}
                            onWake={(command) => {
                                const message = (command && command.trim())
                                    ? command.trim()
                                    : "Hey! I just said your name.";
                                handleSendMessage({ text: message, files: [], inputMethod: 'voice' });
                            }}
                            onToggle={() => setWakeWordEnabled(!wakeWordEnabled)}
                        />
                        <UserMenu user={user} onOpenSettings={() => setShowSettings(true)} />
                    </div>
                </header>

                {!user ? (
                    <AuthOverlay />
                ) : (
                    <main className="flex-1 flex flex-col overflow-hidden relative">
                        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 md:py-6 px-4 md:px-20 lg:px-32">
                            {activeChat && activeChat.messages.length > 0 ? (
                                <>
                                    <div className="mx-auto w-full max-w-4xl space-y-4">
                                        {(() => {
                                            const lastUserMsgIndex = activeChat.messages
                                                .map((m, i) => m.sender === 'user' ? i : -1)
                                                .filter(i => i !== -1)
                                                .pop();

                                            return activeChat.messages.map((msg, index) => (
                                                <ChatMessage
                                                    key={msg.id}
                                                    message={msg}
                                                    user={user}
                                                    onEdit={!isAIGenerating && index === lastUserMsgIndex ? handleEditMessage : undefined}
                                                />
                                            ));
                                        })()}
                                        {showTypingIndicator && <TypingIndicator />}
                                        {(agentThinking || agentSteps.length > 0) && (
                                            <AgentStepVisualizer steps={agentSteps} isThinking={agentThinking} />
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                                    <div className="w-16 h-16 mb-4 bg-neutral-800 rounded-full flex items-center justify-center">
                                        <span className="text-2xl">✨</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-white mb-2">How can I help you?</h2>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 px-4 md:px-20 lg:px-32 w-full flex-shrink-0 bg-neutral-950/80 backdrop-blur-md">
                            <div className="w-full max-w-4xl mx-auto">
                                <ChatInput
                                    ref={chatInputRef}
                                    onSend={(data) => {
                                        handleSendMessage(data);
                                        setEditingMessage(null);
                                    }}
                                    disabled={isAIGenerating}
                                    onStop={handleStopGeneration}
                                    initialText={editingMessage?.text || ''}
                                    isEditing={Boolean(editingMessage)}
                                    onCancelEdit={() => setEditingMessage(null)}
                                    onOpenVoiceMode={() => setVoiceModeOpen(true)}
                                />
                            </div>
                        </div>
                    </main>
                )}
            </div>
            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} user={user} />

            <VoiceModeOverlay
                isOpen={voiceModeOpen}
                onClose={() => setVoiceModeOpen(false)}
                onSendMessage={(data) => handleSendMessage(data)}
                onStop={handleStopGeneration}
                isAIGenerating={isAIGenerating}
                lastAIMessage={
                    activeChat?.messages
                        ?.filter(m => m.sender === 'assistant')
                        ?.slice(-1)[0]?.text || ''
                }
            />
        </div>
    );
}

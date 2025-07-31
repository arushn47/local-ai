'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Helper Components ---

const ModelSelector = ({ model, setModel }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const models = [
        { value: 'llava:latest', label: 'Llava' },
        { value: 'deepseek-r1:latest', label: 'Deepseek R1' },
        { value: 'bakllava:latest', label: 'BakLlava' },
    ];

    const selectedModelLabel = models.find(m => m.value === model)?.label;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleOptionClick = (value) => {
        setModel(value);
        setIsOpen(false);
    };

    return (
        <div className="relative w-48" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-neutral-900 border border-white/10 rounded-full text-white text-sm font-medium pl-4 pr-10 py-2 w-full text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-neutral-800 transition-colors cursor-pointer"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <span>{selectedModelLabel}</span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 w-full bg-neutral-900 border border-white/10 rounded-2xl shadow-lg z-10 overflow-hidden animate-fade-in-up">
                    <ul>
                        {models.map((option) => (
                            <li
                                key={option.value}
                                onClick={() => handleOptionClick(option.value)}
                                className="px-4 py-2 text-sm text-white hover:bg-neutral-800 cursor-pointer transition-colors"
                            >
                                {option.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const DeleteConfirmationModal = ({ onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300">
        <div className="bg-neutral-900 rounded-3xl p-8 shadow-2xl border border-white/10 transform transition-all duration-300 scale-95 hover:scale-100">
            <h2 className="text-xl font-bold text-white mb-4">Delete Chat?</h2>
            <p className="text-gray-400 mb-6">
                Are you sure you want to delete this chat? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
                <button
                    onClick={onCancel}
                    className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 transform hover:scale-105"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="px-5 py-2 rounded-full bg-neutral-200 hover:bg-white text-black font-semibold transition-all duration-200 transform hover:scale-105"
                >
                    Delete
                </button>
            </div>
        </div>
    </div>
);

const Sidebar = ({ chats, onSelectChat, onCreateNewChat, activeChatId, onDeleteClick }) => (
    <div className="group relative w-14 hover:w-64 transition-all duration-300 ease-in-out bg-neutral-950 p-2 flex flex-col h-full border-r border-white/10">
        <div className="flex-shrink-0">
            <button
                onClick={onCreateNewChat}
                className="cursor-pointer w-full bg-white/5 hover:bg-white/10 text-white font-bold h-10 rounded-full mb-4 transition-all duration-300 flex items-center justify-center group-hover:justify-start group-hover:px-4 transform hover:scale-105 gap-2"
            >
                <span>
                    <svg className="w-6 h-6 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </span>
                <span className="opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto transition-all duration-200 delay-100 whitespace-nowrap overflow-hidden ">
                    New Chat
                </span>
            </button>
        </div>
        <div className="flex-grow overflow-y-auto overflow-x-hidden">
            <h2 className="text-xs font-semibold mb-2 text-gray-500 uppercase tracking-wider px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100">
                History
            </h2>
            <ul>
                {chats.map((chat) => (
                    <li key={chat.id} className="mb-2 relative chat-item">
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                onSelectChat(chat.id);
                            }}
                            className={`flex items-center h-10 rounded-full text-sm transition-colors w-full ${activeChatId === chat.id ? 'bg-white/10' : 'hover:bg-white/5'
                                } gap-2`}
                        >
                            <span className="w-12 h-12  flex-shrink-0 flex items-center justify-center">
                                <svg
                                    className="w-5 h-5 mr-2 group-hover:mr-0 group-hover:ml-2 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                    />
                                </svg>
                            </span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap truncate text-gray-300 pr-4">
                                {chat.messages[0]?.text?.slice(0, 30) || 'New Chat'}
                            </span>
                        </a>
                        <button
                            onClick={() => onDeleteClick(chat.id)}
                            className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-500 hover:bg-white/5 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

const ChatInput = ({ onSend, disabled, onStop }) => {
    const [input, setInput] = useState('');
    const [files, setFiles] = useState([]);
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    const handleFileChange = (newFiles) => {
        const imageFiles = Array.from(newFiles).filter(file => file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
            setFiles(prev => [...prev, ...imageFiles]);
        }
    };

    useEffect(() => {
        const handleDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                setIsDragging(true);
            }
        };

        const handleDragLeave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!e.relatedTarget || e.relatedTarget.nodeName === "HTML") {
                setIsDragging(false);
            }
        };

        const handleDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileChange(e.dataTransfer.files);
                e.dataTransfer.clearData();
            }
        };

        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('drop', handleDrop);
        };
    }, []);


    const handleSend = () => {
        if (!input.trim() && files.length === 0) return;
        onSend({ text: input, files });
        setInput('');
        setFiles([]);
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            {isDragging && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center pointer-events-none">
                    <div className="bg-white/90 text-black px-6 py-3 rounded-xl text-lg font-medium border border-gray-300 shadow-lg">
                        Drop image(s) to upload
                    </div>
                </div>
            )}

            {files.length > 0 && (
                <div className="mb-2 p-2 bg-neutral-800/50 rounded-2xl flex items-center gap-4 overflow-x-auto animate-fade-in-up">
                    {files.map((file, index) => (
                        <div key={index} className="relative flex-shrink-0">
                            <img
                                src={URL.createObjectURL(file)}
                                alt="Upload preview"
                                className="w-20 h-20 object-cover rounded-xl border-2 border-white/10"
                            />
                            <button
                                onClick={() => removeFile(index)}
                                className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-600 text-white hover:bg-red-700"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="relative flex items-center bg-neutral-900/80 border border-white/10 rounded-xl shadow-sm  focus-within:ring-2 focus-within:ring-white/20 transition-shadow">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer ml-2 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Upload image"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
                <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={(e) => handleFileChange(e.target.files)}
                    accept="image/png, image/jpeg"
                    className="hidden"
                />
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Send a message..."
                    rows={1}
                    className="flex-1 bg-transparent text-white placeholder-neutral-500 focus:outline-none resize-none px-2 py-3.5"
                    style={{ maxHeight: '200px' }}
                    disabled={disabled}
                />
                {disabled ? (
                    <button
                        onClick={onStop}
                        className="cursor-pointer bg-white/10 text-white w-11 h-11 rounded-full flex items-center justify-center mr-1 mb-1 hover:bg-white/20 transition-colors self-end"
                        aria-label="Stop generation"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 5a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1V5z" clipRule="evenodd" />
                        </svg>
                    </button>
                ) : (
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() && files.length === 0}
                        className="cursor-pointer bg-white text-black w-11 h-11 mr-1 mb-1 rounded-full flex items-center justify-center disabled:bg-neutral-800 disabled:text-gray-500 disabled:cursor-not-allowed hover:bg-gray-200 transition-all duration-200 self-end transform"
                        aria-label="Send message"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};


const CopyableCodeBlock = ({ code, language = 'java' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
        document.body.removeChild(textArea);
    };

    return (
        <div
            className="relative bg-neutral-900 border border-white/10 text-white rounded-lg p-4 mb-4 group"
            tabIndex={0}
        >
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-2 rounded-lg bg-neutral-800 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-neutral-700"
                aria-label="Copy code"
            >
                {copied ? (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-green-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                )}
            </button>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                <code className={`language-${language}`}>{code}</code>
            </pre>
        </div>
    );
};

const ChatMessage = ({ message }) => {
    const { text, sender, images, thinking } = message;
    const isUser = sender === 'user';

    return (
        <div className={`flex items-start gap-4 p-4 my-2 animate-fade-in-up ${isUser ? 'justify-end' : ''}`}>
            {!isUser && (
                <div
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg shadow-md bg-neutral-700 text-white"
                >
                    AI
                </div>
            )}

            <div className={`flex flex-col gap-2 max-w-prose ${isUser ? 'items-end' : 'items-start'}`}>
                {thinking && (
                    <details className="mb-3 bg-neutral-900/50 border border-white/10 rounded-lg">
                        <summary className="cursor-pointer p-3 text-sm text-gray-400 font-medium list-none flex items-center gap-2 hover:text-white">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Show thinking
                        </summary>
                        <pre className="p-4 pt-0 text-gray-300 text-xs whitespace-pre-wrap font-sans">{thinking}</pre>
                    </details>
                )}

                {images && images.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        {images.map((image, index) => (
                            <img key={index} src={image} alt={`User upload ${index + 1}`} className="w-auto h-auto max-w-xs max-h-48 rounded-2xl border-2 border-white/10" />
                        ))}
                    </div>
                )}

                {text && (
                    <div className={`p-4 rounded-3xl ${isUser ? 'bg-neutral-600 text-white rounded-br-none' : 'bg-neutral-800 rounded-bl-none'}`}>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                p({ node, children }) {
                                    // Only render <p> when children are not a block code element.
                                    // If this paragraph only contains a code block, skip the <p>
                                    if (
                                        node.children &&
                                        node.children.length === 1 &&
                                        node.children[0].tagName === 'code'
                                    ) {
                                        return <>{children}</>;
                                    }
                                    return <p className="mb-2 last:mb-0">{children}</p>;
                                },
                                code({ node, inline, className, children, ...props }) {
                                    const language = /language-(\w+)/.exec(className || '')?.[1] || '';
                                    if (!inline) {
                                        return (
                                            <CopyableCodeBlock
                                                code={String(children).replace(/\n$/, '')}
                                                language={language}
                                            />
                                        );
                                    }
                                    return (
                                        <code className="bg-black/20 px-1 py-0.5 rounded-sm" {...props}>
                                            {children}
                                        </code>
                                    );
                                },
                            }}
                        >
                            {text}
                        </ReactMarkdown>


                    </div>
                )}
            </div>
            {isUser && (
                <div
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg shadow-md bg-white text-black"
                >
                    AN
                </div>
            )}
        </div>
    );
};

// --- Main App Component ---

export default function App() {
    const [chats, setChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [isAIGenerating, setIsAIGenerating] = useState(false);
    const [chatToDelete, setChatToDelete] = useState(null);
    const [abortController, setAbortController] = useState(null);
    const [selectedModel, setSelectedModel] = useState('llava:latest');
    const chatEndRef = useRef(null);
    const runningRef = useRef(true);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chats, isAIGenerating]);

    useEffect(() => {
        try {
            const savedChats = localStorage.getItem('chats');
            if (savedChats) {
                const parsedChats = JSON.parse(savedChats);
                if (parsedChats.length > 0) {
                    setChats(parsedChats);
                    setActiveChatId(parsedChats[0].id);
                    return;
                }
            }
        } catch (error) {
            console.error('Failed to load chats from localStorage', error);
        }
        createNewChat();
    }, []);

    useEffect(() => {
        if (chats.length > 0) {
            localStorage.setItem('chats', JSON.stringify(chats));
        } else {
            localStorage.removeItem('chats');
        }
    }, [chats]);

    const createNewChat = async () => {
        try {
            await fetch('/api/reset', { method: 'POST' });

            const newChat = {
                id: Date.now(),
                messages: [],
            };
            setChats((prev) => [newChat, ...prev]);
            setActiveChatId(newChat.id);
        } catch (err) {
            console.error('Failed to reset backend memory:', err);
        }
    };

    const handleDeleteChat = () => {
        if (!chatToDelete) return;
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

    const handleStopGeneration = () => {
        runningRef.current = false;
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

    const handleSendMessage = async ({ text, files }) => {
        runningRef.current = true;

        const imagePromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        const images = await Promise.all(imagePromises);

        const userMessage = {
            id: Date.now(),
            sender: 'user',
            text: text.trim(),
            images: images,
        };

        const activeChat = chats.find((chat) => chat.id === activeChatId);
        const updatedMessages = [...(activeChat?.messages || []), userMessage];

        updateChatMessages(updatedMessages);
        setIsAIGenerating(true);

        const controller = new AbortController();
        setAbortController(controller);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: userMessage.text,
                    image_data: images[0] || null, // Sending only the first image for now
                    model: selectedModel,
                }),
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
            });

            if (!res.ok) {
                let errorText = `Error: ${res.status} ${res.statusText}`;
                try {
                    const errorData = await res.json();
                    errorText = errorData.details || errorData.error || errorText;
                } catch (e) {
                    // Not a JSON response, do nothing extra
                }
                throw new Error(errorText);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');

            let aiMessage = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter((line) => line.trim() !== '');

                for (const line of lines) {
                    if (line === 'data: [DONE]' || line.includes('"event":"done"')) {
                        break;
                    }
                    try {
                        const json = JSON.parse(line.replace(/^data: /, ''));

                        if (json.token && runningRef.current) {
                            if (!aiMessage) {
                                aiMessage = {
                                    id: Date.now() + 1,
                                    sender: 'assistant',
                                    text: `**[${selectedModel}]**\n\n${json.token}`,
                                };
                                updateChatMessages([...updatedMessages, aiMessage]);
                            } else {
                                aiMessage.text += json.token;

                                setChats(prevChats => {
                                    return prevChats.map(chat => {
                                        if (chat.id !== activeChatId) return chat;

                                        const messages = chat.messages.slice(0, -1);
                                        return {
                                            ...chat,
                                            messages: [...messages, { ...aiMessage }],
                                        };
                                    });
                                });
                            }
                        }

                    } catch (err) {
                        console.error('Invalid JSON chunk:', line);
                    }
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('Generation stopped.');
            } else {
                console.error('Error details:', err.message);
                const errorResponseMessage = {
                    id: Date.now() + 1,
                    sender: 'assistant',
                    text: err.message, // Use the detailed error message
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
                />
            )}
            <Sidebar
                chats={chats}
                onSelectChat={setActiveChatId}
                onCreateNewChat={createNewChat}
                activeChatId={activeChatId}
                onDeleteClick={setChatToDelete}
            />
            <div className="flex-1 flex flex-col h-screen bg-neutral-950">
                <header className="flex items-center justify-between p-3 border-b border-white/10 flex-shrink-0">
                    <ModelSelector model={selectedModel} setModel={setSelectedModel} />
                    <div className="flex items-center gap-3">
                        <span className="text-md font-medium text-gray-300">Arush Nandakumar Menon</span>
                        <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm">
                            AN
                        </div>
                    </div>
                </header>
                <main className="flex-1 flex flex-col overflow-hidden">
                    {activeChat && activeChat.messages.length > 0 ? (
                        <>
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="max-w-3xl mx-auto">
                                    {activeChat.messages.map((msg) => (
                                        <ChatMessage key={msg.id} message={msg} />
                                    ))}

                                    {showTypingIndicator && <TypingIndicator />}

                                    <div ref={chatEndRef} />
                                </div>
                            </div>
                            <div className="p-6 bg-neutral-950/50 backdrop-blur-sm border-t border-white/10">
                                <ChatInput
                                    onSend={handleSendMessage}
                                    disabled={isAIGenerating}
                                    onStop={handleStopGeneration}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-neutral-950">
                            <div className="w-full max-w-3xl flex flex-col items-center text-center">
                                <div className="w-16 h-16 mb-2 bg-neutral-800 rounded-full flex items-center justify-center shadow-lg">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
                                    </svg>
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                                    What's on the agenda today?
                                </h2>
                                <p className="text-gray-400 mb-6">Start a new conversation or upload an image to begin.</p>
                                <div className="w-full">
                                    <ChatInput
                                        onSend={handleSendMessage}
                                        disabled={isAIGenerating}
                                        onStop={handleStopGeneration}
                                    />
                                    {isAIGenerating && <div className="text-gray-400 mt-2">AI is typing...</div>}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

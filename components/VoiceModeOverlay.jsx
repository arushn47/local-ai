'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconMicrophone, IconMicrophoneOff, IconX, IconUser } from '@tabler/icons-react';
import {
    startListening,
    stopListening,
    isSpeechRecognitionSupported,
    speak,
    stopSpeaking,
    initTTS,
    isSpeechSynthesisSupported
} from '@/utils/voiceUtils';

/**
 * VoiceModeOverlay - Full-screen voice conversation interface
 */
export default function VoiceModeOverlay({
    isOpen,
    onClose,
    onSendMessage,
    onStop,
    isAIGenerating,
    lastAIMessage
}) {
    const [isMuted, setIsMuted] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [status, setStatus] = useState('idle');
    const [hasGreeted, setHasGreeted] = useState(false);
    const [waitingForResponse, setWaitingForResponse] = useState(false);
    const [messages, setMessages] = useState([]);
    const [lastProcessedMessage, setLastProcessedMessage] = useState('');

    const chatEndRef = useRef(null);
    const statusRef = useRef(status);
    const interruptRecognitionRef = useRef(null);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, transcript]);

    // Clean model prefixes and markdown from text
    const cleanText = (text) => {
        if (!text) return '';
        return text
            // Remove model identification prefixes
            .replace(/^\*\*Qwen[^*]*\*\*\s*/gi, '')
            .replace(/^\*\*[^*]+\*\*\s*_[^_]+_\s*/gi, '')  // "**Model** _action_"
            .replace(/^Qwen[^:]*:\s*/gi, '')
            .replace(/^_[^_]+_\s*/gi, '')  // "_Casual greeting detected_"
            // Remove markdown
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/_/g, '')
            .replace(/`/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/#{1,6}\s/g, '')
            .trim();
    };

    // Greeting on open
    useEffect(() => {
        if (isOpen && !hasGreeted) {
            const greeting = "Hello! How can I help you today?";
            setStatus('speaking');
            setMessages([{ role: 'assistant', text: greeting }]);

            const greet = async () => {
                if (isSpeechSynthesisSupported()) {
                    await initTTS();
                    speak(greeting, () => {
                        setStatus('listening');
                        startListeningMode();
                    });
                } else {
                    setTimeout(() => {
                        setStatus('listening');
                        startListeningMode();
                    }, 1500);
                }
            };
            greet();
            setHasGreeted(true);
        }
    }, [isOpen, hasGreeted]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setTranscript('');
            setMessages([]);
            setStatus('idle');
            setHasGreeted(false);
            setWaitingForResponse(false);
            setLastProcessedMessage('');
            stopListening();
            stopSpeaking();
            stopInterruptListening();
        }
    }, [isOpen]);

    // Watch for AI response - prevent duplicates
    useEffect(() => {
        if (isOpen && waitingForResponse && !isAIGenerating && lastAIMessage) {
            // Check if this is a new message (prevent duplicates)
            if (lastAIMessage === lastProcessedMessage) return;

            setWaitingForResponse(false);
            setLastProcessedMessage(lastAIMessage);
            const cleanedResponse = cleanText(lastAIMessage);

            setMessages(prev => [...prev, { role: 'assistant', text: cleanedResponse }]);
            setStatus('speaking');

            // Start listening for "stop" while speaking
            startInterruptListening();

            if (isSpeechSynthesisSupported()) {
                speak(cleanedResponse, () => {
                    stopInterruptListening();
                    setStatus('listening');
                    if (!isMuted) {
                        setTimeout(() => startListeningMode(), 500);
                    }
                });
            } else {
                setTimeout(() => {
                    stopInterruptListening();
                    setStatus('listening');
                    if (!isMuted) {
                        startListeningMode();
                    }
                }, 2000);
            }
        }
    }, [isAIGenerating, lastAIMessage, isOpen, waitingForResponse, isMuted, lastProcessedMessage]);

    // Listen for "stop" command while AI is speaking (only if not muted)
    const startInterruptListening = useCallback(() => {
        if (!isSpeechRecognitionSupported() || isMuted) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const text = result[0].transcript.toLowerCase().trim();

            if (text.includes('stop') || text.includes('wait') || text.includes('pause') || text.includes('hold on')) {
                console.log('[VoiceMode] Stop command detected');
                stopSpeaking();
                stopInterruptListening();
                setStatus('listening');
                setTimeout(() => startListeningMode(), 300);
            }
        };

        recognition.onerror = () => { };
        recognition.onend = () => { };

        try {
            recognition.start();
            interruptRecognitionRef.current = recognition;
        } catch (e) { }
    }, [isMuted]);

    const stopInterruptListening = useCallback(() => {
        if (interruptRecognitionRef.current) {
            try {
                interruptRecognitionRef.current.stop();
            } catch (e) { }
            interruptRecognitionRef.current = null;
        }
    }, []);

    // Start listening
    const startListeningMode = useCallback(() => {
        if (!isSpeechRecognitionSupported() || isMuted) return;

        setTranscript('');
        setStatus('listening');

        startListening(
            (text, isFinal) => {
                setTranscript(text);

                if (isFinal && text.trim()) {
                    setMessages(prev => [...prev, { role: 'user', text: text.trim() }]);
                    setTranscript('');
                    setStatus('processing');
                    setWaitingForResponse(true);

                    onSendMessage({
                        text: text.trim(),
                        files: [],
                        inputMethod: 'voice'
                    });
                }
            },
            () => {
                const currentStatus = statusRef.current;
                if (!isMuted && currentStatus === 'listening') {
                    setTimeout(() => {
                        if (!isMuted && statusRef.current === 'listening') {
                            startListeningMode();
                        }
                    }, 300);
                }
            },
            (error) => {
                if (error !== 'aborted' && error !== 'no-speech') {
                    console.warn('[VoiceMode] Error:', error);
                }
            }
        );
    }, [isMuted, onSendMessage]);

    // Toggle mute
    const toggleMute = () => {
        if (isMuted) {
            setIsMuted(false);
            if (status === 'listening' || status === 'idle') {
                startListeningMode();
            }
        } else {
            setIsMuted(true);
            stopListening();
        }
    };

    // End session
    const endSession = () => {
        stopListening();
        stopSpeaking();
        stopInterruptListening();
        onStop?.();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-purple-500/10">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-purple-300/70 text-sm font-medium">Voice Mode</span>
                    <span className="text-purple-500/40 text-xs">• Say &quot;stop&quot; to pause</span>
                </div>
                <button
                    onClick={endSession}
                    className="p-2 rounded-full hover:bg-purple-500/10 text-purple-300/50 hover:text-purple-300 transition-all"
                    title="End session"
                >
                    <IconX size={20} />
                </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-2xl mx-auto space-y-4">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-bold">LM</span>
                                </div>
                            )}
                            <div
                                className={`max-w-[80%] px-4 py-3 rounded-2xl ${msg.role === 'user'
                                    ? 'bg-purple-500/20 text-purple-100 rounded-tr-sm'
                                    : 'bg-white/5 text-gray-100 rounded-tl-sm'
                                    }`}
                            >
                                <p className="text-base leading-relaxed">{msg.text}</p>
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center flex-shrink-0">
                                    <IconUser size={16} className="text-purple-300" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Live typing */}
                    {transcript && (
                        <div className="flex gap-3 justify-end">
                            <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-purple-500/10 text-purple-200/70 rounded-tr-sm border border-purple-500/20">
                                <p className="text-base italic">{transcript}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center flex-shrink-0">
                                <IconUser size={16} className="text-purple-300" />
                            </div>
                        </div>
                    )}

                    {/* Thinking */}
                    {status === 'processing' && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">LM</span>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/5 rounded-tl-sm">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="p-6 flex flex-col items-center gap-4 bg-gradient-to-t from-purple-950/20 to-transparent">
                {/* Orb */}
                <div
                    className={`w-16 h-16 rounded-full transition-all duration-500 flex items-center justify-center ${status === 'speaking'
                        ? 'bg-gradient-to-br from-purple-500 to-violet-600 shadow-[0_0_40px_rgba(139,92,246,0.5)] scale-110'
                        : status === 'listening'
                            ? 'bg-gradient-to-br from-purple-400 to-purple-600 shadow-[0_0_30px_rgba(139,92,246,0.3)] animate-pulse'
                            : status === 'processing'
                                ? 'bg-gradient-to-br from-violet-400 to-purple-600 shadow-[0_0_30px_rgba(139,92,246,0.3)]'
                                : 'bg-purple-900/50'
                        }`}
                >
                    <IconMicrophone size={24} className="text-white" />
                </div>

                {/* Status */}
                <p className="text-purple-300/60 text-sm">
                    {status === 'speaking' && 'Speaking... (say "stop" to pause)'}
                    {status === 'listening' && (isMuted ? 'Muted' : 'Listening...')}
                    {status === 'processing' && 'Thinking...'}
                    {status === 'idle' && 'Ready'}
                </p>

                {/* Controls */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={endSession}
                        className="p-3 rounded-full bg-white/5 hover:bg-red-500/20 text-purple-300 hover:text-red-300 transition-all"
                        title="End session"
                    >
                        <IconX size={22} />
                    </button>

                    <button
                        onClick={toggleMute}
                        className={`p-3 rounded-full transition-all ${isMuted
                            ? 'bg-red-500/30 text-red-300 hover:bg-red-500/40'
                            : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                            }`}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <IconMicrophoneOff size={22} /> : <IconMicrophone size={22} />}
                    </button>
                </div>
            </div>
        </div>
    );
}

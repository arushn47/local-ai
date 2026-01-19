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
    const lastProcessedMessageRef = useRef('');

    const chatEndRef = useRef(null);
    const statusRef = useRef(status);
    const interruptRecognitionRef = useRef(null);
    const interruptWantedRef = useRef(false);

    // Anti-echo: avoid transcribing/sending the assistant's own TTS.
    const ignoreSttUntilRef = useRef(0);
    const lastAssistantNormRef = useRef('');

    // Voice input buffering: wait for a pause before sending.
    const draftRef = useRef('');
    const silenceTimerRef = useRef(null);
    const lastSentRef = useRef('');

    const SILENCE_MS_TO_SEND = 3000;

    const normalize = (text) => {
        return (text || '')
            .toLowerCase()
            .replace(/[\u2019']/g, "'")
            .replace(/\s+/g, ' ')
            .replace(/[^a-z0-9\s']/g, '')
            .trim();
    };

    const clearSilenceTimer = () => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    };

    const commitDraftIfReady = useCallback(() => {
        if (Date.now() < ignoreSttUntilRef.current) return;

        const text = (draftRef.current || '').trim();
        const norm = normalize(text);

        if (!text || !norm) return;

        // If STT picked up the assistant's own last message, don't send it back.
        if (
            lastAssistantNormRef.current &&
            norm.length >= 12 &&
            lastAssistantNormRef.current.includes(norm)
        ) {
            draftRef.current = '';
            setTranscript('');
            clearSilenceTimer();
            return;
        }

        if (norm === lastSentRef.current) {
            // Avoid duplicate sends from repeated final/interim events.
            return;
        }

        lastSentRef.current = norm;

        // Stop listening while processing/requesting.
        stopListening();
        clearSilenceTimer();

        setMessages(prev => [...prev, { role: 'user', text }]);
        setTranscript('');
        draftRef.current = '';
        setStatus('processing');
        setWaitingForResponse(true);

        onSendMessage({
            text,
            files: [],
            inputMethod: 'voice'
        });
    }, [onSendMessage]);

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
            lastProcessedMessageRef.current = '';
            stopListening();
            stopSpeaking();
            stopInterruptListening();
            clearSilenceTimer();
            draftRef.current = '';
            lastSentRef.current = '';
            ignoreSttUntilRef.current = 0;
            lastAssistantNormRef.current = '';
        }
    }, [isOpen]);

    // Watch for AI response - prevent duplicates
    useEffect(() => {
        if (isOpen && waitingForResponse && !isAIGenerating && lastAIMessage) {
            setWaitingForResponse(false);
            const cleanedResponse = cleanText(lastAIMessage);

            // Check if this is a new message (prevent duplicates).
            // Use a ref guard so we don't rely on async state updates.
            if (!cleanedResponse) return;
            if (cleanedResponse === lastProcessedMessageRef.current) return;
            lastProcessedMessageRef.current = cleanedResponse;
            setLastProcessedMessage(cleanedResponse);
            lastAssistantNormRef.current = normalize(cleanedResponse);

            setMessages(prev => [...prev, { role: 'assistant', text: cleanedResponse }]);
            setStatus('speaking');

            if (isSpeechSynthesisSupported()) {
                speak(cleanedResponse, () => {
                    setStatus('listening');
                    if (!isMuted) {
                        // Give the mic a moment to settle so we don't re-transcribe our own TTS.
                        ignoreSttUntilRef.current = Date.now() + 1200;
                        setTimeout(() => startListeningMode(), 1200);
                    }
                });
            } else {
                setTimeout(() => {
                    setStatus('listening');
                    if (!isMuted) {
                        ignoreSttUntilRef.current = Date.now() + 800;
                        startListeningMode();
                    }
                }, 2000);
            }
        }
    }, [isAIGenerating, lastAIMessage, isOpen, waitingForResponse, isMuted, lastProcessedMessage]);

    // Listen for "stop"/barge-in while AI is generating or speaking (only if not muted)
    const startInterruptListening = useCallback(() => {
        if (!isSpeechRecognitionSupported() || isMuted) return;

        // Avoid multiple recognition sessions.
        if (interruptRecognitionRef.current) return;
        interruptWantedRef.current = true;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const text = result[0].transcript.toLowerCase().trim();
            const isFinal = result.isFinal;

            // If the user starts talking while the AI is speaking, treat it as an interruption.
            // Use keywords first (most reliable), otherwise require a bit more substance.
            const isStopKeyword =
                text.includes('stop') ||
                text.includes('wait') ||
                text.includes('pause') ||
                text.includes('hold on');

            const wordCount = text.split(/\s+/).filter(Boolean).length;
            // For non-keyword interruption, require a final result to reduce false triggers
            // from TTS audio bleeding into the mic.
            const isBargeIn = isFinal && wordCount >= 2 && text.length >= 6;

            if (isStopKeyword || isBargeIn) {
                console.log('[VoiceMode] Interruption detected');
                // Stop both voice + generation
                onStop?.();
                stopSpeaking();
                stopInterruptListening();
                setWaitingForResponse(false);
                setStatus('listening');
                if (!isMuted) {
                    setTimeout(() => startListeningMode(), 300);
                }
            }
        };

        recognition.onerror = () => { };
        recognition.onend = () => {
            interruptRecognitionRef.current = null;
            if (!interruptWantedRef.current) return;
            if (isMuted) return;
            setTimeout(() => {
                if (interruptWantedRef.current && !interruptRecognitionRef.current) {
                    startInterruptListening();
                }
            }, 300);
        };

        try {
            recognition.start();
            interruptRecognitionRef.current = recognition;
        } catch (e) { }
    }, [isMuted, onStop]);

    const stopInterruptListening = useCallback(() => {
        interruptWantedRef.current = false;
        if (interruptRecognitionRef.current) {
            try {
                interruptRecognitionRef.current.stop();
            } catch (e) { }
            interruptRecognitionRef.current = null;
        }
    }, []);

    // Keep interruption listener active while AI is generating or speaking.
    useEffect(() => {
        if (!isOpen || isMuted) {
            stopInterruptListening();
            return;
        }

        const shouldInterruptListen = status === 'speaking' || (waitingForResponse && isAIGenerating);
        if (shouldInterruptListen) {
            startInterruptListening();
        } else {
            stopInterruptListening();
        }
    }, [isOpen, isMuted, status, waitingForResponse, isAIGenerating, startInterruptListening, stopInterruptListening]);

    // Start listening
    const startListeningMode = useCallback(() => {
        if (!isSpeechRecognitionSupported() || isMuted) return;

        // Ensure any previous timers are cleared and draft reset.
        clearSilenceTimer();
        draftRef.current = '';
        setTranscript('');
        setStatus('listening');

        startListening(
            (text, isFinal) => {
                if (Date.now() < ignoreSttUntilRef.current) return;

                const trimmed = (text || '').trim();
                draftRef.current = trimmed;
                setTranscript(trimmed);

                // Debounce: send only after a clear pause.
                // If recognition emits a final result quickly (short pauses), we still wait.
                clearSilenceTimer();
                if (trimmed) {
                    silenceTimerRef.current = setTimeout(() => {
                        if (statusRef.current !== 'listening' || isMuted) return;
                        commitDraftIfReady();
                    }, SILENCE_MS_TO_SEND);
                }

                // If it's final but empty, don't do anything.
                if (isFinal && !trimmed) {
                    // no-op
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
            ,
            { continuous: true, interimResults: true, lang: 'en-US' }
        );
    }, [isMuted, onSendMessage, commitDraftIfReady]);

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

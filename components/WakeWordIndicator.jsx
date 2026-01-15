'use client';

import React, { useState, useEffect } from 'react';
import { IconMicrophone, IconMicrophoneOff, IconAlertTriangle } from '@tabler/icons-react';

/**
 * Wake Word Indicator Component
 * Shows listening status with pulsing animation
 * Includes DEMO ONLY banner when enabled
 */

// Lazy import hook to avoid SSR issues
const useWakeWordLazy = (onWake, enabled) => {
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const [isSupported, setIsSupported] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const listenerRef = React.useRef(null);
    const enabledRef = React.useRef(enabled);

    // Keep enabledRef in sync
    enabledRef.current = enabled;

    useEffect(() => {
        // Only run on client
        const checkSupport = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        setIsSupported(checkSupport);
        console.log('[WakeWord UI] Support check:', checkSupport);

        if (!checkSupport) return;

        // Dynamically import the listener
        import('@/utils/wakeWord').then(({ createWakeWordListener }) => {
            console.log('[WakeWord UI] Creating listener...');
            listenerRef.current = createWakeWordListener(
                (command) => {
                    console.log('[WakeWord UI] Wake detected! Command:', command);
                    onWake(command);
                },
                {
                    onStatusChange: (s) => {
                        console.log('[WakeWord UI] Status:', s);
                        setStatus(s);
                    },
                    onError: (e) => {
                        console.log('[WakeWord UI] Error:', e);
                        setError(e);
                    }
                }
            );
            setIsReady(true);

            // If already enabled when listener is ready, start immediately
            if (enabledRef.current) {
                console.log('[WakeWord UI] Auto-starting (was enabled during init)');
                listenerRef.current.start();
            }
        });

        return () => {
            if (listenerRef.current) {
                listenerRef.current.stop();
            }
        };
    }, []); // Only run once on mount

    useEffect(() => {
        if (!isReady || !listenerRef.current) {
            console.log('[WakeWord UI] Not ready yet, enabled:', enabled);
            return;
        }

        console.log('[WakeWord UI] Enabled changed:', enabled);
        if (enabled) {
            listenerRef.current.start();
        } else {
            listenerRef.current.stop();
        }
    }, [enabled, isReady]);

    return {
        status,
        error,
        isSupported,
        isListening: status === 'listening'
    };
};

export default function WakeWordIndicator({ enabled, onWake, onToggle }) {
    const [mounted, setMounted] = useState(false);
    const { status, error, isSupported, isListening } = useWakeWordLazy(onWake, enabled);

    // Avoid hydration mismatch by not rendering until mounted
    useEffect(() => {
        setMounted(true);
    }, []);

    // Render nothing on server and first client render to match
    if (!mounted) {
        return <div className="w-10 h-10" />; // Placeholder with same size
    }

    if (!isSupported) {
        return null; // Don't show if not supported
    }

    return (
        <div className="relative">
            {/* Demo Banner - shows when enabled */}
            {enabled && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs">
                        <IconAlertTriangle className="w-3 h-3" />
                        <span>Demo Only - Cloud STT</span>
                    </div>
                </div>
            )}

            {/* Main Button */}
            <button
                onClick={onToggle}
                className={`
                    relative flex items-center justify-center w-10 h-10 rounded-full
                    transition-all duration-300
                    ${enabled
                        ? 'bg-green-500/20 border-2 border-green-500/50'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'}
                `}
                title={enabled ? 'Disable wake word (Hey LocalMind)' : 'Enable wake word (Hey LocalMind)'}
            >
                {/* Pulsing ring when listening */}
                {isListening && (
                    <>
                        <span className="absolute inset-0 rounded-full bg-green-500/30 animate-ping" />
                        <span className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse" />
                    </>
                )}

                {/* Icon */}
                {enabled ? (
                    <IconMicrophone className={`w-5 h-5 relative z-10 ${isListening ? 'text-green-400' : 'text-green-300'}`} />
                ) : (
                    <IconMicrophoneOff className="w-5 h-5 text-white/50" />
                )}
            </button>

            {/* Status tooltip */}
            {enabled && status !== 'listening' && status !== 'idle' && (
                <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className={`
                        text-xs px-2 py-0.5 rounded
                        ${status === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/50'}
                    `}>
                        {status === 'wake_detected' && '✨ Wake detected!'}
                        {status === 'error' && (error || 'Error')}
                        {status === 'auto_disabled' && 'Auto-disabled'}
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * Settings panel for wake word configuration
 */
export function WakeWordSettings({ enabled, onToggle }) {
    const isSupported = typeof window !== 'undefined' && isWakeWordSupported();

    return (
        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <IconMicrophone className="w-5 h-5 text-purple-400" />
                    <span className="font-medium">Wake Word</span>
                </div>

                {/* Toggle */}
                <button
                    onClick={onToggle}
                    disabled={!isSupported}
                    className={`
                        relative w-12 h-6 rounded-full transition-colors
                        ${!isSupported ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        ${enabled ? 'bg-purple-500' : 'bg-white/20'}
                    `}
                >
                    <span className={`
                        absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                        ${enabled ? 'left-7' : 'left-1'}
                    `} />
                </button>
            </div>

            <p className="text-sm text-white/60 mb-3">
                Say <strong>&quot;Hey LocalMind&quot;</strong> to activate voice input without touching keyboard.
            </p>

            {/* Demo Warning */}
            <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                <IconAlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-200/80">
                    <strong>Demo Only:</strong> Uses Chrome&apos;s cloud speech recognition.
                    Audio is processed externally. Auto-disables after 5min inactivity.
                    Not suitable for always-on use.
                </div>
            </div>

            {!isSupported && (
                <div className="mt-2 text-xs text-red-400">
                    ⚠️ Wake word is not supported in this browser. Try Chrome.
                </div>
            )}
        </div>
    );
}

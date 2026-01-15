/**
 * Wake Word Detection - "Hey LocalMind"
 * 
 * ⚠️ DEMO ONLY - Not suitable for production always-on use
 * 
 * Limitations:
 * - Web Speech API is Chrome-only and cloud-dependent
 * - Requires user to be on the page
 * - Privacy: Audio is processed by Google's servers
 * 
 * Future: Use WebAssembly + Picovoice/Vosk for on-device detection
 */

const WAKE_PHRASES = [
    'hey localmind',
    'hey local mind',
    'okay localmind',
    'ok localmind',
    'hi localmind'
];

const AUTO_DISABLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Check if wake word detection is supported
 */
export function isWakeWordSupported() {
    return typeof window !== 'undefined' &&
        ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
}

/**
 * Create wake word listener
 * 
 * @param {function} onWake - Callback when wake word detected
 * @param {object} options - Configuration options
 * @returns {object} Controller with start, stop, isListening
 */
export function createWakeWordListener(onWake, options = {}) {
    const {
        autoDisableAfter = AUTO_DISABLE_TIMEOUT,
        onStatusChange = () => { },
        onError = () => { }
    } = options;

    if (!isWakeWordSupported()) {
        console.warn('[WakeWord] Not supported in this browser');
        return {
            start: () => false,
            stop: () => { },
            isListening: () => false,
            isSupported: false
        };
    }

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    let recognition = null;
    let listening = false;
    let autoDisableTimer = null;
    let lastActivityTime = Date.now();

    const resetAutoDisable = () => {
        lastActivityTime = Date.now();
        if (autoDisableTimer) {
            clearTimeout(autoDisableTimer);
        }
        if (autoDisableAfter > 0) {
            autoDisableTimer = setTimeout(() => {
                console.log('[WakeWord] Auto-disabling due to inactivity');
                stop();
                onStatusChange('auto_disabled');
            }, autoDisableAfter);
        }
    };

    const start = () => {
        if (listening) return true;

        try {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                listening = true;
                console.log('[WakeWord] Listening started');
                onStatusChange('listening');
                resetAutoDisable();
            };

            recognition.onresult = (event) => {
                resetAutoDisable();

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript.toLowerCase().trim();

                    // Check for wake phrase
                    const detected = WAKE_PHRASES.some(phrase => transcript.includes(phrase));

                    if (detected) {
                        console.log('[WakeWord] Wake word detected!');
                        onStatusChange('wake_detected');

                        // Extract command after wake word (if any)
                        let command = transcript;
                        for (const phrase of WAKE_PHRASES) {
                            command = command.replace(phrase, '').trim();
                        }

                        onWake(command);
                        break;
                    }
                }
            };

            recognition.onerror = (event) => {
                // Ignore benign errors that occur during normal operation
                if (event.error === 'aborted' || event.error === 'no-speech') {
                    return; // Expected during stop/restart cycles
                }

                console.error('[WakeWord] Error:', event.error);

                if (event.error === 'not-allowed') {
                    onError('Microphone access denied');
                    stop();
                } else if (event.error === 'network') {
                    onError('Network error - speech recognition requires internet');
                } else {
                    onError(event.error);
                }

                onStatusChange('error');
            };

            recognition.onend = () => {
                // Restart if still supposed to be listening
                if (listening) {
                    console.log('[WakeWord] Restarting...');
                    setTimeout(() => {
                        if (listening && recognition) {
                            try {
                                recognition.start();
                            } catch (e) {
                                // Ignore "already started" error
                                if (!e.message?.includes('already started')) {
                                    console.warn('[WakeWord] Restart failed:', e.message);
                                }
                            }
                        }
                    }, 100);
                } else {
                    onStatusChange('stopped');
                }
            };

            recognition.start();
            return true;

        } catch (error) {
            console.error('[WakeWord] Failed to start:', error);
            onError(error.message);
            return false;
        }
    };

    const stop = () => {
        listening = false;
        if (autoDisableTimer) {
            clearTimeout(autoDisableTimer);
            autoDisableTimer = null;
        }
        if (recognition) {
            try {
                recognition.stop();
            } catch (e) {
                // Ignore
            }
            recognition = null;
        }
        console.log('[WakeWord] Stopped');
        onStatusChange('stopped');
    };

    return {
        start,
        stop,
        isListening: () => listening,
        isSupported: true
    };
}

/**
 * React hook for wake word detection
 */
export function useWakeWord(onWake, enabled = false) {
    const [status, setStatus] = React.useState('idle'); // idle, listening, wake_detected, error, auto_disabled
    const [error, setError] = React.useState(null);
    const listenerRef = React.useRef(null);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;

        listenerRef.current = createWakeWordListener(
            (command) => {
                onWake(command);
            },
            {
                onStatusChange: setStatus,
                onError: setError
            }
        );

        return () => {
            if (listenerRef.current) {
                listenerRef.current.stop();
            }
        };
    }, [onWake]);

    React.useEffect(() => {
        if (!listenerRef.current) return;

        if (enabled) {
            listenerRef.current.start();
        } else {
            listenerRef.current.stop();
        }
    }, [enabled]);

    return {
        status,
        error,
        isSupported: listenerRef.current?.isSupported ?? isWakeWordSupported(),
        isListening: status === 'listening'
    };
}

// Provide React import for the hook (will be tree-shaken if not used)
import React from 'react';

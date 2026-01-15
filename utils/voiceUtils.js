/**
 * Voice utilities for speech-to-text and text-to-speech
 * Uses Web Speech API (browser native)
 */

// Check browser support
export const isSpeechRecognitionSupported = () => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

export const isSpeechSynthesisSupported = () => {
    return 'speechSynthesis' in window;
};

// Speech Recognition (STT)
let recognition = null;
let isListening = false;

export const initSpeechRecognition = () => {
    if (!isSpeechRecognitionSupported()) {
        console.warn('Speech recognition not supported in this browser');
        return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    recognition.continuous = false; // Stop after one result
    recognition.interimResults = true; // Show partial results
    recognition.lang = 'en-US'; // English

    return recognition;
};

export const startListening = (onResult, onEnd, onError) => {
    if (!recognition) {
        recognition = initSpeechRecognition();
    }

    if (!recognition) {
        onError?.('Speech recognition not supported');
        return false;
    }

    recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');

        const isFinal = event.results[event.results.length - 1].isFinal;
        onResult?.(transcript, isFinal);
    };

    recognition.onend = () => {
        isListening = false;
        onEnd?.();
    };

    recognition.onerror = (event) => {
        isListening = false;
        console.error('Speech recognition error:', event.error);
        recognition = null; // Force re-initialization on error (fixes stuck states)
        onError?.(event.error);
    };

    try {
        recognition.start();
        isListening = true;
        return true;
    } catch (err) {
        console.error('Failed to start recognition:', err);
        onError?.(err.message);
        return false;
    }
};

export const stopListening = () => {
    if (recognition && isListening) {
        recognition.stop();
        isListening = false;
    }
};

export const getIsListening = () => isListening;

// Text-to-Speech (TTS)
let selectedVoice = null;
let isSpeaking = false;

export const getVoices = () => {
    return new Promise((resolve) => {
        let voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve(voices);
        } else {
            // Voices might not be loaded yet
            window.speechSynthesis.onvoiceschanged = () => {
                resolve(window.speechSynthesis.getVoices());
            };
            // Also try again after a short delay
            setTimeout(() => {
                voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) resolve(voices);
            }, 100);
        }
    });
};

export const findBestFemaleVoice = async () => {
    const voices = await getVoices();

    console.log('[Voice] Available voices:', voices.map(v => `${v.name} (${v.lang})`).join(', '));

    // Explicit priority list - Windows native voices first (more reliable), then Google
    // Chrome has bugs with Google voices sometimes being ignored
    const voicePriorities = [
        'Microsoft Zira',             // Windows native - most reliable female
        'Microsoft Heera',            // Windows native - Indian female  
        'Google UK English Female',   // Good quality but Chrome bugs
        'Google US English',          // Google US (often female)
        'Samantha',                   // macOS female
        'Karen',                      // macOS Australian female
        'Victoria',                   // macOS female
    ];

    // Try to find by exact name match
    for (const targetName of voicePriorities) {
        const voice = voices.find(v => v.name.includes(targetName));
        if (voice) {
            console.log('[Voice] ✓ Selected:', voice.name);
            return voice;
        }
    }

    // Fallback: any female English voice
    const femaleVoice = voices.find(v =>
        v.lang.includes('en') &&
        (v.name.toLowerCase().includes('female') || v.name.includes('Zira') || v.name.includes('Heera'))
    );

    if (femaleVoice) {
        console.log('[Voice] ✓ Fallback female:', femaleVoice.name);
        return femaleVoice;
    }

    // Last resort: first English voice
    const englishVoice = voices.find(v => v.lang.includes('en'));
    if (englishVoice) {
        console.log('[Voice] ⚠ Using:', englishVoice.name);
        return englishVoice;
    }

    console.warn('[Voice] No English voice found!');
    return voices[0] || null;
};

export const initTTS = async () => {
    if (!isSpeechSynthesisSupported()) {
        console.warn('Speech synthesis not supported');
        return false;
    }

    selectedVoice = await findBestFemaleVoice();
    return selectedVoice !== null;
};

export const speak = async (text, onEnd) => {
    if (!isSpeechSynthesisSupported()) {
        console.warn('Speech synthesis not supported');
        onEnd?.();
        return false;
    }

    // Ensure voice is selected before speaking
    if (!selectedVoice) {
        console.log('[Voice] Reinitializing voice before speaking...');
        await initTTS();
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // First, strip the model header (e.g., "**Qwen 2.5** _Casual greeting detected_\n\n")
    // The header pattern is: **ModelName** _reason_\n\n followed by the actual content
    let processedText = text;

    // Remove the header line (first line with model name and reason)
    // Pattern: starts with **something** optionally followed by _something_
    const headerPattern = /^\*\*[^*]+\*\*\s*(?:_[^_]*_)?\s*\n+/;
    processedText = processedText.replace(headerPattern, '');

    // Clean up the text - remove markdown formatting
    const cleanText = processedText
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
        .replace(/\*([^*]+)\*/g, '$1') // Italic
        .replace(/_([^_]+)_/g, '$1') // Underscore italic
        .replace(/`[^`]+`/g, '') // Inline code
        .replace(/```[\s\S]*?```/g, '') // Code blocks
        .replace(/#+\s*/g, '') // Headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
        .replace(/\n+/g, '. ') // Newlines to pauses
        .replace(/\.\s*\./g, '.') // Clean up double periods
        .trim();

    if (!cleanText) {
        onEnd?.();
        return false;
    }

    console.log('[Voice] Speaking:', cleanText.substring(0, 50) + '...');

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // FORCE get voice fresh every time to ensure female voice
    const voices = window.speechSynthesis.getVoices();
    let voiceToUse = selectedVoice;

    // Try to find female voice if not already set - prioritize Windows native (Zira)
    if (!voiceToUse) {
        voiceToUse = voices.find(v => v.name.includes('Zira')) ||
            voices.find(v => v.name.includes('Heera')) ||
            voices.find(v => v.name === 'Google UK English Female') ||
            voices.find(v => v.name.toLowerCase().includes('female')) ||
            voices.find(v => v.lang.includes('en'));
    }

    if (voiceToUse) {
        console.log('[Voice] Using voice:', voiceToUse.name);
        utterance.voice = voiceToUse;
        utterance.lang = voiceToUse.lang || 'en-GB';
    } else {
        console.warn('[Voice] No voice found, using default');
        utterance.lang = 'en-GB';
    }

    // Normal rate and pitch - don't modify, the Google voice sounds best as-is
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
        isSpeaking = true;
    };

    utterance.onend = () => {
        isSpeaking = false;
        onEnd?.();
    };

    utterance.onerror = (event) => {
        isSpeaking = false;
        // 'interrupted' is expected when user says "stop" or closes voice mode
        if (event.error !== 'interrupted') {
            console.error('Speech synthesis error:', event.error);
        }
        onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
    return true;
};

export const stopSpeaking = () => {
    if (isSpeechSynthesisSupported()) {
        window.speechSynthesis.cancel();
        isSpeaking = false;
    }
};

export const getIsSpeaking = () => isSpeaking;

// Streaming TTS - speaks sentences as they complete
export class StreamingTTS {
    constructor() {
        this.buffer = '';
        this.spokenLength = 0;
        this.isActive = true;
        this.queue = [];
        this.isSpeakingQueue = false;
    }

    // Strip the model header from the beginning
    stripHeader(text) {
        const headerPattern = /^\*\*[^*]+\*\*\s*(?:_[^_]*_)?\s*\n+/;
        return text.replace(headerPattern, '');
    }

    // Clean markdown for speech
    cleanForSpeech(text) {
        return text
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/_([^_]+)_/g, '$1')
            .replace(/`[^`]+`/g, '')
            .replace(/```[\s\S]*?```/g, '')
            .replace(/#+\s*/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .trim();
    }

    // Add text chunk and speak complete phrases
    addChunk(fullText) {
        if (!this.isActive || !isSpeechSynthesisSupported()) return;

        // Strip header on first chunk
        const processedText = this.stripHeader(fullText);

        // Get only the new part we haven't processed yet
        const newText = processedText.substring(this.spokenLength);
        this.buffer += newText;
        this.spokenLength = processedText.length;

        // Speak on shorter chunks - commas, colons, semicolons, periods, or after 80+ chars
        // This makes voice start much sooner
        const phraseEndPattern = /[.!?,:;]+(?:\s|$)/g;
        let match;
        let lastEnd = 0;

        while ((match = phraseEndPattern.exec(this.buffer)) !== null) {
            const phrase = this.buffer.substring(lastEnd, match.index + match[0].length).trim();
            // Only queue if phrase is at least 15 chars (avoid tiny fragments)
            if (phrase.length >= 15) {
                const cleanPhrase = this.cleanForSpeech(phrase);
                if (cleanPhrase.length > 5) {
                    this.queue.push(cleanPhrase);
                }
                lastEnd = match.index + match[0].length;
            }
        }

        // Keep the incomplete part in buffer
        this.buffer = this.buffer.substring(lastEnd);

        // Start speaking queue if not already
        this.processQueue();
    }

    processQueue() {
        if (this.isSpeakingQueue || this.queue.length === 0 || !this.isActive) return;

        this.isSpeakingQueue = true;
        const sentence = this.queue.shift();

        const utterance = new SpeechSynthesisUtterance(sentence);

        // FORCE get voice fresh every time to ensure female voice
        const voices = window.speechSynthesis.getVoices();
        let voiceToUse = selectedVoice;

        if (!voiceToUse) {
            voiceToUse = voices.find(v => v.name === 'Google UK English Female') ||
                voices.find(v => v.name.includes('Zira')) ||
                voices.find(v => v.name.includes('Heera')) ||
                voices.find(v => v.name.toLowerCase().includes('female')) ||
                voices.find(v => v.lang.includes('en'));
        }

        if (voiceToUse) {
            utterance.voice = voiceToUse;
            utterance.lang = voiceToUse.lang || 'en-GB';
        } else {
            utterance.lang = 'en-GB';
        }

        // Normal rate - Google UK Female sounds best at 1.0
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => {
            this.isSpeakingQueue = false;
            if (this.isActive) {
                this.processQueue();
            }
        };

        utterance.onerror = () => {
            this.isSpeakingQueue = false;
            if (this.isActive) {
                this.processQueue();
            }
        };

        window.speechSynthesis.speak(utterance);
    }

    // Finish speaking any remaining buffer
    finish() {
        if (this.buffer.trim().length > 0) {
            const cleanSentence = this.cleanForSpeech(this.buffer);
            if (cleanSentence.length > 2) {
                this.queue.push(cleanSentence);
            }
            this.buffer = '';
        }
        this.processQueue();
    }

    // Stop and clean up
    stop() {
        this.isActive = false;
        this.queue = [];
        this.buffer = '';
        window.speechSynthesis.cancel();
    }
}

// Create a new StreamingTTS instance
export const createStreamingTTS = () => new StreamingTTS();


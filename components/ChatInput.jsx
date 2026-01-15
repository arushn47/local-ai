'use client';
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
    startListening,
    stopListening,
    isSpeechRecognitionSupported
} from '@/utils/voiceUtils';

const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const extractTextFromPDF = async (file) => {
    try {
        const pdfjsLib = await import('pdfjs-dist');
        // IMPORTANT: Worker version must match the installed pdfjs-dist version.
        // Use the local worker shipped with pdfjs-dist (v5.x) instead of a mismatched CDN URL.
        try {
            const workerUrl = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url);
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.toString();
        } catch {
            // Fallback: keep default worker resolution if URL construction fails
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `[Page ${i}]\n${pageText}\n\n`;
        }

        return fullText;
    } catch (error) {
        console.error('Error extracting PDF text:', error);
        return `[Error extracting text from PDF: ${file.name}]`;
    }
};

const compressImage = (file) => {
    const MAX_IMAGE_SIZE = 1024;
    const IMAGE_QUALITY = 0.8;
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
                    if (width > height) {
                        height = Math.round((height * MAX_IMAGE_SIZE) / width);
                        width = MAX_IMAGE_SIZE;
                    } else {
                        width = Math.round((width * MAX_IMAGE_SIZE) / height);
                        height = MAX_IMAGE_SIZE;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', IMAGE_QUALITY);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

const ChatInput = forwardRef(({ onSend, disabled, onStop, initialText = '', isEditing = false, onCancelEdit, onOpenVoiceMode }, ref) => {
    const [input, setInput] = useState('');
    const [files, setFiles] = useState([]);
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const textareaRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingMode, setRecordingMode] = useState(null); // 'dictation' | 'voice' | null

    const dictationBaseRef = useRef('');
    const lastDictationTranscriptRef = useRef('');

    // Expose startVoiceMode to parent via ref (for wake word activation)
    useImperativeHandle(ref, () => ({
        startVoiceMode: () => startVoiceModeInternal()
    }));

    useEffect(() => {
        // When entering/leaving edit mode, the parent updates initialText.
        // Keep this local input in sync with that value.
        setInput(initialText ?? '');
        adjustHeight();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialText]);

    const adjustHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [input]);

    const revokePreviewUrl = (fileObj) => {
        try {
            if (fileObj?.preview) URL.revokeObjectURL(fileObj.preview);
        } catch {
            // ignore
        }
    };

    const handleFileChange = async (newFiles) => {
        const processedFiles = [];
        for (const file of newFiles) {
            if (file.type === 'application/pdf') {
                const text = await extractTextFromPDF(file);
                processedFiles.push({
                    file,
                    type: 'pdf',
                    preview: URL.createObjectURL(file),
                    name: file.name,
                    extractedText: text,
                });
            } else if (file.type.startsWith('image/')) {
                const compressedFile = await compressImage(file);
                processedFiles.push({ file: compressedFile, type: 'image', preview: URL.createObjectURL(compressedFile) });
            }
        }
        setFiles(prev => [...prev, ...processedFiles]);
        textareaRef.current?.focus();
    };

    const handleSend = async () => {
        if ((!input.trim() && files.length === 0) || disabled) return;

        let finalInput = input;

        const messageData = {
            text: finalInput,
            files: [],      // Will contain { file: File, type: 'image' }
            documents: [],  // Will contain { file: File, name: string, extractedText: string }
            inputMethod: 'text'
        };

        for (const fileObj of files) {
            if (fileObj.type === 'pdf') {
                messageData.documents.push({
                    file: fileObj.file,
                    name: fileObj.name || fileObj.file?.name || 'document.pdf',
                    text: fileObj.extractedText || '',
                });
            } else if (fileObj.type === 'image') {
                messageData.files.push({ file: fileObj.file, type: 'image' });
            }
        }

        onSend(messageData);
        setInput('');
        files.forEach(revokePreviewUrl);
        setFiles([]);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const removeFileAtIndex = (index) => {
        setFiles(prev => {
            const fileObj = prev[index];
            revokePreviewUrl(fileObj);
            return prev.filter((_, i) => i !== index);
        });
    };

    const stopRecording = () => {
        stopListening();
        setIsRecording(false);
        setRecordingMode(null);

        dictationBaseRef.current = '';
        lastDictationTranscriptRef.current = '';
    };

    const handleSpeechEnd = () => {
        setIsRecording(false);
        setRecordingMode(null);
    };

    const handleSpeechError = (error) => {
        setIsRecording(false);
        setRecordingMode(null);
        if (error === 'network') {
            alert('Speech service unreachable. (Check connection, VPN, or Firewall).');
        } else if (error === 'not-allowed' || error === 'permission-denied') {
            alert('Microphone access denied. Please allow microphone access.');
        } else if (error === 'no-speech') {
            // Ignore silence timeout
        } else {
            console.warn('Speech recognition error:', error);
        }
    };

    // Dictation: Speech-to-text only (no TTS, no auto-send)
    const toggleDictation = () => {
        if (disabled) return;

        if (isRecording) {
            stopRecording();
            return;
        }

        if (!isSpeechRecognitionSupported()) {
            alert('Speech recognition not supported.');
            return;
        }

        setRecordingMode('dictation');
        setIsRecording(true);
        dictationBaseRef.current = input;
        lastDictationTranscriptRef.current = '';
        startListening((transcript, isFinal) => {
            const nextTranscript = (transcript || '').trim();

            // Many speech engines emit interim results repeatedly.
            // Replace the in-progress dictated segment instead of appending each time.
            const base = dictationBaseRef.current || '';
            const spacer = base && !base.endsWith(' ') ? ' ' : '';

            if (nextTranscript && nextTranscript !== lastDictationTranscriptRef.current) {
                setInput(`${base}${spacer}${nextTranscript}`);
                lastDictationTranscriptRef.current = nextTranscript;
            }

            if (isFinal) {
                // Commit final text and stop.
                const committed = nextTranscript ? `${base}${spacer}${nextTranscript}` : base;
                setInput(committed);
                setIsRecording(false);
                setRecordingMode(null);
                dictationBaseRef.current = committed;
                lastDictationTranscriptRef.current = '';
            }
        }, handleSpeechEnd, handleSpeechError);
    };

    // Voice Mode: Enables TTS + starts listening + auto-sends when done
    const startVoiceModeInternal = () => {
        if (disabled) return;
        if (isRecording) stopRecording();

        if (isSpeechRecognitionSupported()) {
            setRecordingMode('voice');
            setIsRecording(true);
            startListening((transcript, isFinal) => {
                setInput(transcript); // Replace (not append) for voice mode
                if (isFinal && transcript.trim()) {
                    setIsRecording(false);
                    setRecordingMode(null);
                    // Auto-send after a short delay
                    setTimeout(() => {
                        const messageData = { text: transcript.trim(), files: [], inputMethod: 'voice' };
                        onSend(messageData);
                        setInput('');
                    }, 300);
                }
            }, handleSpeechEnd, handleSpeechError);
        } else {
            alert('Speech recognition not supported.');
        }
    };

    return (
        <div className="w-full relative max-w-3xl mx-auto mb-6 px-4">
            {isDragging && (
                <div className="absolute inset-0 -top-10 z-50 bg-purple-600/20 backdrop-blur-sm border-2 border-purple-500 border-dashed rounded-3xl flex items-center justify-center animate-pulse">
                    <div className="bg-neutral-900/80 p-4 rounded-xl text-white font-bold shadow-xl">Drop files here</div>
                </div>
            )}

            <div className={`
                relative bg-neutral-900/80 backdrop-blur-xl border transition-all duration-300 ease-out
                ${isRecording ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-white/10 focus-within:border-purple-500/30'}
                rounded-[2rem] shadow-2xl p-1.5 flex flex-col justify-end
            `}>
                {isEditing && (
                    <div className="flex items-center justify-between px-4 py-2 mx-2 m-2 rounded-2xl bg-white/5 border border-purple-500/20">
                        <div className="text-sm text-purple-200">Editing message</div>
                        <button
                            onClick={() => onCancelEdit?.()}
                            className="p-1.5 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                            title="Stop editing"
                            aria-label="Stop editing"
                            type="button"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                {files.length > 0 && (
                    <div className="flex gap-3 p-3 overflow-x-auto custom-scrollbar border-b border-white/5 mx-2">
                        {files.map((file, index) => (
                            <div key={index} className="relative group flex-shrink-0 animate-scale-in">
                                {file.type === 'image' ? (
                                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10">
                                        <img src={file.preview} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <a
                                        href={file.preview}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-44 h-28 rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-purple-500/30 transition-colors"
                                        title={file.name || 'Open PDF'}
                                    >
                                        <div className="w-full h-full relative">
                                            <iframe
                                                src={file.preview}
                                                className="w-full h-full"
                                                style={{ border: 'none' }}
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-xs px-2 py-1 truncate">
                                                {file.name || 'PDF'}
                                            </div>
                                        </div>
                                    </a>
                                )}
                                <button onClick={() => removeFileAtIndex(index)} className="absolute -top-1 -right-1 bg-neutral-800 text-red-400 rounded-full p-0.5 shadow border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove file"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-1 px-1">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                        title="Attach"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        <input type="file" multiple ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.length && handleFileChange(Array.from(e.target.files))} accept="image/*,application/pdf" />
                    </button>

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                        placeholder={isRecording ? (recordingMode === 'voice' ? 'Voice mode: listening...' : 'Dictation: listening...') : "Message..."}
                        rows={1}
                        className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 py-2 px-1 max-h-30 resize-none custom-scrollbar leading-normal text-[15px] outline-none"
                        style={{ minHeight: '36px' }}
                    />

                    {/* Dictation (Speech-to-text) */}
                    <button
                        onClick={toggleDictation}
                        className={`p-2 rounded-full transition-all flex-shrink-0 ${disabled
                            ? 'text-gray-600 cursor-not-allowed'
                            : isRecording
                                ? 'bg-red-500 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                        title={disabled ? 'Disabled while generating' : (isRecording ? 'Stop listening' : 'Dictation (Speech to Text)')}
                        aria-label="Dictation"
                        disabled={disabled}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isRecording ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            )}
                        </svg>
                    </button>

                    {/* Voice Mode OR Send Button */}
                    {disabled ? (
                        /* Stop Button - when AI is generating */
                        <button
                            onClick={onStop}
                            className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-400 transition-all flex-shrink-0"
                            title="Stop generating"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="6" width="12" height="12" rx="1" />
                            </svg>
                        </button>
                    ) : (!input.trim() && files.length === 0) ? (
                        <button
                            onClick={onOpenVoiceMode}
                            className="p-2 rounded-full transition-all flex-shrink-0 bg-gradient-to-r from-purple-500 to-violet-500 text-white hover:from-purple-400 hover:to-violet-400"
                            title="Voice Mode (Full conversation)"
                        >
                            {/* Soundwave icon */}
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                            </svg>
                        </button>
                    ) : (
                        /* Send Button - when has content */
                        <button
                            onClick={handleSend}
                            className="p-2 bg-white/10 text-white rounded-full hover:bg-white/15 border border-white/10 hover:border-purple-500/40 transition-all flex-shrink-0"
                            title="Send"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;

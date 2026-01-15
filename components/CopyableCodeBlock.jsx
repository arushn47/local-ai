"use client";

import { useMemo, useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import atomOneDark from 'react-syntax-highlighter/dist/styles/atom-one-dark';

const CopyableCodeBlock = ({ code, language = 'java' }) => {
    const [copied, setCopied] = useState(false);

    const languageLabel = useMemo(() => {
        const raw = (language || '').trim();
        if (!raw) return 'CODE';
        return raw.toUpperCase();
    }, [language]);

    const handleCopy = () => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }).catch(err => {
                console.error('Async: Could not copy text: ', err);
            });
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = code;
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.width = '2em';
            textArea.style.height = '2em';
            textArea.style.padding = '0';
            textArea.style.border = 'none';
            textArea.style.outline = 'none';
            textArea.style.boxShadow = 'none';
            textArea.style.background = 'transparent';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
            }
            document.body.removeChild(textArea);
        }
    };

    return (
            <div
                className="group rounded-2xl border border-white/10 bg-neutral-950/60 backdrop-blur overflow-hidden transition-colors hover:border-purple-500/30"
                tabIndex={0}
            >
                <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-purple-200">
                            {languageLabel}
                        </span>
                        <span className="text-xs text-neutral-500 truncate">Code</span>
                    </div>

                    <button
                        onClick={handleCopy}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${copied
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:border-purple-500/30'
                            }`}
                        aria-label={copied ? 'Copied' : 'Copy code'}
                        type="button"
                    >
                        {copied ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        )}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <SyntaxHighlighter
                        language={language}
                        style={atomOneDark}
                        customStyle={{
                            margin: 0,
                            background: 'transparent',
                            padding: '16px',
                            fontSize: '13px',
                            lineHeight: 1.6,
                        }}
                        codeTagProps={{
                            style: {
                                fontFamily:
                                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            },
                        }}
                        showLineNumbers={false}
                        PreTag="div"
                    >
                        {code}
                    </SyntaxHighlighter>
                </div>
            </div>
    );
};

export default CopyableCodeBlock;
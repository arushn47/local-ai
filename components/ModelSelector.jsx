import React, { useState, useRef, useEffect } from 'react';

const ModelSelector = ({ model, setModel }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const models = [
        { value: 'auto', label: 'Auto', isAuto: true },
        { value: 'llama3.2-vision:latest', label: 'Llama Vision 3.2' },
        { value: 'qwen3-vl:8b', label: 'Qwen 3 VL' },
        { value: 'qwen2.5:7b-instruct', label: 'Qwen 2.5' },
        { value: 'deepseek-r1:8b', label: 'Deepseek R1' },
        { value: 'llava:latest', label: 'Llava' },
        { value: 'bakllava:latest', label: 'BakLlava' },
    ];

    const selectedModel = models.find(m => m.value === model);
    const selectedModelLabel = selectedModel?.label || 'Auto';
    const isAutoMode = model === 'auto';

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
                className={`bg-neutral-900 border rounded-full text-white text-sm font-medium pl-4 pr-10 py-2 w-full text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-neutral-800 transition-colors cursor-pointer ${isAutoMode ? 'border-purple-500/50' : 'border-white/10'}`}
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <span className="flex items-center gap-2">
                    {isAutoMode && (
                        <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
                        </svg>
                    )}
                    {selectedModelLabel}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 w-full bg-neutral-900 border border-white/10 rounded-2xl shadow-lg z-10 overflow-hidden animate-fade-in-up">
                    <ul>
                        {models.map((option, index) => (
                            <li
                                key={option.value}
                                onClick={() => handleOptionClick(option.value)}
                                className={`px-4 py-2 text-sm text-white hover:bg-neutral-800 cursor-pointer transition-colors flex items-center gap-2 ${option.isAuto ? 'border-b border-white/10 bg-purple-500/10' : ''} ${model === option.value ? 'bg-white/10' : ''}`}
                            >
                                {option.isAuto && (
                                    <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
                                    </svg>
                                )}
                                {option.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ModelSelector;

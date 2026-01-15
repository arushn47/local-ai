'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const CustomSelect = ({ label, value, onChange, options, icon, placeholder = 'Select an option' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef(null);
    const [dropdownStyles, setDropdownStyles] = useState({});

    // Calculate position for the portal dropdown
    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownStyles({
                position: 'fixed',
                top: `${rect.bottom + 8}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                zIndex: 9999, // Ensure it's on top of everything
            });
        }
    }, [isOpen]);

    // Close on scroll or resize to prevent floating issues
    useEffect(() => {
        const handleScroll = (e) => {
            if (isOpen) setIsOpen(false);
        };
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    // Close on click outside (for the dropdown specifically)
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isOpen && triggerRef.current && !triggerRef.current.contains(event.target)) {
                // Check if click is inside the portal content (we need a ref for portal content)
                const portalElement = document.getElementById(`dropdown-portal-${label}`);
                if (portalElement && !portalElement.contains(event.target)) {
                    setIsOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, label]);

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="relative mb-4">
            {label && (
                <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">
                    {label}
                </label>
            )}
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-neutral-900/50 backdrop-blur-sm border ${isOpen ? 'border-purple-500 ring-1 ring-purple-500/50' : 'border-white/10 hover:border-purple-500/30'
                    } rounded-xl p-3 flex items-center justify-between transition-all duration-200 group text-left`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <span className={`${isOpen ? 'text-purple-400' : 'text-gray-400 group-hover:text-purple-400'} transition-colors`}>
                        {icon || (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                            </svg>
                        )}
                    </span>
                    <span className={`truncate ${selectedOption ? 'text-white' : 'text-gray-500'}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>

                <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-purple-400' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Portal Dropdown */}
            {isOpen && createPortal(
                <div
                    id={`dropdown-portal-${label}`}
                    style={dropdownStyles}
                    className="bg-neutral-900 border border-white/10 rounded-xl shadow-2xl shadow-purple-900/20 overflow-hidden animate-fade-in flex flex-col max-h-60 overflow-y-auto custom-scrollbar"
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left p-3 flex items-center justify-between transition-colors ${option.value === value
                                    ? 'bg-purple-600/10 text-purple-400'
                                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <span>{option.label}</span>
                            {option.value === value && (
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export default CustomSelect;

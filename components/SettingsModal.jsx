'use client';
import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getGoogleAuthUrl } from '@/utils/googleCalendar';
import CustomSelect from './CustomSelect';

const SettingsModal = ({ isOpen, onClose, user }) => {
    const [activeTab, setActiveTab] = useState('profile');
    const [isLoading, setIsLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const [googleConnected, setGoogleConnected] = useState(false);

    // AI Preferences State
    const [systemInstructions, setSystemInstructions] = useState('');
    const [defaultModel, setDefaultModel] = useState('gemini-2.5-flash-preview-05-20');

    // Load preferences from Firestore (with localStorage fallback)
    useEffect(() => {
        if (!isOpen) return;

        const loadSettings = async () => {
            // Try localStorage first as immediate fallback
            const localSystem = localStorage.getItem('system_instructions') || '';
            const localModel = localStorage.getItem('default_model') || 'gemini-2.5-flash-preview-05-20';
            setSystemInstructions(localSystem);
            setDefaultModel(localModel);

            // If user is logged in, try to load from Firestore
            if (user?.uid) {
                try {
                    const profileRef = doc(db, 'profiles', user.uid);
                    const profileSnap = await getDoc(profileRef);

                    if (profileSnap.exists()) {
                        const settings = profileSnap.data()?.settings;
                        if (settings?.system_instructions !== undefined) {
                            setSystemInstructions(settings.system_instructions);
                            localStorage.setItem('system_instructions', settings.system_instructions);
                        }
                        if (settings?.default_model !== undefined) {
                            setDefaultModel(settings.default_model);
                            localStorage.setItem('default_model', settings.default_model);
                        }
                    }
                } catch (e) {
                    console.error('[Settings] Error loading settings:', e);
                }
            }
        };

        loadSettings();
    }, [isOpen, user?.uid]);

    const handleSaveAI = async () => {
        setIsLoading(true);
        setSaveStatus('saving');

        // Always save to localStorage for immediate access
        localStorage.setItem('system_instructions', systemInstructions);
        localStorage.setItem('default_model', defaultModel);

        // If user is logged in, save to Firestore
        if (user?.uid) {
            try {
                const profileRef = doc(db, 'profiles', user.uid);
                await setDoc(profileRef, {
                    email: user.email,
                    displayName: user.displayName || null,
                    photoURL: user.photoURL || null,
                    settings: {
                        system_instructions: systemInstructions,
                        default_model: defaultModel
                    },
                    updatedAt: serverTimestamp()
                }, { merge: true });

                setSaveStatus('saved');
            } catch (e) {
                console.error('[Settings] Error saving to Firestore:', e);
                setSaveStatus('error');
            }
        } else {
            setSaveStatus('saved');
        }

        setIsLoading(false);
        setTimeout(() => setSaveStatus(''), 2000);
    };

    if (!isOpen) return null;

    const sections = [
        { id: 'profile', label: 'Profile', icon: '👤' },
        { id: 'ai', label: 'AI Preferences', icon: '🤖' },
        { id: 'integrations', label: 'Integrations', icon: '🔗' },
        { id: 'privacy', label: 'Privacy & Data', icon: '🔒' },
        { id: 'about', label: 'About Us', icon: 'ℹ️' }
    ];

    const modelOptions = [
        { value: 'auto', label: '✨ Auto (Smart Selection)' },
        { value: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash' },
        { value: 'llama3.2-vision:latest', label: 'Llama Vision 3.2 (Local)' },
        { value: 'qwen3-vl:8b', label: 'Qwen 3 VL (Local)' },
        { value: 'deepseek-r1:8b', label: 'Deepseek R1 (Local)' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-neutral-900/95 backdrop-blur-xl w-full max-w-4xl h-[80vh] rounded-2xl border border-white/10 shadow-2xl flex overflow-hidden animate-scale-in">

                {/* Sidebar */}
                <div className="w-64 bg-black/20 border-r border-white/10 p-4 flex flex-col">
                    <h2 className="text-xl font-bold text-white mb-6 px-4 tracking-tight">Settings</h2>
                    <div className="space-y-1">
                        {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveTab(section.id)}
                                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-200 font-medium ${activeTab === section.id
                                    ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20 shadow-lg shadow-purple-900/10'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                                    }`}
                            >
                                <span className={activeTab === section.id ? 'text-purple-400' : 'text-gray-500'}>{section.icon}</span>
                                <span>{section.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col bg-transparent">
                    <div className="flex items-center justify-between p-6 border-b border-white/10">
                        <h3 className="text-xl font-bold text-white tracking-wide">
                            {sections.find(s => s.id === activeTab)?.label}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

                        {/* Profile Section */}
                        {activeTab === 'profile' && (
                            <div className="space-y-8 animate-slide-up">
                                <div className="flex items-center gap-6 p-6 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-neutral-800 shadow-xl ring-2 ring-purple-500/20">
                                        {user?.photoURL ? (
                                            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-3xl font-bold text-white">
                                                {user?.email?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-2xl font-bold text-white mb-1">{user?.displayName || 'User'}</h4>
                                        <p className="text-gray-400 font-medium">{user?.email}</p>
                                        <div className="mt-3 flex gap-2">
                                            <span className="text-xs bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full border border-purple-500/30 font-medium">
                                                Pro Plan
                                            </span>
                                            <span className="text-xs bg-green-500/20 text-green-300 px-3 py-1 rounded-full border border-green-500/30 font-medium">
                                                Active
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* AI Preferences Section */}
                        {activeTab === 'ai' && (
                            <div className="space-y-8 max-w-2xl animate-slide-up">
                                <div>
                                    <CustomSelect
                                        label="Default Model"
                                        value={defaultModel}
                                        onChange={setDefaultModel}
                                        options={modelOptions}
                                        icon={<span className="text-lg">🤖</span>}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">System Instructions</label>
                                    <div className="relative group">
                                        <textarea
                                            value={systemInstructions}
                                            onChange={(e) => setSystemInstructions(e.target.value)}
                                            className="w-full h-40 bg-neutral-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none transition-all group-hover:border-white/20"
                                            placeholder="e.g. Always be concise. Format code in Python."
                                        />
                                        <div className="absolute bottom-3 right-3 text-xs text-gray-600 pointer-events-none">
                                            Custom Persona
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 ml-1">
                                        These instructions will be prepended to every conversation.
                                    </p>
                                </div>

                                <button
                                    onClick={handleSaveAI}
                                    disabled={isLoading}
                                    className={`w-full py-3 rounded-xl transition-all font-bold shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 ${saveStatus === 'error'
                                        ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                                        : saveStatus === 'saved'
                                            ? 'bg-green-600 hover:bg-green-500 shadow-green-900/20'
                                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-900/20'
                                        } text-white ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Saving...
                                        </>
                                    ) : saveStatus === 'saved' ? (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                            </svg>
                                            Saved!
                                        </>
                                    ) : saveStatus === 'error' ? (
                                        'Error - Try Again'
                                    ) : (
                                        'Save Preferences'
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Integrations Section */}
                        {activeTab === 'integrations' && (
                            <div className="space-y-6 max-w-2xl animate-slide-up">
                                {/* Google Integration */}
                                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                                            <svg className="w-6 h-6" viewBox="0 0 24 24">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-white font-bold">Google</h4>
                                            <p className="text-gray-400 text-sm">Calendar & Gmail access</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const authUrl = getGoogleAuthUrl(null);
                                                if (authUrl) {
                                                    window.location.href = authUrl;
                                                } else {
                                                    alert('Google OAuth not configured.');
                                                }
                                            }}
                                            className={`px-4 py-2 rounded-xl font-medium transition-all ${googleConnected
                                                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                                : 'bg-purple-600 hover:bg-purple-500 text-white'
                                                }`}
                                        >
                                            {googleConnected ? '✓ Connected' : 'Connect'}
                                        </button>
                                    </div>
                                    <div className="text-xs text-gray-500 leading-relaxed">
                                        Connect your Google account to access Calendar events and email summaries.
                                    </div>
                                </div>

                                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-sm text-blue-300">
                                    <strong>Tip:</strong> After connecting, try asking "What's on my calendar this week?"
                                </div>
                            </div>
                        )}

                        {/* Privacy Section */}
                        {activeTab === 'privacy' && (
                            <div className="space-y-6 max-w-2xl animate-slide-up">
                                <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
                                    <h4 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        Danger Zone
                                    </h4>
                                    <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                                        Deleting your account is permanent. All your chats and preferences will be wiped.
                                    </p>
                                    <button className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition-colors text-sm font-medium">
                                        Delete User Account
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* About Section */}
                        {activeTab === 'about' && (
                            <div className="space-y-8 max-w-2xl animate-slide-up pt-8 text-center">
                                <div className="relative inline-block group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
                                    <div className="relative w-24 h-24 bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl mx-auto flex items-center justify-center text-5xl shadow-2xl">
                                        🚀
                                    </div>
                                </div>

                                <div>
                                    <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">LocalMind</h2>
                                    <p className="text-purple-400 font-mono text-sm bg-purple-500/10 inline-block px-3 py-1 rounded-full border border-purple-500/20">
                                        v2.0.0 • Firebase + Gemini
                                    </p>
                                </div>

                                <p className="text-gray-400 max-w-md mx-auto leading-relaxed text-lg">
                                    Your private AI workspace. <br />
                                    <span className="text-gray-500 text-sm">Built with Next.js, Firebase, and Gemini AI.</span>
                                </p>

                                <div className="mt-8 text-xs text-neutral-600">
                                    © 2026 LocalMind AI. All rights reserved.
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;

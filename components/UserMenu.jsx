
import React, { useState, useRef, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const UserMenu = ({ user, onOpenSettings }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Login error:', error);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        setIsOpen(false);
    };

    if (!user) {
        return (
            <button
                onClick={handleLogin}
                className="flex items-center gap-2 bg-white text-black font-semibold py-2 px-4 rounded-full hover:bg-gray-200 transition-colors transform hover:scale-105 active:scale-95 text-sm"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in
            </button>
        );
    }

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                title={user.email}
            >
                {user.photoURL ? (
                    <img
                        src={user.photoURL}
                        alt="User"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-purple-600 flex items-center justify-center font-bold text-white">
                        {user.email?.[0]?.toUpperCase()}
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in text-sm">
                    <div className="p-4 border-b border-white/10 bg-white/5">
                        <p className="font-medium text-white truncate">{user.displayName || 'User'}</p>
                        <p className="text-gray-400 text-xs truncate">{user.email}</p>
                    </div>

                    <div className="p-1">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                if (onOpenSettings) onOpenSettings();
                            }}
                            className="w-full text-left px-3 py-2 text-gray-300 hover:bg-white/10 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Settings
                        </button>
                        <div className="h-px bg-white/10 my-1 mx-2"></div>
                        <button
                            onClick={handleLogout}
                            className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            Log out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserMenu;

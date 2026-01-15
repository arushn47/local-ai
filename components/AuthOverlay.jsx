
import React from 'react';

const AuthOverlay = () => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-neutral-950 text-white animate-fade-in">
            <div className="mb-8 relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative w-24 h-24 bg-neutral-900 rounded-full flex items-center justify-center text-4xl font-bold">
                    🚀
                </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                Welcome to LocalMind
            </h1>

            <p className="text-xl text-gray-400 max-w-lg mb-8">
                Your private AI workspace with powerful agent tools.
                <br />
                Sign in to manage your chats, notes, and tasks.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-4xl w-full">
                <div className="p-6 rounded-2xl bg-neutral-900 border border-white/5 hover:border-purple-500/30 transition-colors">
                    <div className="text-2xl mb-3">🧮</div>
                    <h3 className="font-bold text-lg mb-2">Smart Tools</h3>
                    <p className="text-sm text-gray-400">Built-in calculator, file analysis, and more powered by rule-based agents.</p>
                </div>
                <div className="p-6 rounded-2xl bg-neutral-900 border border-white/5 hover:border-pink-500/30 transition-colors">
                    <div className="text-2xl mb-3">📝</div>
                    <h3 className="font-bold text-lg mb-2">Memory</h3>
                    <p className="text-sm text-gray-400">Save notes and tasks that persist across your sessions securely.</p>
                </div>
                <div className="p-6 rounded-2xl bg-neutral-900 border border-white/5 hover:border-blue-500/30 transition-colors">
                    <div className="text-2xl mb-3">🔒</div>
                    <h3 className="font-bold text-lg mb-2">Private</h3>
                    <p className="text-sm text-gray-400">Your data is secured with Firebase Auth and secure cloud storage.</p>
                </div>
            </div>

            <div className="mt-12 text-gray-500 text-sm">
                ↗ Use the button in the top right to sign in
            </div>
        </div>
    );
};

export default AuthOverlay;

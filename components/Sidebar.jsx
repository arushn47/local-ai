import React, { useState, useEffect, useRef } from 'react';

const Sidebar = ({
    chats,
    onSelectChat,
    onCreateNewChat,
    activeChatId,
    onDeleteClick,
    onRenameChat,
    isOpen,
    setIsOpen,
    onDeleteAllClick
}) => {
    const sidebarRef = useRef(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [renamingChatId, setRenamingChatId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef(null);

    // Handle clicking outside to close sidebar (on mobile)
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                window.innerWidth < 768 &&
                isOpen &&
                sidebarRef.current &&
                !sidebarRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, setIsOpen]);

    // Focus rename input when editing starts
    useEffect(() => {
        if (renamingChatId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingChatId]);

    const getChatTitle = (chat) => {
        if (chat.title) return chat.title;
        if (chat.messages[0]?.text) return chat.messages[0].text.slice(0, 30);
        return 'New Chat';
    };

    const handleStartRename = (e, chat) => {
        e.preventDefault();
        e.stopPropagation();
        setRenamingChatId(chat.id);
        setRenameValue(getChatTitle(chat));
    };

    const handleFinishRename = () => {
        if (renamingChatId && renameValue.trim() && onRenameChat) {
            onRenameChat(renamingChatId, renameValue.trim());
        }
        setRenamingChatId(null);
        setRenameValue('');
    };

    const handleRenameKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleFinishRename();
        } else if (e.key === 'Escape') {
            setRenamingChatId(null);
            setRenameValue('');
        }
    };

    const filteredChats = searchQuery.trim()
        ? chats.filter(chat =>
            getChatTitle(chat).toLowerCase().includes(searchQuery.trim().toLowerCase())
        )
        : chats;

    const handleCloseSearch = () => {
        setIsSearching(false);
        setSearchQuery('');
    };

    return (
        <>
            {/* Mobile backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={() => setIsOpen(false)}
            ></div>

            {/* Sidebar */}
            <div
                ref={sidebarRef}
                className={`fixed md:relative top-0 left-0 h-full bg-neutral-950 border-r border-white/5 flex flex-col z-40 transition-all duration-300 ease-out shadow-2xl md:shadow-none ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'
                    } md:translate-x-0 ${isCollapsed ? 'md:w-14' : 'md:w-72'}`}
            >

                {/* Header Area */}
                <div className={`flex-shrink-0 ${isCollapsed ? 'p-2' : 'p-4 pb-2'}`}>
                    <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'} mb-6`}>

                        {/* Logo / Title */}
                        {!isCollapsed && !isSearching && (
                            <h1 className="text-xl font-semibold text-purple-500 tracking-tight">
                                LocalMind
                            </h1>
                        )}

                        {/* Search & Collapse Controls */}
                        <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : ''}`}>
                            {/* Search Toggle */}
                            {!isCollapsed && (
                                <div className={`relative transition-all ${isSearching ? 'w-full' : 'w-auto'}`}>
                                    {isSearching ? (
                                        <div className="flex items-center gap-2 w-full animate-fade-in">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="Search..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-3 pr-8 py-1.5 text-sm text-white focus:ring-1 focus:ring-purple-500/40 outline-none"
                                                    autoFocus
                                                />
                                                <button onClick={handleCloseSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setIsSearching(true)}
                                            className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                            aria-label="Search"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Collapse Button */}
                            {!isSearching && (
                                <button
                                    onClick={() => setIsCollapsed(!isCollapsed)}
                                    className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors hidden md:block"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isCollapsed ? "M9 5l7 7-7 7" : "M4 6h16M4 12h16M4 18h16"} />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* New Chat Button */}
                    <button
                        onClick={onCreateNewChat}
                        className={`group relative flex items-center justify-center gap-3 bg-white/5 hover:bg-white/5 hover:border-purple-500/40 border border-white/10 text-white transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-full aspect-square rounded-full' : 'w-full py-2.5 px-4 rounded-2xl'}`}
                    >
                        <svg className={`w-5 h-5 text-purple-300 group-hover:text-purple-200 transition-colors ${isCollapsed ? '' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        {!isCollapsed && <span className="font-medium text-sm group-hover:text-purple-100 relative z-10">New Chat</span>}
                    </button>
                </div>

                {/* Chat History List */}
                <div className={`flex-grow overflow-y-auto custom-scrollbar ${isCollapsed ? 'px-2' : 'px-3'} py-2`}>
                    {!isCollapsed && (
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pl-2">
                            Recent
                        </h2>
                    )}
                    <ul className="space-y-1">
                        {filteredChats.map((chat) => (
                            <li key={chat.id} className="relative group">
                                <button
                                    onClick={() => {
                                        if (renamingChatId !== chat.id) {
                                            onSelectChat(chat.id);
                                            if (window.innerWidth < 768) setIsOpen(false);
                                        }
                                    }}
                                    className={`flex items-center gap-3 transition-all duration-200 group/item
                                        ${isCollapsed ? 'w-full aspect-square justify-center rounded-full' : 'w-full text-left px-3 py-2 rounded-2xl'}
                                        ${!isCollapsed && activeChatId === chat.id
                                            ? 'bg-white/5 text-white border border-purple-500/20'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 hover:border-purple-500/20 border border-transparent'}
                                        ${isCollapsed && activeChatId === chat.id ? 'bg-neutral-800 text-white' : ''}
                                    `}
                                >
                                    {/* Icon */}
                                    <span className={`flex-shrink-0 ${activeChatId === chat.id ? 'text-purple-300' : 'text-gray-500 group-hover/item:text-gray-300'}`}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                        </svg>
                                    </span>

                                    {!isCollapsed && (
                                        <div className="flex-1 min-w-0 relative">
                                            {renamingChatId === chat.id ? (
                                                <input
                                                    ref={renameInputRef}
                                                    type="text"
                                                    value={renameValue}
                                                    onChange={(e) => setRenameValue(e.target.value)}
                                                    onBlur={handleFinishRename}
                                                    onKeyDown={handleRenameKeyDown}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full bg-neutral-900 border border-purple-500/50 rounded px-1.5 py-0.5 text-sm text-white focus:outline-none"
                                                />
                                            ) : (
                                                <span className={`block truncate text-sm ${activeChatId === chat.id ? 'font-medium' : 'font-normal'}`}>
                                                    {getChatTitle(chat)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>

                                {/* Action buttons */}
                                {!isCollapsed && renamingChatId !== chat.id && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/90 pl-2 rounded-l-lg border-l border-white/5 shadow-xl">
                                        <button
                                            onClick={(e) => handleStartRename(e, chat)}
                                            className="p-1.5 rounded-full text-gray-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                                            title="Rename"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteClick(chat.id);
                                            }}
                                            className="p-1.5 rounded-full text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                            title="Delete"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Footer */}
                <div className={`flex-shrink-0 ${isCollapsed ? 'p-2' : 'p-4'} border-t border-white/5 bg-neutral-900/50`}>
                    <button
                        onClick={onDeleteAllClick}
                        className={`flex items-center justify-center gap-2 text-gray-500 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-all group ${isCollapsed ? 'w-full aspect-square' : 'w-full p-2.5 rounded-2xl'}`}
                        title="Delete All Chats"
                    >
                        <svg className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {!isCollapsed && <span className="font-medium text-sm">Delete All</span>}
                    </button>
                </div>
            </div >
        </>
    );
};

export default Sidebar;

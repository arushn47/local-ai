import CopyableCodeBlock from "./CopyableCodeBlock"
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ChatMessage = ({ message, onEdit, user }) => {
    const { text, sender, images, thinking, id } = message;
    const isUser = sender === 'user';

    return (
        <div className={`group flex items-start gap-4 my-6 animate-slide-up ${isUser ? 'justify-end' : ''}`}>

            {/* AI Avatar */}
            {!isUser && (
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-white/5 shadow-lg shadow-black/30 text-purple-200 font-bold text-sm border border-purple-500/20">
                    <span className="tracking-wide">LM</span>
                </div>
            )}

            <div className={`flex flex-col gap-2 max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>

                {/* Thinking Block */}
                {thinking && (
                    <details className="mb-2 bg-yellow-500/5 border border-yellow-500/10 rounded-xl w-full max-w-2xl overflow-hidden group/thinking">
                        <summary className="cursor-pointer p-3 text-xs uppercase tracking-wider text-yellow-500/80 font-bold list-none flex items-center gap-2 hover:bg-yellow-500/5 transition-colors">
                            <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Thinking Process
                            <svg className="w-4 h-4 ml-auto transform group-open/thinking:rotate-180 transition-transform opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </summary>
                        <div className="p-4 pt-0 border-t border-yellow-500/10 bg-black/20">
                            <pre className="text-yellow-200/70 text-xs whitespace-pre-wrap font-mono leading-relaxed">{thinking}</pre>
                        </div>
                    </details>
                )}

                {/* Images Grid */}
                {images && images.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-1">
                        {images.map((image, index) => (
                            <img
                                key={index}
                                src={image}
                                alt={`User upload ${index + 1}`}
                                className="w-auto h-auto max-w-[200px] sm:max-w-xs max-h-60 rounded-2xl border border-white/10 shadow-lg transition-transform hover:scale-[1.02]"
                            />
                        ))}
                    </div>
                )}

                {/* Message Bubble */}
                {text && (
                    <div className={`relative px-5 py-3.5 rounded-3xl shadow-sm text-base leading-relaxed ${isUser
                            ? 'bg-neutral-800/80 text-white rounded-br-sm border border-white/5 backdrop-blur-sm'
                            : 'bg-transparent text-gray-100 pl-0'
                        }`}>

                        {/* Edit Button (User only) */}
                        {isUser && onEdit && (
                            <button
                                onClick={() => onEdit(id, text)}
                                className="absolute -left-12 top-1/2 -translate-y-1/2 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all bg-neutral-800 hover:bg-neutral-700 text-gray-400 hover:text-white border border-white/5"
                                title="Edit message"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                        )}

                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                p({ node, ...props }) {
                                    return <p className="mb-2 last:mb-0 leading-7 text-[15px]" {...props} />;
                                },
                                a({ node, ...props }) {
                                    return <a className="text-purple-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />;
                                },
                                ul({ node, ...props }) {
                                    return <ul className="list-disc list-outside ml-4 mb-2 space-y-1" {...props} />;
                                },
                                ol({ node, ...props }) {
                                    return <ol className="list-decimal list-outside ml-4 mb-2 space-y-1" {...props} />;
                                },
                                blockquote({ node, ...props }) {
                                    return <blockquote className="border-l-4 border-purple-500/30 pl-4 py-1 my-2 bg-purple-500/5 rounded-r italic text-gray-300" {...props} />;
                                },
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline ? (
                                        <div className="my-4 rounded-xl overflow-hidden border border-white/10 shadow-xl">
                                            <CopyableCodeBlock
                                                code={String(children).replace(/\n$/, '')}
                                                language={match?.[1]}
                                            />
                                        </div>
                                    ) : (
                                        <code className="bg-white/10 text-purple-200 px-1.5 py-0.5 rounded text-sm font-mono border border-white/5" {...props}>
                                            {children}
                                        </code>
                                    );
                                },
                                table({ node, ...props }) {
                                    return <div className="overflow-x-auto my-4 rounded-lg border border-white/10"><table className="min-w-full divide-y divide-white/10" {...props} /></div>;
                                },
                                th({ node, ...props }) {
                                    return <th className="bg-white/5 py-2 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" {...props} />;
                                },
                                td({ node, ...props }) {
                                    return <td className="py-2 px-3 text-sm text-gray-400 border-t border-white/5" {...props} />;
                                }
                            }}
                        >
                            {text}
                        </ReactMarkdown>
                    </div>
                )}
            </div>

            {/* User Avatar */}
            {isUser && (
                <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden border border-white/10 shadow-lg">
                    {user?.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="User" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-gray-400 font-bold border border-white/5">
                            {user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ChatMessage;
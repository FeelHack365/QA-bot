import React, { useState, useEffect, createContext, useContext } from 'react';
import NotionUploader from './notion_uploader';
import SlackSender from './SlackSender';
import Settings from './Settings';

// Context for Toasts
const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

export default function App() {
    const [view, setView] = useState('uploader'); // 'uploader', 'slack', 'settings'
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            <div className="min-h-screen bg-white font-sans text-black selection:bg-[#0070f3] selection:text-white">
                {/* Vercel Header */}
                <header className="border-b border-[#eaeaea] sticky top-0 bg-white/80 backdrop-blur-md z-50">
                    <div className="max-w-[1250px] mx-auto px-6 h-16 flex items-center justify-between transition-all">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <svg width="24" height="24" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M37.5 0L75 64.5H0L37.5 0Z" fill="black" />
                                </svg>
                                <span className="h-6 w-px bg-[#eaeaea] mx-2" />
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">QA-bot-alina</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Vercel Sub-nav Tabs */}
                    <div className="max-w-[1250px] mx-auto px-6">
                        <nav className="flex items-center gap-8 -mb-px overflow-x-auto no-scrollbar">
                            {[
                                { id: 'uploader', label: '노션 업로드' },
                                { id: 'slack', label: '슬랙 전송' },
                                { id: 'settings', label: '설정' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setView(tab.id)}
                                    className={`h-11 text-[13.5px] font-medium transition-all relative ${view === tab.id ? 'text-black' : 'text-[#666] hover:text-black'
                                        }`}
                                >
                                    {tab.label}
                                    {view === tab.id && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black animate-in fade-in duration-300" />
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="max-w-[1250px] mx-auto px-6 py-12">
                    <div className="animate-in fade-in duration-500">
                        {view === 'uploader' && <NotionUploader />}
                        {view === 'slack' && <SlackSender />}
                        {view === 'settings' && <Settings />}
                    </div>
                </main>

                {/* Vercel-style Toast System */}
                <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
                    {toasts.map(toast => (
                        <div
                            key={toast.id}
                            className={`pointer-events-auto flex items-center justify-between shadow-lg min-w-[320px] max-w-[400px] border rounded-md px-6 py-4 animate-in slide-in-from-right-full duration-300 ${toast.type === 'error' ? 'bg-white border-red-500 text-red-600' : 'bg-black text-white border-black'
                                }`}
                        >
                            <span className="text-[13.5px] font-medium leading-relaxed">{toast.message}</span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="opacity-60 hover:opacity-100 transition-opacity ml-4"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </ToastContext.Provider>
    );
}

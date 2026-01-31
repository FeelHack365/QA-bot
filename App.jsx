import React, { useState } from 'react';
import NotionUploader from './notion_uploader';
import SlackSender from './SlackSender';

export default function App() {
    const [view, setView] = useState('uploader'); // 'uploader' or 'slack'

    return (
        <div className="relative min-h-screen bg-slate-50">
            {/* Navigation Tabs */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                <div className="flex items-center gap-2 p-2 bg-white/80 backdrop-blur-xl border border-white rounded-[24px] shadow-2xl">
                    <button
                        onClick={() => setView('uploader')}
                        className={`px-6 py-3 rounded-2xl font-black text-sm transition-all ${view === 'uploader'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        📤 Notion Uploader
                    </button>
                    <button
                        onClick={() => setView('slack')}
                        className={`px-6 py-3 rounded-2xl font-black text-sm transition-all ${view === 'slack'
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        💬 Slack Sender
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="pb-32">
                {view === 'uploader' ? <NotionUploader /> : <SlackSender />}
            </div>
        </div>
    );
}

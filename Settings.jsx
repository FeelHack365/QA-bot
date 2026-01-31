import React, { useState, useEffect } from 'react';
import { useToast } from './App';

export default function Settings() {
    const { addToast } = useToast();
    const [config, setConfig] = useState({
        token: '', databaseId: '',
        slackToken: '', channelId: '',
        companySlackToken: '', projectChannelId: '', assigneeUserId: ''
    });

    useEffect(() => {
        const savedToken = localStorage.getItem('notion_token');
        const savedDbId = localStorage.getItem('notion_database_id');
        const savedSlackToken = localStorage.getItem('slackToken');
        const savedChannelId = localStorage.getItem('channelId');
        const savedCompanySlackToken = localStorage.getItem('companySlackToken');
        const savedProjectChannelId = localStorage.getItem('projectChannelId');
        const savedAssigneeUserId = localStorage.getItem('assigneeUserId');

        setConfig({
            token: savedToken || '',
            databaseId: savedDbId || '',
            slackToken: savedSlackToken || '',
            channelId: savedChannelId || '',
            companySlackToken: savedCompanySlackToken || '',
            projectChannelId: savedProjectChannelId || '',
            assigneeUserId: savedAssigneeUserId || ''
        });
    }, []);

    const handleChange = (key, val) => {
        const newConfig = { ...config, [key]: val };
        setConfig(newConfig);
        const storageKey = key === 'token' ? 'notion_token' : key === 'databaseId' ? 'notion_database_id' : key;
        localStorage.setItem(storageKey, val.trim());
    };

    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-[32px] font-bold tracking-tighter text-black">Settings</h1>
                <p className="text-[#666] text-[15px]">Manage your API tokens and environment configurations. Changes are saved automatically.</p>
            </div>

            <div className="space-y-8 max-w-[1000px]">
                {/* Notion Section */}
                <section className="vercel-card overflow-hidden">
                    <div className="px-8 py-6 border-b border-[#eaeaea]">
                        <h2 className="text-xl font-bold">Notion Integration</h2>
                        <p className="text-[13px] text-[#666] mt-1">Connect your workspace for data ingestion.</p>
                    </div>
                    <div className="px-8 py-10 space-y-8 bg-[#fafafa]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest">API Secret Token</label>
                                <input
                                    type="password"
                                    value={config.token}
                                    onChange={(e) => handleChange('token', e.target.value)}
                                    placeholder="secret_..."
                                    className="w-full px-4 py-2 border border-[#eaeaea] focus:border-black rounded-md text-[14px] font-mono outline-none transition-all shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest">Database ID</label>
                                <input
                                    type="text"
                                    value={config.databaseId}
                                    onChange={(e) => handleChange('databaseId', e.target.value)}
                                    placeholder="32-char ID"
                                    className="w-full px-4 py-2 border border-[#eaeaea] focus:border-black rounded-md text-[14px] font-mono outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Slack Section */}
                <section className="vercel-card overflow-hidden">
                    <div className="px-8 py-6 border-b border-[#eaeaea]">
                        <h2 className="text-xl font-bold">Slack Messaging</h2>
                        <p className="text-[13px] text-[#666] mt-1">Personal and Corporate workspace configurations.</p>
                    </div>
                    <div className="px-8 py-10 space-y-12 bg-[#fafafa]">
                        {/* Personal Slack */}
                        <div>
                            <h4 className="text-[11px] font-black text-black uppercase tracking-[.2em] border-b border-[#eaeaea] pb-2 mb-6">Personal Workspace</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracker-wider">Bot User Token</label>
                                    <input
                                        type="password"
                                        value={config.slackToken}
                                        onChange={(e) => handleChange('slackToken', e.target.value)}
                                        className="w-full px-4 py-2 border border-[#eaeaea] focus:border-black rounded-md text-[14px] font-mono outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracker-wider">Channel ID</label>
                                    <input
                                        type="text"
                                        value={config.channelId}
                                        onChange={(e) => handleChange('channelId', e.target.value)}
                                        className="w-full px-4 py-2 border border-[#eaeaea] focus:border-black rounded-md text-[14px] font-mono outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Company Slack */}
                        <div>
                            <h4 className="text-[11px] font-black text-black uppercase tracking-[.2em] border-b border-[#eaeaea] pb-2 mb-6">Corporate Workspace</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracker-wider">Org Token</label>
                                    <input
                                        type="password"
                                        value={config.companySlackToken}
                                        onChange={(e) => handleChange('companySlackToken', e.target.value)}
                                        className="w-full px-4 py-2 border border-[#eaeaea] focus:border-black rounded-md text-[14px] font-mono outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracker-wider">Project Channel</label>
                                    <input
                                        type="text"
                                        value={config.projectChannelId}
                                        onChange={(e) => handleChange('projectChannelId', e.target.value)}
                                        className="w-full px-4 py-2 border border-[#eaeaea] focus:border-black rounded-md text-[14px] font-mono outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracker-wider">Assignee ID</label>
                                    <input
                                        type="text"
                                        value={config.assigneeUserId}
                                        onChange={(e) => handleChange('assigneeUserId', e.target.value)}
                                        className="w-full px-4 py-2 border border-[#eaeaea] focus:border-black rounded-md text-[14px] font-mono outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="px-8 py-4 border-t border-[#eaeaea] bg-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#0070f3]" />
                            <span className="text-[12px] text-[#888] italic">Changes are persisted to LocalStorage in real-time.</span>
                        </div>
                        <button
                            onClick={() => addToast('설정이 성공적으로 동기화되었습니다.')}
                            className="vercel-btn-primary"
                        >
                            Sync Confirmation
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { useToast } from './App';

export default function Settings() {
    const { addToast } = useToast();
    const [config, setConfig] = useState({
        token: '', databaseId: '',
        slackToken: '', channelId: '',
        companySlackToken: '', projectChannelId: '', assigneeUserId: '',
        deeplApiKey: ''
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
            assigneeUserId: savedAssigneeUserId || '',
            deeplApiKey: localStorage.getItem('deeplApiKey') || ''
        });
    }, []);

    const handleChange = (key, val) => {
        const newConfig = { ...config, [key]: val };
        setConfig(newConfig);
        const storageKey = key === 'token' ? 'notion_token' : key === 'databaseId' ? 'notion_database_id' : key;
        localStorage.setItem(storageKey, val.trim());

        // Trigger storage event manually for the same window to sync hidden/mounted components
        window.dispatchEvent(new Event('storage'));
    };

    return (
        <div className="space-y-12">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-[32px] font-bold tracking-tighter text-black">설정</h1>
                    <p className="text-[#666] text-[15px]">API 토큰 및 환경 설정을 관리합니다. 변경 사항은 자동으로 저장됩니다.</p>
                </div>
                <button
                    onClick={() => addToast('설정이 성공적으로 저장되었습니다.')}
                    className="vercel-btn-primary"
                >
                    저장
                </button>
            </div>

            <div className="space-y-8">
                {/* Notion Section */}
                <section className="vercel-card overflow-hidden">
                    <div className="px-8 py-6 border-b border-[#eaeaea]">
                        <h2 className="text-xl font-bold">노션 연동</h2>
                        <p className="text-[13px] text-[#666] mt-1">데이터 입수를 위해 워크스페이스를 연결합니다.</p>
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

                {/* DeepL Section */}
                <section className="vercel-card overflow-hidden">
                    <div className="px-8 py-6 border-b border-[#eaeaea]">
                        <h2 className="text-xl font-bold">DeepL 번역 연동</h2>
                        <p className="text-[13px] text-[#666] mt-1">자동 번역을 위한 DeepL API 키를 설정합니다.</p>
                    </div>
                    <div className="px-8 py-10 space-y-8 bg-[#fafafa]">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest">DeepL API Key</label>
                            <input
                                type="password"
                                value={config.deeplApiKey}
                                onChange={(e) => handleChange('deeplApiKey', e.target.value)}
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
                                className="w-full px-4 py-2 border border-[#eaeaea] focus:border-black rounded-md text-[14px] font-mono outline-none transition-all shadow-sm"
                            />
                            <p className="text-[12px] text-[#888] mt-2">
                                <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener noreferrer" className="text-[#0070f3] hover:underline">DeepL API Key 받기 →</a>
                            </p>
                        </div>
                    </div>
                </section>

                {/* Slack Section */}
                <section className="vercel-card overflow-hidden">
                    <div className="px-8 py-6 border-b border-[#eaeaea]">
                        <h2 className="text-xl font-bold">슬랙 메시징</h2>
                        <p className="text-[13px] text-[#666] mt-1">개인 및 기업 워크스페이스 설정입니다.</p>
                    </div>
                    <div className="px-8 py-10 space-y-12 bg-[#fafafa]">
                        {/* Personal Slack */}
                        <div>
                            <h4 className="text-[11px] font-black text-black uppercase tracking-[.2em] border-b border-[#eaeaea] pb-2 mb-6">개인 워크스페이스</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracker-wider">봇 유저 토큰</label>
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
                            <h4 className="text-[11px] font-black text-black uppercase tracking-[.2em] border-b border-[#eaeaea] pb-2 mb-6">기업 워크스페이스</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracker-wider">기업용 토큰</label>
                                    <input
                                        type="password"
                                        value={config.companySlackToken}
                                        onChange={(e) => handleChange('companySlackToken', e.target.value)}
                                        className="w-full px-4 py-2 border border-[#eaeaea] focus:border-black rounded-md text-[14px] font-mono outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracker-wider">프로젝트 채널</label>
                                    <input
                                        type="text"
                                        value={config.projectChannelId}
                                        onChange={(e) => handleChange('projectChannelId', e.target.value)}
                                        className="w-full px-4 py-2 border border-[#eaeaea] focus:border-black rounded-md text-[14px] font-mono outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracker-wider">담당자 ID</label>
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
                </section>
            </div>
        </div>
    );
}

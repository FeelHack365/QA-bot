import React, { useState, useEffect, useMemo } from 'react';

// --- Icons (Inline SVGs) ---
const IconSettings = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);
const IconUpload = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
);
const IconFile = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14.5 2 14.5 7.5 20 7.5" /></svg>
);
const IconCheck = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="green" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const IconX = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

export default function NotionUploader() {
    const [config, setConfig] = useState({ token: '', databaseId: '' });
    const [rawInput, setRawInput] = useState('');
    const [items, setItems] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        const savedToken = localStorage.getItem('notion_token');
        const savedDbId = localStorage.getItem('notion_database_id');
        if (savedToken || savedDbId) {
            setConfig({ token: savedToken || '', databaseId: savedDbId || '' });
        } else {
            setShowSettings(true);
        }
    }, []);

    const saveConfig = () => {
        localStorage.setItem('notion_token', config.token.trim());
        localStorage.setItem('notion_database_id', config.databaseId.trim());
        alert('✨ 설정이 저장되었습니다.');
        setShowSettings(false);
    };

    const parseInput = (text) => {
        if (!text.trim()) { setItems([]); return; }
        const lines = text.trim().split('\n');
        const startIdx = (lines[0].toLowerCase().includes('no') || lines[0].toLowerCase().includes('depth')) ? 1 : 0;
        const parsed = lines.slice(startIdx).map((line, idx) => {
            const fields = line.split('\t');
            const finalFields = fields.length > 1 ? fields : line.split(',');
            return {
                id: idx,
                no: finalFields[0]?.trim() || '',
                depth1: finalFields[1]?.trim() || '',
                depth2: finalFields[2]?.trim() || '',
                checkPoint: finalFields[3]?.trim() || '',
                scenario: finalFields[4]?.trim() || '',
                status: 'ready',
                errorMessage: ''
            };
        }).filter(item => item.no || item.depth1 || item.checkPoint);
        setItems(parsed);
    };

    useEffect(() => {
        const timeout = setTimeout(() => parseInput(rawInput), 300);
        return () => clearTimeout(timeout);
    }, [rawInput]);

    const createNotionPage = async (item) => {
        const cleanToken = config.token.trim();
        const cleanDbId = config.databaseId.trim();

        // /notion-v1/pages 호출 -> vercel.json에 의해 https://api.notion.com/v1/pages 로 변환됨
        const response = await fetch('/notion-v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cleanToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { type: 'database_id', database_id: cleanDbId },
                properties: {
                    'No.': {
                        title: [{ text: { content: item.no || '-' } }]
                    },
                    '1 Depth 화면': {
                        select: { name: item.depth1 || 'N/A' }
                    },
                    '2 Depth 영역': {
                        rich_text: [{ text: { content: item.depth2 || '' } }]
                    },
                    '확인 사항': {
                        rich_text: [{ text: { content: item.checkPoint || '' } }]
                    },
                    '시나리오': {
                        rich_text: [{ text: { content: item.scenario || '' } }]
                    },
                    '결과': {
                        select: { name: 'PENDING' }
                    },
                    '전송 상태': {
                        select: { name: '미전송' }
                    }
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`${response.status} ${errorData.code || 'Error'}: ${errorData.message || 'Unknown'}`);
        }
        return response.json();
    };

    const handleUploadAll = async () => {
        if (!config.token.trim() || !config.databaseId.trim()) {
            alert('⚠️ 설정을 완료해주세요.');
            setShowSettings(true);
            return;
        }
        setIsUploading(true);
        setLogs([]);
        setProgress(0);
        const updatedItems = [...items];

        for (let i = 0; i < updatedItems.length; i++) {
            const item = updatedItems[i];
            updatedItems[i] = { ...item, status: 'uploading' };
            setItems([...updatedItems]);
            try {
                await createNotionPage(item);
                updatedItems[i] = { ...updatedItems[i], status: 'success' };
                setLogs(prev => [`✅ [${item.no}] 성공`, ...prev]);
            } catch (err) {
                updatedItems[i] = { ...updatedItems[i], status: 'error', errorMessage: err.message };
                setLogs(prev => [`❌ [${item.no}] 실패: ${err.message}`, ...prev]);
            }
            setProgress(Math.round(((i + 1) / updatedItems.length) * 100));
            setItems([...updatedItems]);
            await new Promise(r => setTimeout(r, 400));
        }
        setIsUploading(false);
    };

    const StatusBadge = ({ status }) => {
        const styles = { ready: 'bg-gray-100 text-gray-500', uploading: 'bg-blue-100 text-blue-600 animate-pulse', success: 'bg-green-100 text-green-700', error: 'bg-red-100 text-red-700' };
        const icons = { ready: '대기', uploading: '중...', success: <IconCheck />, error: <IconX /> };
        return <span className={`px-2 py-1 rounded text-xs font-semibold flex items-center justify-center gap-1 ${styles[status]}`}>{icons[status]}</span>;
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-10" />
            </div>
            <div className="relative max-w-6xl mx-auto p-6 md:p-12">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold mb-4 tracking-wider uppercase">Notion Automation</div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Notion <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Uploader</span></h1>
                    </div>
                    <button onClick={() => setShowSettings(!showSettings)} className={`group flex items-center gap-2 px-5 py-3 rounded-2xl transition-all duration-300 ${showSettings ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-600 border border-slate-200 shadow-sm'}`}><IconSettings /><span className="font-semibold text-sm">연결 설정</span></button>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {showSettings && (
                        <div className="lg:col-span-12 animate-in slide-in-from-top-4 duration-500">
                            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[32px] p-8 shadow-2xl shadow-indigo-100/50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="space-y-2"><label className="text-sm font-bold text-slate-700">Notion Token</label><input type="password" value={config.token} onChange={(e) => setConfig({ ...config, token: e.target.value })} placeholder="secret_..." className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                                    <div className="space-y-2"><label className="text-sm font-bold text-slate-700">Database ID</label><input type="text" value={config.databaseId} onChange={(e) => setConfig({ ...config, databaseId: e.target.value })} placeholder="database_id" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                                </div>
                                <div className="flex justify-end"><button onClick={saveConfig} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">설정 저장</button></div>
                            </div>
                        </div>
                    )}
                    <div className="lg:col-span-12">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                                    <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><IconFile /> TSV 데이터 입력</h2>
                                    <textarea value={rawInput} onChange={(e) => setRawInput(e.target.value)} placeholder="QF01\t로그인\t이메일..." className="w-full h-96 p-6 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm leading-relaxed" />
                                </div>
                                {items.length > 0 && (
                                    <button onClick={handleUploadAll} disabled={isUploading} className={`w-full py-5 rounded-[24px] font-black text-lg transition-all ${isUploading ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:scale-[1.01] shadow-xl shadow-indigo-100'}`}>
                                        {isUploading ? `업로드 중 (${progress}%)` : `${items.length}개 항목 업로드 시작`}
                                    </button>
                                )}
                            </div>
                            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col min-h-[500px]">
                                <h3 className="text-xl font-bold mb-8">상태 리포트</h3>
                                <div className="flex-1 overflow-auto rounded-2xl border border-slate-50 mb-6">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead className="sticky top-0 bg-slate-50 z-10"><tr className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><th className="px-4 py-3">Status</th><th className="px-4 py-3">No.</th><th className="px-4 py-3">Check Point</th></tr></thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {items.map((item) => (<tr key={item.id} className="group hover:bg-slate-50/50"><td className="px-4 py-3 w-20"><StatusBadge status={item.status} /></td><td className="px-4 py-3 font-bold">{item.no}</td><td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">{item.checkPoint}</td></tr>))}
                                        </tbody>
                                    </table>
                                </div>
                                {logs.length > 0 && (
                                    <div className="bg-slate-900 rounded-[24px] p-6 text-xs font-mono text-slate-400 h-40 overflow-y-auto">
                                        {logs.map((log, i) => <div key={i} className="mb-1 leading-relaxed"><span className="text-indigo-400">[{i + 1}]</span> {log}</div>)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

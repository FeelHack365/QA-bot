import React, { useState, useEffect } from 'react';

// --- Icons ---
const IconSettings = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>;
const IconUpload = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
const IconFile = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14.5 2 14.5 7.5 20 7.5" /></svg>;
const IconCheck = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="green" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IconX = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;

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
        if (savedToken || savedDbId) setConfig({ token: savedToken || '', databaseId: savedDbId || '' });
        else setShowSettings(true);
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
                id: idx, no: finalFields[0]?.trim() || '',
                depth1: finalFields[1]?.trim() || '',
                depth2: finalFields[2]?.trim() || '',
                checkPoint: finalFields[3]?.trim() || '',
                scenario: finalFields[4]?.trim() || '',
                status: 'ready'
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
        const cleanDbId = config.databaseId.trim().replace(/-/g, ''); // '-' 포함 여부 상관없이 처리

        const response = await fetch('/notion-api/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cleanToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { type: 'database_id', database_id: cleanDbId },
                properties: {
                    'No.': { title: [{ text: { content: item.no || '-' } }] },
                    '1 Depth 화면': { select: { name: item.depth1 || 'N/A' } },
                    '2 Depth 영역': { rich_text: [{ text: { content: item.depth2 || '' } }] },
                    '확인 사항': { rich_text: [{ text: { content: item.checkPoint || '' } }] },
                    '시나리오': { rich_text: [{ text: { content: item.scenario || '' } }] },
                    '결과': { select: { name: 'PENDING' } },
                    '전송 상태': { select: { name: '미전송' } }
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Notion Error Details:', data);
            throw new Error(`${data.code}: ${data.message}`);
        }
        return data;
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
            updatedItems[i].status = 'uploading';
            setItems([...updatedItems]);
            try {
                await createNotionPage(item);
                updatedItems[i].status = 'success';
                setLogs(prev => [`✅ [${item.no}] 성공`, ...prev]);
            } catch (err) {
                updatedItems[i].status = 'error';
                // 구체적인 에러 메시지 출력
                setLogs(prev => [`❌ [${item.no}] 실패: ${err.message}`, ...prev]);
            }
            setProgress(Math.round(((i + 1) / updatedItems.length) * 100));
            setItems([...updatedItems]);
            await new Promise(r => setTimeout(r, 400));
        }
        setIsUploading(false);
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
            <div className="max-w-6xl mx-auto p-6 md:p-12">
                <header className="flex justify-between items-end mb-12">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-slate-900">Notion <span className="text-indigo-600">Uploader</span></h1>
                        <p className="text-slate-500 mt-2">QA 테스트 케이스를 노션으로 즉시 업로드합니다.</p>
                    </div>
                    <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-slate-50 transition-colors"><IconSettings /> 설정</button>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {showSettings && (
                        <div className="lg:col-span-12 bg-white border rounded-[24px] p-8 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <h2 className="font-bold mb-6">API 연동 정보</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase">Notion API Token</label><input type="password" value={config.token} onChange={(e) => setConfig({ ...config, token: e.target.value })} className="w-full p-4 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="secret_..." /></div>
                                <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase">Database ID</label><input type="text" value={config.databaseId} onChange={(e) => setConfig({ ...config, databaseId: e.target.value })} className="w-full p-4 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="32자리 ID" /></div>
                            </div>
                            <div className="flex justify-end mt-6"><button onClick={saveConfig} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-colors">설정 저장</button></div>
                        </div>
                    )}

                    <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Input Area */}
                        <div className="space-y-6">
                            <div className="bg-white border rounded-[32px] p-8 shadow-sm">
                                <h3 className="font-bold flex items-center gap-2 mb-4"><IconFile /> TSV 데이터</h3>
                                <textarea value={rawInput} onChange={(e) => setRawInput(e.target.value)} className="w-full h-80 p-4 bg-slate-50 border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs" placeholder="붙여넣으세요..." />
                            </div>
                            <button onClick={handleUploadAll} disabled={isUploading || items.length === 0} className={`w-full py-5 rounded-[20px] font-black text-white shadow-lg transition-all ${isUploading || items.length === 0 ? 'bg-slate-200 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'}`}>
                                {isUploading ? `진행 중 (${progress}%)` : `${items.length}개 업로드 시작`}
                            </button>
                        </div>

                        {/* Status Area */}
                        <div className="bg-white border rounded-[32px] p-8 shadow-sm flex flex-col min-h-[500px]">
                            <h3 className="font-bold mb-6">진행 상황 리포트</h3>
                            <div className="flex-1 overflow-auto bg-slate-50 rounded-2xl p-4 mb-4">
                                {items.length > 0 ? (
                                    <table className="w-full text-xs text-left">
                                        <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200"><th className="pb-3 w-16 text-center">상태</th><th className="pb-3 pl-2">번호</th><th className="pb-3">내용</th></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {items.map((item) => (
                                                <tr key={item.id} className="group"><td className="py-2 text-center">{item.status === 'success' ? <IconCheck /> : item.status === 'error' ? <IconX /> : item.status === 'uploading' ? '...' : '-'}</td><td className="py-2 pl-2 font-bold text-slate-700">{item.no}</td><td className="py-2 text-slate-400 truncate max-w-[150px]">{item.checkPoint}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-300 font-bold">데이터가 없습니다.</div>
                                )}
                            </div>
                            <div className="h-32 overflow-auto bg-slate-900 rounded-2xl p-4 text-[10px] font-mono text-slate-400">
                                {logs.map((log, i) => <div key={i} className="mb-1 leading-relaxed">{log}</div>)}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

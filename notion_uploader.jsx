import React, { useState, useEffect } from 'react';
import { useToast } from './App';

const IconFile = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
const IconCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0070f3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IconX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ee0000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;

export default function NotionUploader() {
    const { addToast } = useToast();
    const [config, setConfig] = useState({ token: '', databaseId: '' });
    const [rawInput, setRawInput] = useState('');
    const [items, setItems] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const loadConfig = () => {
            const savedToken = localStorage.getItem('notion_token') || '';
            const savedDbId = localStorage.getItem('notion_database_id') || '';
            setConfig({ token: savedToken, databaseId: savedDbId });
        };
        loadConfig();
        // Also listen for storage changes in case tabs are synced
        window.addEventListener('storage', loadConfig);
        return () => window.removeEventListener('storage', loadConfig);
    }, []);

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
        const cleanDbId = config.databaseId.trim().replace(/-/g, '');
        const isLocal = window.location.hostname === 'localhost';
        const apiPath = isLocal ? '/notion-api/v1/pages' : '/api/notion';

        const notionBody = {
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
        };

        const fetchOptions = isLocal ? {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cleanToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify(notionBody)
        } : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: cleanToken,
                path: '/v1/pages',
                method: 'POST',
                body: notionBody
            })
        };

        let response;
        try {
            response = await fetch(apiPath, fetchOptions);
        } catch (fetchErr) {
            console.error('Fetch error:', fetchErr);
            throw new Error(`Network error: ${fetchErr.message}`);
        }

        let data;
        const contentType = response.headers.get('content-type');
        try {
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = { message: text };
            }
        } catch (jsonErr) {
            data = { message: 'Failed to parse response' };
        }

        if (!response.ok) {
            console.error('Notion API Error:', data);
            throw new Error(data.code || data.message || `HTTP ${response.status}`);
        }
        return data;
    };

    const handleUploadAll = async () => {
        if (!config.token.trim() || !config.databaseId.trim()) {
            addToast('Notion settings incomplete. Check settings tab.', 'error');
            return;
        }
        setIsUploading(true); setLogs([]); setProgress(0);
        const updatedItems = [...items];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < updatedItems.length; i++) {
            const item = updatedItems[i];
            updatedItems[i].status = 'uploading';
            setItems([...updatedItems]);
            try {
                await createNotionPage(item);
                updatedItems[i].status = 'success';
                setLogs(prev => [`✅ [${item.no}] 성공`, ...prev]);
                successCount++;
            } catch (err) {
                updatedItems[i].status = 'error';
                setLogs(prev => [`❌ [${item.no}] 실패: ${err.message}`, ...prev]);
                failCount++;
            }
            setProgress(Math.round(((i + 1) / updatedItems.length) * 100));
            setItems([...updatedItems]);
            await new Promise(r => setTimeout(r, 400));
        }
        setIsUploading(false);

        if (failCount === 0) {
            addToast(`🎉 ${successCount}개 업로드 완료!`);
            setRawInput(''); setItems([]);
        } else {
            addToast(`⚠️ 업로드 완료 (성공: ${successCount}, 실패: ${failCount})`, 'error');
        }
    };

    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-[32px] font-bold tracking-tighter text-black">노션 업로드</h1>
                <p className="text-[#666] text-[15px]">TSV 데이터를 붙여넣어 노션에 업로드하세요.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Input Section */}
                <div className="lg:col-span-12">
                    <div className="vercel-card overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-[#eaeaea] bg-[#fafafa] flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-[#666] flex items-center gap-2">
                                QA 시나리오 입력
                            </span>
                        </div>
                        <textarea
                            value={rawInput}
                            onChange={(e) => setRawInput(e.target.value)}
                            className="w-full h-64 p-6 outline-none text-[13.5px] font-mono leading-relaxed"
                            placeholder="여기에 TSV 데이터를 붙여넣으세요"
                        />
                    </div>
                </div>

                {/* Queue & Logs */}
                <div className="lg:col-span-8">
                    <div className="vercel-card h-[500px] flex flex-col">
                        <div className="px-6 py-4 border-b border-[#eaeaea] bg-[#fafafa] flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-[#666]">전송 대기 목록</span>
                            <div className="flex items-center gap-4">
                                <span className="text-[12px] text-[#999]">{items.length}개 항목 파싱됨</span>
                                <button
                                    onClick={handleUploadAll}
                                    disabled={isUploading || items.length === 0}
                                    className="vercel-btn-primary"
                                >
                                    {isUploading ? `업로드 중 ${progress}%` : '노션으로 업로드'}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            {items.length > 0 ? (
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-white border-b border-[#eaeaea] z-10">
                                        <tr className="text-[11px] font-bold text-[#888] uppercase tracking-wider">
                                            <th className="px-6 py-3 w-16 text-center">상태</th>
                                            <th className="px-6 py-3">No.</th>
                                            <th className="px-6 py-3">1Depth</th>
                                            <th className="px-6 py-3">확인 사항</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#eaeaea]">
                                        {items.map((item) => (
                                            <tr key={item.id} className="text-[13.5px] transition-colors hover:bg-[#fafafa]">
                                                <td className="px-6 py-4 text-center">
                                                    {item.status === 'success' ? <IconCheck /> : item.status === 'error' ? <IconX /> : item.status === 'uploading' ? '...' : '-'}
                                                </td>
                                                <td className="px-6 py-4 font-bold">{item.no}</td>
                                                <td className="px-6 py-4 text-[#666] truncate max-w-[300px]">{item.depth1}</td>
                                                <td className="px-6 py-4 text-[#666] truncate max-w-[300px]">{item.checkPoint}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-300 font-bold">데이터가 없습니다.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4">
                    <div className="vercel-card h-[500px] flex flex-col bg-black overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-[#eaeaea] flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-[#666]">실시간 업로드 로그</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-[#0070f3] animate-pulse" />
                        </div>
                        <div className="flex-1 p-6 font-mono text-[11.5px] leading-6 overflow-auto text-[#888]">
                            {logs.map((log, i) => (
                                <div key={i} className="mb-1 flex gap-4 transition-all animate-in fade-in slide-in-from-left-2">
                                    <span className="text-[#333] select-none">[{items.length - i}]</span>
                                    <span className={log.includes('성공') ? 'text-[#0070f3]' : 'text-[#ee0000]'}>{log}</span>
                                </div>
                            ))}
                            {logs.length === 0 && (
                                <div className="h-full flex items-center justify-center opacity-20 tracking-widest text-white">준비됨...</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

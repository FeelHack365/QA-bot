import React, { useState, useEffect, useMemo } from 'react';

// --- Icons (Inline SVGs for portability) ---
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
    // --- States ---
    const [config, setConfig] = useState({
        token: '',
        databaseId: '',
    });
    const [rawInput, setRawInput] = useState('');
    const [items, setItems] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const [showSettings, setShowSettings] = useState(false);

    // --- Effects ---
    useEffect(() => {
        const savedToken = localStorage.getItem('notion_token');
        const savedDbId = localStorage.getItem('notion_database_id');
        if (savedToken || savedDbId) {
            setConfig({
                token: savedToken || '',
                databaseId: savedDbId || '',
            });
        } else {
            setShowSettings(true); // 처음 방문 시 설정창 열기
        }
    }, []);

    // --- Handlers ---
    const saveConfig = () => {
        localStorage.setItem('notion_token', config.token);
        localStorage.setItem('notion_database_id', config.databaseId);
        alert('✨ 설정이 안전하게 저장되었습니다.');
        setShowSettings(false);
    };

    const parseInput = (text) => {
        if (!text.trim()) {
            setItems([]);
            return;
        }

        const lines = text.trim().split('\n');
        // 헤더 감지 (첫 줄이 'No' 등으로 시작하면 제외)
        const startIdx = (lines[0].toLowerCase().includes('no') || lines[0].toLowerCase().includes('depth')) ? 1 : 0;

        const parsed = lines.slice(startIdx).map((line, idx) => {
            const fields = line.split('\t');
            // TSV가 아니면 CSV로 시도
            const finalFields = fields.length > 1 ? fields : line.split(',');

            return {
                id: idx,
                no: finalFields[0]?.trim() || '',
                depth1: finalFields[1]?.trim() || '',
                depth2: finalFields[2]?.trim() || '',
                checkPoint: finalFields[3]?.trim() || '',
                scenario: finalFields[4]?.trim() || '',
                status: 'ready', // ready, uploading, success, error
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
        // Notion API는 브라우저에서 직접 호출 시 CORS 에러가 발생합니다.
        // Vite Proxy 기능을 사용하여 /notion-api/ 경로로 요청을 보냅니다.
        const response = await fetch('/notion-api/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { database_id: config.databaseId },
                properties: {
                    'No.': {
                        title: [{ text: { content: item.no } }]
                    },
                    '1 Depth 화면': {
                        select: { name: item.depth1 || 'N/A' }
                    },
                    '2 Depth 영역': {
                        rich_text: [{ text: { content: item.depth2 } }]
                    },
                    '확인 사항': {
                        rich_text: [{ text: { content: item.checkPoint } }]
                    },
                    '시나리오': {
                        rich_text: [{ text: { content: item.scenario } }]
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
            throw new Error(errorData.message || 'Notion API Error');
        }
        return response.json();
    };

    const handleUploadAll = async () => {
        if (!config.token || !config.databaseId) {
            alert('⚠️ 설정을 먼저 완료해주세요.');
            setShowSettings(true);
            return;
        }

        if (items.length === 0) {
            alert('⚠️ 업로드할 데이터가 없습니다.');
            return;
        }

        setIsUploading(true);
        setLogs([]);
        setProgress(0);

        const updatedItems = [...items];

        for (let i = 0; i < updatedItems.length; i++) {
            const item = updatedItems[i];

            // 상태 업데이트: uploading
            updatedItems[i] = { ...item, status: 'uploading' };
            setItems([...updatedItems]);

            try {
                await createNotionPage(item);
                updatedItems[i] = { ...item, status: 'success' };
                setLogs(prev => [`✅ [${item.no}] 업로드 성공`, ...prev]);
            } catch (err) {
                console.error(err);
                updatedItems[i] = { ...item, status: 'error', errorMessage: err.message };
                setLogs(prev => [`❌ [${item.no}] 실패: ${err.message}`, ...prev]);
            }

            setProgress(Math.round(((i + 1) / updatedItems.length) * 100));
            setItems([...updatedItems]);

            // Notion Rate Limit (3 req/sec) 방지
            await new Promise(r => setTimeout(r, 400));
        }

        setIsUploading(false);
        alert('🎉 모든 업로드 작업이 완료되었습니다.');
    };

    // --- Sub-components ---
    const StatusBadge = ({ status }) => {
        const styles = {
            ready: 'bg-gray-100 text-gray-500',
            uploading: 'bg-blue-100 text-blue-600 animate-pulse',
            success: 'bg-green-100 text-green-700',
            error: 'bg-red-100 text-red-700',
        };
        const icons = {
            ready: '대기',
            uploading: '중...',
            success: <IconCheck />,
            error: <IconX />,
        };
        return (
            <span className={`px-2 py-1 rounded text-xs font-semibold flex items-center justify-center gap-1 ${styles[status]}`}>
                {icons[status]}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-50" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-50" />
            </div>

            <div className="relative max-w-6xl mx-auto p-6 md:p-12">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold mb-4 tracking-wider uppercase">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            QA Automation Tool
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                            Notion <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Uploader</span>
                        </h1>
                        <p className="mt-4 text-lg text-slate-500 max-w-xl leading-relaxed">
                            Claude가 생성한 QA 리스트를 노션 데이터베이스로 즉시 동기화하세요.
                            복사/붙여넣기 한 번으로 끝냅니다.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`group flex items-center gap-2 px-5 py-3 rounded-2xl transition-all duration-300 ${showSettings
                            ? 'bg-slate-900 text-white shadow-xl scale-105'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm'
                            }`}
                    >
                        <IconSettings />
                        <span className="font-semibold text-sm">연결 설정</span>
                    </button>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Settings Panel (Collapsible) */}
                    {showSettings && (
                        <div className="lg:col-span-12 animate-in slide-in-from-top-4 duration-500">
                            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[32px] p-8 shadow-2xl shadow-indigo-100/50">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                        <IconSettings />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">API 연결 설정</h2>
                                        <p className="text-sm text-slate-400">데이터가 저장될 노션 정보를 입력해주세요.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Internal Integration Token</label>
                                        <input
                                            type="password"
                                            value={config.token}
                                            onChange={(e) => setConfig({ ...config, token: e.target.value })}
                                            placeholder="secret_..."
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Database ID</label>
                                        <input
                                            type="text"
                                            value={config.databaseId}
                                            onChange={(e) => setConfig({ ...config, databaseId: e.target.value })}
                                            placeholder="database_id"
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-2xl">
                                    <p className="text-xs text-indigo-600 font-medium">
                                        ℹ️ 입력된 정보는 브라우저의 LocalStorage에만 저장됩니다.
                                    </p>
                                    <button
                                        onClick={saveConfig}
                                        className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                    >
                                        설정 저장하기
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <IconFile /> TSV 데이터 입력
                                </h2>
                                <button
                                    onClick={() => setRawInput('')}
                                    className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    초기화
                                </button>
                            </div>
                            <textarea
                                value={rawInput}
                                onChange={(e) => setRawInput(e.target.value)}
                                placeholder="QF01-ALL\t로그인\t이메일 필드...\n여기에 TSV 데이터를 붙여넣으세요."
                                className="w-full h-96 p-6 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm leading-relaxed resize-none placeholder:text-slate-300"
                            />
                            <div className="mt-4 p-4 bg-amber-50 rounded-2xl text-[13px] text-amber-700 leading-snug">
                                💡 <b>Claude</b>에게 "위 QA 리스트를 TSV 데이터 블록으로 만들어줘"라고 요청한 뒤 결과를 여기에 붙여넣으시면 됩니다.
                            </div>
                        </div>

                        {items.length > 0 && (
                            <button
                                onClick={handleUploadAll}
                                disabled={isUploading}
                                className={`w-full py-5 rounded-[24px] font-black text-lg transition-all duration-300 shadow-2xl flex items-center justify-center gap-3 ${isUploading
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:scale-[1.02] active:scale-[0.98] shadow-indigo-200'
                                    }`}
                            >
                                {isUploading ? (
                                    <>
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                        </div>
                                        업로드 진행 중
                                    </>
                                ) : (
                                    <>
                                        <IconUpload />
                                        {items.length}개 항목 업로드 시작
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Preview / Results Area */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold">미리보기 및 진행 현황</h3>
                                <div className="text-sm font-bold text-slate-400">
                                    Total: <span className="text-indigo-600">{items.length}</span>
                                </div>
                            </div>

                            {isUploading && (
                                <div className="mb-8 space-y-3">
                                    <div className="flex justify-between text-xs font-black uppercase tracking-wider text-slate-400">
                                        <span>Progress</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.3)]"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {items.length > 0 ? (
                                <div className="flex-1 overflow-auto rounded-2xl border border-slate-50">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-50 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                                                <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">No.</th>
                                                <th className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Check Point</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {items.map((item) => (
                                                <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-3 w-20">
                                                        <StatusBadge status={item.status} />
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{item.no}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{item.checkPoint}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-50 rounded-[24px]">
                                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                        <IconFile />
                                    </div>
                                    <p className="font-bold">데이터를 입력하면 미리보기가 표시됩니다.</p>
                                </div>
                            )}

                            {logs.length > 0 && (
                                <div className="mt-8 bg-slate-900 rounded-[24px] p-6 text-xs font-mono text-slate-400 h-40 overflow-y-auto">
                                    <div className="flex items-center gap-2 mb-3 text-white font-bold tracking-widest uppercase opacity-50">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                        Console Logs
                                    </div>
                                    {logs.map((log, i) => (
                                        <div key={i} className="mb-1 leading-relaxed">
                                            <span className="text-indigo-400 opacity-50">[{new Date().toLocaleTimeString()}]</span> {log}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                <footer className="mt-20 text-center text-slate-400 text-sm">
                    <p>© 2026 QA-Bot Professional. Notion API Integration Tool.</p>
                    <div className="mt-4 flex items-center justify-center gap-6">
                        <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" className="hover:text-indigo-600 transition-colors">Notion API 가이드</a>
                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                        <a href="#" className="hover:text-indigo-600 transition-colors">사용방법 소스보기</a>
                    </div>
                </footer>
            </div>

            {/* Custom Scrollbar Styling */}
            <style jsx="true">{`
                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background: #E2E8F0;
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #CBD5E1;
                }
            `}</style>
        </div>
    );
}

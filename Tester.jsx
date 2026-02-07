import React, { useState, useEffect, useRef } from 'react';
import { useToast } from './App';
import { callGemini, analyzeScenarioWithImage } from './GeminiService';

const IconFlask = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" /><path d="M18 7H6" /><path d="M14 3v8" /><path d="M10 21h4" /></svg>;
const IconCheck = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IconX = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const IconLoading = () => <div className="w-5 h-5 border-3 border-gray-300 border-t-black rounded-full animate-spin" />;

export default function Tester() {
    const { addToast } = useToast();
    const [settings, setSettings] = useState({
        notionToken: '',
        databaseId: '',
        deeplApiKey: '',
        geminiApiKey: '',
        glossary: ''
    });

    const [testItems, setTestItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isFailMode, setIsFailMode] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Fail Form State
    const [failForm, setFailForm] = useState({
        title: '',
        bodyKr: '',
        imageUrl: ''
    });

    // New Scenario Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [newScenario, setNewScenario] = useState({
        memo: '',
        image: null,
        imagePreview: ''
    });
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const loadSettings = () => {
            setSettings({
                notionToken: localStorage.getItem('notion_token') || '',
                databaseId: localStorage.getItem('notion_database_id') || '',
                deeplApiKey: localStorage.getItem('deeplApiKey') || '',
                geminiApiKey: localStorage.getItem('geminiApiKey') || '',
                glossary: localStorage.getItem('glossary') || ''
            });
        };
        loadSettings();
        window.addEventListener('storage', loadSettings);
        return () => window.removeEventListener('storage', loadSettings);
    }, []);

    // Notion API Call Helper
    const callNotionApi = async (path, method, body) => {
        const isLocal = window.location.hostname === 'localhost';
        const apiPath = isLocal ? `/notion-api${path}` : '/api/notion';

        const options = isLocal ? {
            method: method,
            headers: {
                'Authorization': `Bearer ${settings.notionToken.trim()}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: body ? JSON.stringify(body) : undefined
        } : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: settings.notionToken.trim(),
                path: path,
                method: method,
                body: body
            })
        };

        const response = await fetch(apiPath, options);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Notion API 오류');
        return data;
    };

    // Gemini API Call Helper
    const callGeminiApi = async (text) => {
        return await callGemini(text, settings.glossary, settings.geminiApiKey);
    };

    const loadPendingItems = async () => {
        // Explicitly refresh settings from localStorage before starting
        const currentToken = localStorage.getItem('notion_token') || '';
        const currentDbId = localStorage.getItem('notion_database_id') || '';
        const currentDeepL = localStorage.getItem('deeplApiKey') || '';

        setSettings({
            notionToken: currentToken,
            databaseId: currentDbId,
            deeplApiKey: currentDeepL
        });

        if (!currentToken || !currentDbId) {
            addToast('먼저 설정 탭에서 노션 API 토큰과 데이터베이스 ID를 입력해주세요.', 'error');
            return;
        }

        setLoading(true);
        try {
            const dbId = settings.databaseId.trim().replace(/-/g, '');
            const data = await callNotionApi(`/v1/databases/${dbId}/query`, 'POST', {
                filter: {
                    and: [
                        { property: '결과', select: { equals: 'PENDING' } }
                    ]
                }
            });

            const items = data.results.map(page => ({
                id: page.id,
                no: page.properties['No.']?.title?.[0]?.text?.content || '-',
                depth1: page.properties['1 Depth 화면']?.select?.name || '',
                depth2: page.properties['2 Depth 영역']?.rich_text?.[0]?.text?.content || '',
                checkPoint: page.properties['확인 사항']?.rich_text?.[0]?.text?.content || '',
                scenario: page.properties['시나리오']?.rich_text?.[0]?.text?.content || ''
            }));

            setTestItems(items);
            setCurrentIndex(0);
            setIsFailMode(false);
            if (items.length === 0) addToast('진행할 테스트(PENDING) 항목이 없습니다.', 'success');
            else addToast(`✅ ${items.length}개의 테스트 항목을 불러왔습니다.`);
        } catch (err) {
            addToast(`오류: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePass = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        const item = testItems[currentIndex];

        try {
            await callNotionApi(`/v1/pages/${item.id}`, 'PATCH', {
                properties: {
                    '결과': { select: { name: 'PASS' } }
                }
            });
            addToast(`${item.no} PASS 저장 완료`);
            moveToNext();
        } catch (err) {
            addToast(`오류: ${err.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async () => {
        if (isProcessing) return;
        if (!confirm('정말 이 항목을 삭제(DELETE 상태로 변경)하시겠습니까?')) return;

        setIsProcessing(true);
        const item = testItems[currentIndex];

        try {
            await callNotionApi(`/v1/pages/${item.id}`, 'PATCH', {
                properties: {
                    '결과': { select: { name: 'DELETE' } }
                }
            });
            addToast(`${item.no} DELETE 처리 완료`);
            moveToNext();
        } catch (err) {
            addToast(`오류: ${err.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFailClick = () => {
        setFailForm({ title: '', bodyKr: '', imageUrl: '' });
        setIsFailMode(true);
    };

    const handleFailSubmit = async () => {
        if (isProcessing) return;
        if (!failForm.title.trim()) { addToast('제목을 입력해주세요.', 'error'); return; }

        setIsProcessing(true);
        const item = testItems[currentIndex];

        try {
            // 1. Gemini 번역 & QA 스타일 변환
            let bodyKr = failForm.bodyKr;
            let bodyEn = '';

            if (settings.geminiApiKey) {
                const inputText = `제목: ${failForm.title}\n내용: ${failForm.bodyKr}`;
                const result = await callGeminiApi(inputText);
                bodyKr = result.kr;
                bodyEn = result.en;
            }

            // 2. Notion 업데이트
            await callNotionApi(`/v1/pages/${item.id}`, 'PATCH', {
                properties: {
                    '결과': { select: { name: 'FAIL' } },
                    '제목': { rich_text: [{ text: { content: failForm.title } }] },
                    '본문 (한글)': { rich_text: [{ text: { content: bodyKr } }] },
                    '본문 (영문)': { rich_text: [{ text: { content: bodyEn } }] },
                    '이미지 링크': { url: failForm.imageUrl || null }
                }
            });

            addToast(`${item.no} FAIL 저장 및 번역 완료`);
            setIsFailMode(false);
            moveToNext();
        } catch (err) {
            addToast(`오류: ${err.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSkip = () => {
        if (testItems.length <= 1) return;

        const newItems = [...testItems];
        const currentItem = newItems.splice(currentIndex, 1)[0];
        newItems.push(currentItem);

        setTestItems(newItems);
        setIsFailMode(false);
        addToast(`[${currentItem.no}] 항목을 맨 뒤로 보냈습니다.`);
    };

    const moveToNext = () => {
        setIsFailMode(false);
        setFailForm({ title: '', bodyKr: '', imageUrl: '' });
        if (currentIndex < testItems.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setTestItems([]);
            addToast('🎉 모든 테스트 항목을 완료했습니다!', 'success');
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewScenario(prev => ({ ...prev, image: file, imagePreview: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const generateUniqueNo = async () => {
        try {
            const dbId = settings.databaseId.trim().replace(/-/g, '');
            // Fetch more items to find the true maximum number in the database
            const data = await callNotionApi(`/v1/databases/${dbId}/query`, 'POST', {
                page_size: 100
            });

            const numericNos = data.results
                .map(p => p.properties['No.']?.title?.[0]?.text?.content || '')
                .map(no => {
                    const match = no.match(/\d+/);
                    return match ? parseInt(match[0]) : NaN;
                })
                .filter(no => !isNaN(no));

            if (numericNos.length > 0) {
                const maxNo = Math.max(...numericNos);
                return `Gem${(maxNo + 1).toString().padStart(3, '0')}`;
            }
            return `Gem001`;
        } catch (err) {
            console.error('No generation error:', err);
            return `Gem${Math.floor(Math.random() * 900) + 100}`;
        }
    };

    const handleAnalysis = async () => {
        if (!newScenario.memo.trim()) { addToast('메모를 입력해주세요.', 'error'); return; }
        if (!newScenario.imagePreview) { addToast('이미지를 첨부해주세요.', 'error'); return; }
        if (!settings.geminiApiKey) { addToast('Gemini API Key가 필요합니다.', 'error'); return; }

        setIsGenerating(true);
        try {
            const analysis = await analyzeScenarioWithImage(
                newScenario.imagePreview,
                newScenario.memo,
                settings.glossary,
                settings.geminiApiKey
            );
            setAnalysisResult(analysis);
            setIsAnalysisComplete(true);
            addToast('AI 분석이 완료되었습니다. 내용을 확인 후 저장하세요.');
        } catch (err) {
            addToast(`분석 오류: ${err.message}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePushToNotion = async () => {
        if (!analysisResult) return;
        setIsProcessing(true);
        try {
            const uniqueNo = await generateUniqueNo();
            const dbId = settings.databaseId.trim().replace(/-/g, '');
            await callNotionApi('/v1/pages', 'POST', {
                parent: { database_id: dbId },
                properties: {
                    'No.': { title: [{ text: { content: uniqueNo } }] },
                    '1 Depth 화면': { select: { name: analysisResult.depth1 } },
                    '2 Depth 영역': { rich_text: [{ text: { content: analysisResult.depth2 } }] },
                    '확인 사항': { rich_text: [{ text: { content: analysisResult.checkPoint } }] },
                    '시나리오': { rich_text: [{ text: { content: analysisResult.scenario } }] },
                    '결과': { select: { name: 'FAIL' } },
                    '제목': { rich_text: [{ text: { content: analysisResult.title } }] },
                    '본문 (한글)': { rich_text: [{ text: { content: analysisResult.bodyKr } }] },
                    '본문 (영문)': { rich_text: [{ text: { content: analysisResult.bodyEn } }] },
                    '이미지 링크': { url: null },
                    '전송 상태': { select: { name: '전송완료' } }
                }
            });

            addToast(`✅ 새 시나리오(${uniqueNo})가 성공적으로 추가되었습니다!`, 'success');
            setIsModalOpen(false);
            setNewScenario({ memo: '', image: null, imagePreview: '' });
            setAnalysisResult(null);
            setIsAnalysisComplete(false);
        } catch (err) {
            addToast(`저장 오류: ${err.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setAnalysisResult(null);
        setIsAnalysisComplete(false);
        setNewScenario({ memo: '', image: null, imagePreview: '' });
    };

    const currentItem = testItems[currentIndex];

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-[32px] font-bold tracking-tighter text-black flex items-center gap-3">
                        테스트 진행
                    </h1>
                    <p className="text-[#666] text-[15px]">PENDING 상태의 항목을 불러와 하나씩 테스트하고 결과를 기록합니다.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setIsModalOpen(true)} className="vercel-btn-secondary !border-black">
                        새 시나리오 추가
                    </button>
                    <button onClick={loadPendingItems} disabled={loading} className="vercel-btn-primary">
                        {loading ? '불러오는 중...' : 'PENDING 항목 불러오기'}
                    </button>
                </div>
            </div>

            {testItems.length > 0 ? (
                <div className="max-w-[1100px] mx-auto transition-all duration-500">
                    {/* Progress Count */}
                    <div className="mb-3 flex justify-end">
                        <span className="text-[12px] font-bold text-[#999] tracking-widest uppercase">{currentIndex + 1} / {testItems.length}</span>
                    </div>

                    {/* Test Card */}
                    <div className="vercel-card overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
                        {/* Card Header */}
                        <div className="px-8 py-5 border-b border-[#eaeaea] bg-[#fafafa] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-[14px] font-medium text-[#888]">No.</span>
                                <span className="text-[18px] font-black text-black">{currentItem.no}</span>
                            </div>
                            {!isFailMode && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleDelete}
                                        disabled={isProcessing}
                                        className="text-[11px] px-4 py-1.5 bg-white border border-[#eaeaea] text-[#ee0000] hover:border-[#ee0000] rounded-full font-bold uppercase tracking-widest transition-all shadow-sm disabled:opacity-50"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        onClick={handleSkip}
                                        disabled={isProcessing}
                                        className="text-[11px] px-4 py-1.5 bg-white border border-[#eaeaea] text-[#666] hover:text-black hover:border-black rounded-full font-bold uppercase tracking-widest transition-all shadow-sm"
                                    >
                                        Skip
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className={`p-0 grid grid-cols-1 ${isFailMode ? 'lg:grid-cols-2' : ''} divide-x-0 lg:divide-x divide-[#eaeaea]`}>
                            {/* Left Side: Test Information */}
                            <div className="p-10 space-y-8 flex flex-col transition-all">
                                <div className="space-y-8 flex-1">
                                    <div>
                                        <label className="text-[11px] font-black text-[#888] uppercase tracking-[.2em] block mb-2.5">Context</label>
                                        <div className="text-[17px] font-bold text-black leading-tight flex items-center gap-2 flex-wrap">
                                            <span>{currentItem.depth1}</span>
                                            <span className="text-[#ddd] font-light">/</span>
                                            <span>{currentItem.depth2}</span>
                                            <span className="text-[#ddd] font-light">/</span>
                                            <span>{currentItem.checkPoint}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-black text-[#888] uppercase tracking-[.2em] block mb-2.5">Scenario</label>
                                        <div className="text-[15px] leading-relaxed text-[#444] bg-[#fcfcfc] p-6 rounded-xl border border-[#f0f0f0] shadow-sm">
                                            {currentItem.scenario}
                                        </div>
                                    </div>
                                </div>

                                {/* PASS/FAIL Buttons for Normal Mode */}
                                {!isFailMode && (
                                    <div className="grid grid-cols-2 gap-4 mt-12">
                                        <button
                                            onClick={handlePass}
                                            disabled={isProcessing}
                                            className="h-16 flex items-center justify-center gap-3 bg-white border border-[#eaeaea] hover:border-black rounded-xl transition-all group shadow-sm"
                                        >
                                            {isProcessing ? <IconLoading /> : <IconCheck className="text-[#0070f3] group-hover:scale-110 transition-transform" />}
                                            <span className="font-bold text-[16px] text-black uppercase tracking-widest">PASS</span>
                                        </button>
                                        <button
                                            onClick={handleFailClick}
                                            disabled={isProcessing}
                                            className="h-16 flex items-center justify-center gap-3 bg-white border border-[#eaeaea] hover:border-[#ee0000] rounded-xl transition-all group shadow-sm"
                                        >
                                            <IconX className="text-[#ee0000] group-hover:scale-110 transition-transform" />
                                            <span className="font-bold text-[16px] text-black uppercase tracking-widest">FAIL</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Right Side: FAIL Form */}
                            {isFailMode && (
                                <div className="bg-[#fafafa] p-10 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col">
                                    <div className="space-y-7 flex-1">
                                        <div className="flex items-center gap-3 border-b border-[#eaeaea] pb-5">

                                            <h3 className="text-[18px] font-bold text-black tracking-tight">FAIL 상세 정보 기록</h3>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">제목</label>
                                            <input
                                                type="text"
                                                value={failForm.title}
                                                onChange={(e) => setFailForm({ ...failForm, title: e.target.value })}
                                                placeholder="예: 로그인 버튼 클릭 시 무반응"
                                                className="w-full px-4 py-3 border border-[#eaeaea] focus:border-black rounded-lg text-[14px] outline-none transition-all bg-white shadow-sm"
                                                disabled={isProcessing}
                                                autoFocus
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">상세 내용</label>
                                                <button
                                                    onClick={() => setFailForm({ ...failForm, bodyKr: (failForm.bodyKr ? failForm.bodyKr + '\n\n' : '') + currentItem.scenario })}
                                                    className="text-[10px] px-2 py-1 bg-white border border-[#eaeaea] text-[#888] hover:text-black hover:border-black rounded-md transition-all font-bold flex items-center gap-1 shadow-sm"
                                                >
                                                    시나리오 붙여넣기
                                                </button>
                                            </div>
                                            <textarea
                                                value={failForm.bodyKr}
                                                onChange={(e) => setFailForm({ ...failForm, bodyKr: e.target.value })}
                                                placeholder="재현 경로 및 실제 결과를 입력하세요."
                                                className="w-full h-36 px-4 py-3 border border-[#eaeaea] focus:border-black rounded-lg text-[14px] outline-none transition-all resize-none bg-white shadow-sm"
                                                disabled={isProcessing}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">이미지 URL (선택)</label>
                                            <input
                                                type="text"
                                                value={failForm.imageUrl}
                                                onChange={(e) => setFailForm({ ...failForm, imageUrl: e.target.value })}
                                                placeholder="https://imgur.com/..."
                                                className="w-full px-4 py-3 border border-[#eaeaea] focus:border-black rounded-lg text-[14px] outline-none transition-all bg-white shadow-sm"
                                                disabled={isProcessing}
                                            />
                                        </div>
                                    </div>

                                    {/* Action Buttons for Fail Mode */}
                                    <div className="flex gap-4 mt-8">
                                        <button
                                            onClick={() => setIsFailMode(false)}
                                            disabled={isProcessing}
                                            className="flex-1 h-14 flex items-center justify-center bg-white border border-[#eaeaea] hover:border-black rounded-xl transition-all font-bold text-[15px] text-[#666] hover:text-black shadow-sm"
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={handleFailSubmit}
                                            disabled={isProcessing}
                                            className="flex-[1.5] h-14 flex items-center justify-center bg-black hover:bg-[#333] text-white rounded-xl transition-all font-bold text-[15px] shadow-lg disabled:bg-[#888]"
                                        >
                                            {isProcessing ? <IconLoading /> : <span>번역 후 저장</span>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="vercel-card h-[400px] flex flex-col items-center justify-center border-dashed border-2 opacity-60">
                    <p className="text-lg font-bold text-black mb-2">테스트 준비 완료</p>
                    <p className="text-[#666] text-sm">상단 버튼을 눌러 작업을 시작하세요.</p>
                </div>
            )}

            {/* New Scenario Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className={`bg-white rounded-3xl w-full ${isAnalysisComplete ? 'max-w-[1000px]' : 'max-w-[600px]'} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]`}>
                        <div className="px-8 py-6 border-b border-[#eaeaea] flex justify-between items-center bg-white sticky top-0 z-10">
                            <h2 className="text-xl font-bold">새 시나리오 추가</h2>
                            <button onClick={handleModalClose} className="text-[#888] hover:text-black transition-colors">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {!isAnalysisComplete ? (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">스크린샷 첨부</label>
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="aspect-video w-full border-2 border-dashed border-[#eaeaea] rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-black transition-all bg-[#fafafa] overflow-hidden group"
                                        >
                                            {newScenario.imagePreview ? (
                                                <div className="relative w-full h-full">
                                                    <img src={newScenario.imagePreview} className="w-full h-full object-cover" alt="Preview" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                                                        <span className="text-white opacity-0 group-hover:opacity-100 font-bold">이미지 변경하기</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                                    <p className="text-[13px] text-[#888]">이미지를 드래그하거나 클릭하여 업로드</p>
                                                </>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImageChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">메모 (상황 설명)</label>
                                        <textarea
                                            value={newScenario.memo}
                                            onChange={(e) => setNewScenario(prev => ({ ...prev, memo: e.target.value }))}
                                            placeholder="예: 마이페이지 프로필 수정 화면인데, 저장 버튼이 하단에 가려져서 안보임"
                                            className="w-full h-28 px-4 py-3 border border-[#eaeaea] focus:border-black rounded-xl text-[14px] outline-none transition-all resize-none bg-[#fafafa] shadow-inner"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Left Side: Basic Info */}
                                    <div className="space-y-6">
                                        <div className="p-4 bg-[#f8f8f8] rounded-2xl border border-[#eee]">
                                            <img src={newScenario.imagePreview} className="w-full rounded-xl shadow-sm border border-[#eee]" alt="Screenshot" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">1 Depth (화면)</label>
                                                <input
                                                    type="text"
                                                    value={analysisResult.depth1}
                                                    onChange={(e) => setAnalysisResult({ ...analysisResult, depth1: e.target.value })}
                                                    className="w-full px-4 py-2.5 border border-[#eaeaea] focus:border-black rounded-lg text-[14px] bg-white outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">2 Depth (영역)</label>
                                                <input
                                                    type="text"
                                                    value={analysisResult.depth2}
                                                    onChange={(e) => setAnalysisResult({ ...analysisResult, depth2: e.target.value })}
                                                    className="w-full px-4 py-2.5 border border-[#eaeaea] focus:border-black rounded-lg text-[14px] bg-white outline-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">확인 사항</label>
                                            <input
                                                type="text"
                                                value={analysisResult.checkPoint}
                                                onChange={(e) => setAnalysisResult({ ...analysisResult, checkPoint: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-[#eaeaea] focus:border-black rounded-lg text-[14px] bg-white outline-none transition-all"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">시나리오 (1줄 요약)</label>
                                            <input
                                                type="text"
                                                value={analysisResult.scenario}
                                                onChange={(e) => setAnalysisResult({ ...analysisResult, scenario: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-[#eaeaea] focus:border-black rounded-lg text-[14px] bg-white outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Right Side: Detailed Results */}
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">제목 (자동 구성)</label>
                                            <input
                                                type="text"
                                                value={analysisResult.title}
                                                onChange={(e) => setAnalysisResult({ ...analysisResult, title: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-[#eaeaea] focus:border-black rounded-lg text-[14px] bg-white outline-none transition-all font-bold"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">본문 (한글)</label>
                                            <textarea
                                                value={analysisResult.bodyKr}
                                                onChange={(e) => setAnalysisResult({ ...analysisResult, bodyKr: e.target.value })}
                                                className="w-full h-40 px-4 py-3 border border-[#eaeaea] focus:border-black rounded-xl text-[13px] bg-white outline-none transition-all resize-none leading-relaxed"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-[#888] uppercase tracking-widest">본문 (영어 - 번역)</label>
                                            <textarea
                                                value={analysisResult.bodyEn}
                                                onChange={(e) => setAnalysisResult({ ...analysisResult, bodyEn: e.target.value })}
                                                className="w-full h-40 px-4 py-3 border border-[#eaeaea] focus:border-black rounded-xl text-[13px] bg-white outline-none transition-all resize-none leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-8 py-6 bg-[#fafafa] border-t border-[#eaeaea] flex gap-3 sticky bottom-0 z-10">
                            <button
                                onClick={handleModalClose}
                                className="flex-1 h-12 rounded-xl font-bold text-[#666] hover:text-black hover:bg-white border border-transparent hover:border-[#eaeaea] transition-all"
                            >
                                취소
                            </button>

                            {!isAnalysisComplete ? (
                                <button
                                    onClick={handleAnalysis}
                                    disabled={isGenerating}
                                    className="flex-[2] h-12 bg-black text-white rounded-xl font-bold hover:bg-[#333] transition-all flex items-center justify-center gap-2 shadow-lg disabled:bg-[#888]"
                                >
                                    {isGenerating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>AI 분석 중...</span>
                                        </>
                                    ) : (
                                        <span>내용 구성 및 분석하기</span>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={handlePushToNotion}
                                    disabled={isProcessing}
                                    className="flex-[2] h-12 bg-[#0070f3] text-white rounded-xl font-bold hover:bg-[#0060df] transition-all flex items-center justify-center gap-2 shadow-lg disabled:bg-[#888]"
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>전송 중...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                                            <span>노션에 최종 전송</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

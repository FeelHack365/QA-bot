import React, { useState, useEffect } from 'react';
import { useToast } from './App';

const IconFlask = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" /><path d="M18 7H6" /><path d="M14 3v8" /><path d="M10 21h4" /></svg>;
const IconCheck = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IconX = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const IconLoading = () => <div className="w-5 h-5 border-3 border-gray-300 border-t-black rounded-full animate-spin" />;

export default function Tester() {
    const { addToast } = useToast();
    const [settings, setSettings] = useState({
        notionToken: '',
        databaseId: '',
        deeplApiKey: ''
    });

    const [testItems, setTestItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showFailModal, setShowFailModal] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Fail Modal Form
    const [failForm, setFailForm] = useState({
        title: '',
        bodyKr: '',
        imageUrl: ''
    });

    useEffect(() => {
        const loadSettings = () => {
            setSettings({
                notionToken: localStorage.getItem('notion_token') || '',
                databaseId: localStorage.getItem('notion_database_id') || '',
                deeplApiKey: localStorage.getItem('deeplApiKey') || ''
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

    // DeepL API Call Helper
    const callTranslateApi = async (texts) => {
        const isLocal = window.location.hostname === 'localhost';
        const apiPath = isLocal ? `/translate-api/v2/translate` : '/api/translate';
        const payload = Array.isArray(texts) ? texts : [texts];

        const options = isLocal ? {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${settings.deeplApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: payload, target_lang: 'EN', source_lang: 'KO' })
        } : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: settings.deeplApiKey, text: payload, target_lang: 'EN', source_lang: 'KO' })
        };

        const response = await fetch(apiPath, options);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'DeepL API 오류');
        return data.translations.map(t => t.text);
    };

    const loadPendingItems = async () => {
        if (!settings.notionToken || !settings.databaseId) {
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

    const handleFailClick = () => {
        setFailForm({ title: '', bodyKr: '', imageUrl: '' });
        setShowFailModal(true);
    };

    const handleFailSubmit = async () => {
        if (isProcessing) return;
        if (!failForm.title.trim()) { addToast('제목을 입력해주세요.', 'error'); return; }

        setIsProcessing(true);
        const item = testItems[currentIndex];

        try {
            // 1. 번역 (DeepL)
            let bodyEn = '';
            if (settings.deeplApiKey) {
                const textsToTranslate = [failForm.title];
                if (failForm.bodyKr) textsToTranslate.push(failForm.bodyKr);
                const translated = await callTranslateApi(textsToTranslate);
                bodyEn = translated.join('\n\n');
            }

            // 2. Notion 업데이트
            await callNotionApi(`/v1/pages/${item.id}`, 'PATCH', {
                properties: {
                    '결과': { select: { name: 'FAIL' } },
                    '제목': { rich_text: [{ text: { content: failForm.title } }] },
                    '본문 (한글)': { rich_text: [{ text: { content: failForm.bodyKr } }] },
                    '본문 (영문)': { rich_text: [{ text: { content: bodyEn } }] },
                    '이미지 링크': { url: failForm.imageUrl || null }
                }
            });

            addToast(`${item.no} FAIL 저장 및 번역 완료`);
            setShowFailModal(false);
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
        addToast(`[${currentItem.no}] 항목을 맨 뒤로 보냈습니다.`);
    };

    const moveToNext = () => {
        if (currentIndex < testItems.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setTestItems([]);
            addToast('🎉 모든 테스트 항목을 완료했습니다!', 'success');
        }
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
                <button onClick={loadPendingItems} disabled={loading} className="vercel-btn-secondary">
                    {loading ? '불러오는 중...' : 'PENDING 항목 불러오기'}
                </button>
            </div>

            {testItems.length > 0 ? (
                <div className="max-w-[700px] mx-auto">
                    {/* Progress Count */}
                    <div className="mb-2 flex justify-end">
                        <span className="text-[12px] font-medium text-[#999] tracking-tight">{currentIndex + 1} / {testItems.length}</span>
                    </div>

                    {/* Test Card */}
                    <div className="vercel-card overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="px-8 py-6 border-b border-[#eaeaea] bg-[#fafafa] flex items-center justify-between">
                            <span className="text-xl font-black">{currentItem.no}</span>
                            <button
                                onClick={handleSkip}
                                className="text-[12px] px-4 py-1.5 bg-white border border-[#eaeaea] text-[#666] hover:text-black hover:border-black rounded-full font-bold uppercase tracking-widest transition-all shadow-sm"
                            >
                                Skip
                            </button>
                        </div>

                        <div className="p-10 space-y-8">
                            <div>
                                <label className="text-[11px] font-bold text-[#888] uppercase tracking-[.2em] block mb-3">Context</label>
                                <div className="text-lg font-bold text-black leading-snug">
                                    {currentItem.depth1}
                                    <span className="text-[#eaeaea] mx-2">/</span>
                                    {currentItem.depth2}
                                    <span className="text-[#eaeaea] mx-2">/</span>
                                    {currentItem.checkPoint}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-8">
                                <div>
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracking-[.2em] block mb-3">Scenario</label>
                                    <p className="text-[16px] leading-relaxed text-[#666] bg-[#fafafa] p-5 rounded-lg border border-[#f0f0f0]">
                                        {currentItem.scenario}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 border-t border-[#eaeaea]">
                            <button
                                onClick={handlePass}
                                disabled={isProcessing}
                                className="h-20 flex items-center justify-center gap-3 bg-white hover:bg-[#fafafa] transition-all group border-r border-[#eaeaea]"
                            >
                                {isProcessing ? <IconLoading /> : <IconCheck className="text-[#0070f3] group-hover:scale-125 transition-transform" />}
                                <span className="font-bold text-lg text-black">PASS</span>
                            </button>
                            <button
                                onClick={handleFailClick}
                                disabled={isProcessing}
                                className="h-20 flex items-center justify-center gap-3 bg-white hover:bg-[#fafafa] transition-all group"
                            >
                                <IconX className="text-[#ee0000] group-hover:scale-125 transition-transform" />
                                <span className="font-bold text-lg text-black">FAIL</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="vercel-card h-[400px] flex flex-col items-center justify-center border-dashed border-2 opacity-60">

                    <p className="text-lg font-bold text-black mb-2">테스트 준비 완료</p>
                    <p className="text-[#666] text-sm">상단 버튼을 눌러 작업을 시작하세요.</p>
                </div>
            )}

            {/* FAIL Modal */}
            {showFailModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isProcessing && setShowFailModal(false)} />
                    <div className="bg-white rounded-lg w-full max-w-[500px] relative shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
                        <div className="px-8 py-6 border-b border-[#eaeaea] bg-black text-white flex items-center justify-between">
                            <h3 className="text-lg font-bold">FAIL 상세 정보 기록</h3>
                            <button onClick={() => setShowFailModal(false)} className="opacity-60 hover:opacity-100">
                                <IconX width="20" height="20" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest">제목</label>
                                <input
                                    type="text"
                                    value={failForm.title}
                                    onChange={(e) => setFailForm({ ...failForm, title: e.target.value })}
                                    placeholder="예: 로그인 버튼 클릭 시 무반응"
                                    className="w-full px-4 py-3 border border-[#eaeaea] focus:border-black rounded-md text-[14px] outline-none transition-all"
                                    disabled={isProcessing}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest">상세 내용</label>
                                <textarea
                                    value={failForm.bodyKr}
                                    onChange={(e) => setFailForm({ ...failForm, bodyKr: e.target.value })}
                                    placeholder="재현 경로 및 실제 결과를 입력하세요."
                                    className="w-full h-32 px-4 py-3 border border-[#eaeaea] focus:border-black rounded-md text-[14px] outline-none transition-all resize-none"
                                    disabled={isProcessing}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest">이미지 URL(선택)</label>
                                <input
                                    type="text"
                                    value={failForm.imageUrl}
                                    onChange={(e) => setFailForm({ ...failForm, imageUrl: e.target.value })}
                                    placeholder="https://imgur.com/..."
                                    className="w-full px-4 py-3 border border-[#eaeaea] focus:border-black rounded-md text-[14px] outline-none transition-all"
                                    disabled={isProcessing}
                                />
                            </div>
                        </div>
                        <div className="p-8 bg-[#fafafa] border-t border-[#eaeaea] flex gap-3">
                            <button
                                onClick={() => setShowFailModal(false)}
                                disabled={isProcessing}
                                className="flex-1 vercel-btn-secondary"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleFailSubmit}
                                disabled={isProcessing}
                                className="flex-[2] vercel-btn-primary flex items-center justify-center gap-2"
                            >

                                {isProcessing ? '처리 중...' : '번역 후 Notion 저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { useToast } from './App';

const IconTranslate = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></svg>;
const IconCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0070f3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IconLoading = () => <div className="w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin" />;

export default function TranslationHelper() {
    const { addToast } = useToast();

    // Settings from LocalStorage
    const [settings, setSettings] = useState({
        notionToken: '',
        databaseId: '',
        deeplApiKey: ''
    });

    // State
    const [loading, setLoading] = useState(false);
    const [translationItems, setTranslationItems] = useState([]);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    useEffect(() => {
        setSettings({
            notionToken: localStorage.getItem('notion_token') || '',
            databaseId: localStorage.getItem('notion_database_id') || '',
            deeplApiKey: localStorage.getItem('deeplApiKey') || ''
        });
    }, []);

    // Notion API Call Helper
    const callNotionApi = async (path, method, body) => {
        const isLocal = window.location.hostname === 'localhost';
        const apiPath = isLocal ? `/notion-api${path}` : '/api/notion';

        const options = isLocal ? {
            method: method,
            headers: {
                'Authorization': `Bearer ${settings.notionToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: body ? JSON.stringify(body) : undefined
        } : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: settings.notionToken,
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
    const callTranslateApi = async (text) => {
        const isLocal = window.location.hostname === 'localhost';
        const apiPath = isLocal ? `/translate-api/v2/translate` : '/api/translate';

        const options = isLocal ? {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${settings.deeplApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: [text],
                target_lang: 'EN',
                source_lang: 'KO'
            })
        } : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: settings.deeplApiKey,
                text: text,
                target_lang: 'EN',
                source_lang: 'KO'
            })
        };

        const response = await fetch(apiPath, options);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'DeepL API 오류');
        return data.translations[0].text;
    };

    // Fetch items from Notion
    const fetchTranslationItems = async () => {
        if (!settings.notionToken || !settings.databaseId) {
            addToast('먼저 설정 탭에서 노션 API 토큰과 데이터베이스 ID를 입력해주세요.', 'error');
            return;
        }

        setLoading(true);
        try {
            const dbId = settings.databaseId.replace(/-/g, '');
            const data = await callNotionApi(`/v1/databases/${dbId}/query`, 'POST', {
                filter: {
                    and: [
                        {
                            property: '본문 (한글)',
                            rich_text: { is_not_empty: true }
                        },
                        {
                            property: '본문 (영문)',
                            rich_text: { is_empty: true }
                        }
                    ]
                }
            });

            const items = data.results.map(page => ({
                id: page.id,
                no: page.properties['No.']?.title?.[0]?.text?.content || 'Unknown',
                title: page.properties['제목']?.rich_text?.[0]?.text?.content || '',
                bodyKr: page.properties['본문 (한글)']?.rich_text?.[0]?.text?.content || '',
                bodyEn: '',
                status: 'ready'
            }));

            setTranslationItems(items);
            if (items.length === 0) {
                addToast('번역 대기 중인 항목이 없습니다.', 'success');
            } else {
                addToast(`✅ ${items.length}개의 항목을 불러왔습니다.`);
            }
        } catch (err) {
            addToast(`오류: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Individual item translation
    const translateItem = async (index) => {
        if (!settings.deeplApiKey) {
            addToast('설정 탭에서 DeepL API Key를 먼저 입력해주세요.', 'error');
            return;
        }

        const item = translationItems[index];
        const newItems = [...translationItems];
        newItems[index].status = 'translating';
        setTranslationItems(newItems);

        try {
            const translated = await callTranslateApi(item.bodyKr);
            const updatedItems = [...translationItems];
            updatedItems[index].bodyEn = translated;
            updatedItems[index].status = 'translated';
            setTranslationItems(updatedItems);
            addToast(`${item.no} 번역 완료!`);
        } catch (err) {
            const updatedItems = [...translationItems];
            updatedItems[index].status = 'error';
            setTranslationItems(updatedItems);
            addToast(`번역 실패: ${err.message}`, 'error');
        }
    };

    // Translate all items
    const translateAll = async () => {
        if (!settings.deeplApiKey) {
            addToast('설정 탭에서 DeepL API Key를 먼저 입력해주세요.', 'error');
            return;
        }

        setLoading(true);
        const itemsToTranslate = translationItems.filter(item => !item.bodyEn);
        setProgress({ current: 0, total: itemsToTranslate.length });

        const newItems = [...translationItems];
        let completedCount = 0;

        for (let i = 0; i < newItems.length; i++) {
            if (!newItems[i].bodyEn) {
                newItems[i].status = 'translating';
                setTranslationItems([...newItems]);

                try {
                    const translated = await callTranslateApi(newItems[i].bodyKr);
                    newItems[i].bodyEn = translated;
                    newItems[i].status = 'translated';
                    completedCount++;
                    setProgress(prev => ({ ...prev, current: completedCount }));
                    setTranslationItems([...newItems]);

                    // DeepL Rate Limit 
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (err) {
                    newItems[i].status = 'error';
                    setTranslationItems([...newItems]);
                    addToast(`${newItems[i].no} 번역 실패: ${err.message}`, 'error');
                }
            }
        }

        setLoading(false);
        if (completedCount === itemsToTranslate.length) {
            addToast(`🎉 전체 번역 완료! (${completedCount}건)`);
        } else {
            addToast(`⚠️ 번역 완료 (성공: ${completedCount}, 실패: ${itemsToTranslate.length - completedCount})`, 'error');
        }
    };

    // Save specific item to Notion
    const saveToNotion = async (item, index) => {
        const newItems = [...translationItems];
        newItems[index].status = 'saving';
        setTranslationItems(newItems);

        try {
            await callNotionApi(`/v1/pages/${item.id}`, 'PATCH', {
                properties: {
                    '본문 (영문)': {
                        rich_text: [{ text: { content: item.bodyEn } }]
                    }
                }
            });

            const updatedItems = [...translationItems];
            updatedItems[index].status = 'saved';
            setTranslationItems(updatedItems);
            addToast(`${item.no} 노션 저장 완료!`);
        } catch (err) {
            const updatedItems = [...translationItems];
            updatedItems[index].status = 'error';
            setTranslationItems(updatedItems);
            addToast(`저장 실패: ${err.message}`, 'error');
        }
    };

    // Save all translated items to Notion
    const saveAll = async () => {
        const itemsToSave = translationItems.filter(item => item.bodyEn && item.status !== 'saved');
        if (itemsToSave.length === 0) return;

        setLoading(true);
        setProgress({ current: 0, total: itemsToSave.length });

        const newItems = [...translationItems];
        let savedCount = 0;

        for (let i = 0; i < newItems.length; i++) {
            if (newItems[i].bodyEn && newItems[i].status !== 'saved') {
                newItems[i].status = 'saving';
                setTranslationItems([...newItems]);

                try {
                    await callNotionApi(`/v1/pages/${newItems[i].id}`, 'PATCH', {
                        properties: {
                            '본문 (영문)': {
                                rich_text: [{ text: { content: newItems[i].bodyEn } }]
                            }
                        }
                    });

                    newItems[i].status = 'saved';
                    savedCount++;
                    setProgress(prev => ({ ...prev, current: savedCount }));
                    setTranslationItems([...newItems]);

                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (err) {
                    newItems[i].status = 'error';
                    setTranslationItems([...newItems]);
                    addToast(`${newItems[i].no} 저장 실패: ${err.message}`, 'error');
                }
            }
        }

        setLoading(false);
        if (savedCount === itemsToSave.length) {
            addToast(`🎉 ${savedCount}개 항목 노션 저장 완료!`);
        } else {
            addToast(`⚠️ 저장 완료 (성공: ${savedCount}, 실패: ${itemsToSave.length - savedCount})`, 'error');
        }

        // Clear list after some delay if all success
        if (savedCount === itemsToSave.length) {
            setTimeout(() => setTranslationItems([]), 3000);
        }
    };

    const updateTranslation = (index, value) => {
        const newItems = [...translationItems];
        newItems[index].bodyEn = value;
        newItems[index].status = 'translated';
        setTranslationItems(newItems);
    };

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-[32px] font-bold tracking-tighter text-black flex items-center gap-3">
                        <IconTranslate /> 번역 헬퍼
                    </h1>
                    <p className="text-[#666] text-[15px]">본문(한글)이 있는 항목을 검색하여 DeepL로 자동 번역하고 노션에 업데이트합니다.</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={fetchTranslationItems}
                        disabled={loading}
                        className="vercel-btn-secondary"
                    >
                        {loading && translationItems.length === 0 ? '불러오는 중...' : '번역 대기 항목 불러오기'}
                    </button>

                    {translationItems.length > 0 && (
                        <>
                            <button
                                onClick={translateAll}
                                disabled={loading}
                                className="vercel-btn-secondary"
                            >
                                {loading && progress.total > 0 ? `번역 중 (${progress.current}/${progress.total})` : '전체 번역'}
                            </button>
                            <button
                                onClick={saveAll}
                                disabled={loading || !translationItems.some(item => item.bodyEn && item.status !== 'saved')}
                                className="vercel-btn-primary"
                            >
                                {loading && progress.total > 0 && !translationItems.some(i => i.status === 'translating') ? `저장 중 (${progress.current}/${progress.total})` : '노션에 전체 저장'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {translationItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                    {translationItems.map((item, index) => (
                        <div key={item.id} className="vercel-card overflow-hidden">
                            <div className="px-6 py-4 border-b border-[#eaeaea] bg-[#fafafa] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-[14px] font-bold text-black">{item.no}</span>
                                    <span className="text-[13px] text-[#666]">{item.title}</span>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#888]">
                                        {item.status === 'ready' && '대기'}
                                        {item.status === 'translating' && <span className="text-black flex items-center gap-1"><IconLoading /> 번역 중</span>}
                                        {item.status === 'translated' && <span className="text-[#0070f3]">번역 완료</span>}
                                        {item.status === 'saving' && <span className="text-black flex items-center gap-1"><IconLoading /> 저장 중</span>}
                                        {item.status === 'saved' && <span className="text-[#0070f3] flex items-center gap-1"><IconCheck /> 저장됨</span>}
                                        {item.status === 'error' && <span className="text-[#ee0000]">오류</span>}
                                    </span>

                                    <button
                                        onClick={() => translateItem(index)}
                                        disabled={loading || item.status === 'saved' || item.status === 'translating'}
                                        className="text-[12px] font-bold text-[#0070f3] hover:underline disabled:opacity-30"
                                    >
                                        번역
                                    </button>
                                    <button
                                        onClick={() => saveToNotion(item, index)}
                                        disabled={loading || !item.bodyEn || item.status === 'saved' || item.status === 'saving'}
                                        className="text-[12px] font-bold text-black hover:underline disabled:opacity-30"
                                    >
                                        저장
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2">
                                <div className="p-6 border-r border-[#eaeaea]">
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest block mb-2">원문 (한글)</label>
                                    <div className="text-[14px] leading-relaxed text-[#444] min-h-[120px] whitespace-pre-wrap bg-[#fcfcfc] p-4 rounded border border-[#f0f0f0]">
                                        {item.bodyKr}
                                    </div>
                                </div>
                                <div className="p-6">
                                    <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest block mb-2">번역문 (영문)</label>
                                    <textarea
                                        value={item.bodyEn}
                                        onChange={(e) => updateTranslation(index, e.target.value)}
                                        placeholder="번역 버튼을 누르거나 직접 입력하세요"
                                        className="w-full min-h-[120px] p-4 text-[14px] leading-relaxed outline-none border border-[#eaeaea] focus:border-black rounded-md transition-all shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="vercel-card h-64 flex flex-col items-center justify-center border-dashed border-2">
                    <div className="w-12 h-12 rounded-full bg-[#fafafa] flex items-center justify-center mb-4">
                        <IconTranslate />
                    </div>
                    <p className="text-[#666] text-[14px]">번역할 항목이 없습니다. 상단 버튼을 눌러 번역이 필요한 항목을 불러오세요.</p>
                </div>
            )}

            {/* Helper Footer */}
            <div className="vercel-card p-6 bg-black text-white">
                <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3]" />
                    사용 방법
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-80 text-[13px]">
                    <div>
                        <span className="font-bold text-[#0070f3] mr-2">01.</span>
                        노션에서 본문(한글)이 입력되고 본문(영문)이 비어있는 항목을 준비합니다.
                    </div>
                    <div>
                        <span className="font-bold text-[#0070f3] mr-2">02.</span>
                        상단의 '불러오기' 버튼을 클릭하여 목록을 가져옵니다.
                    </div>
                    <div>
                        <span className="font-bold text-[#0070f3] mr-2">03.</span>
                        '전체 번역' 후 결과를 확인하고 '노션에 전체 저장'을 클릭합니다.
                    </div>
                </div>
            </div>
        </div>
    );
}

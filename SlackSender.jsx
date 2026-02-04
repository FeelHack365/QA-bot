import React, { useState, useEffect } from 'react';
import { useToast } from './App';

const IconSlack = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 10c-.83 0-1.5.67-1.5 1.5v5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5z" /><path d="M20.5 10c-.83 0-1.5.67-1.5 1.5v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-3.5c0-.83-.67-1.5-1.5-1.5z" /><path d="M8.5 10c-.83 0-1.5.67-1.5 1.5v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-1.5c0-.83-.67-1.5-1.5-1.5z" /><path d="M2.5 10c-.83 0-1.5.67-1.5 1.5v.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-.5c0-.83-.67-1.5-1.5-1.5z" /><path d="M3 3h18c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2z" /></svg>;
const IconCopy = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
const IconCheck = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IconClock = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;

export default function SlackSender() {
    const { addToast } = useToast();

    // Notion Settings
    const [notionToken, setNotionToken] = useState('');
    const [databaseId, setDatabaseId] = useState('');

    // State
    const [loading, setLoading] = useState(false);
    const [failItems, setFailItems] = useState([]);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        const loadSettings = () => {
            setNotionToken(localStorage.getItem('notion_token') || '');
            setDatabaseId(localStorage.getItem('notion_database_id') || '');
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
                'Authorization': `Bearer ${notionToken.trim()}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: body ? JSON.stringify(body) : undefined
        } : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: notionToken.trim(),
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

    const loadFailItems = async () => {
        if (!notionToken || !databaseId) {
            addToast('설정 탭에서 노션 API 토큰과 데이터베이스 ID를 확인해주세요.', 'error');
            return;
        }

        setLoading(true);
        try {
            const dbId = databaseId.trim().replace(/-/g, '');
            const data = await callNotionApi(`/v1/databases/${dbId}/query`, 'POST', {
                filter: {
                    and: [
                        { property: '결과', select: { equals: 'FAIL' } },
                        { property: '전송 상태', select: { equals: '미전송' } }
                    ]
                },
                sorts: [{ property: 'No.', direction: 'ascending' }]
            });

            const items = data.results.map(page => ({
                id: page.id,
                no: page.properties['No.']?.title?.[0]?.text?.content || '-',
                title: page.properties['제목']?.rich_text?.[0]?.text?.content || '',
                bodyKr: page.properties['본문 (한글)']?.rich_text?.[0]?.text?.content || '',
                bodyEn: page.properties['본문 (영문)']?.rich_text?.[0]?.text?.content || '',
                imageUrl: page.properties['이미지 링크']?.url || ''
            }));

            setFailItems(items);
            if (items.length === 0) addToast('전송 대기 중인 FAIL 항목이 없습니다.', 'success');
            else addToast(`✅ ${items.length}개의 FAIL 항목을 불러왔습니다.`);
        } catch (err) {
            addToast(`오류: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (item, status) => {
        setProcessingId(item.id);
        try {
            await callNotionApi(`/v1/pages/${item.id}`, 'PATCH', {
                properties: {
                    '전송 상태': { select: { name: status } }
                }
            });
            addToast(`[${item.no}] ${status} 처리 완료`);
            setFailItems(prev => prev.filter(i => i.id !== item.id));
        } catch (err) {
            addToast(`오류: ${err.message}`, 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const copyToClipboard = (item) => {
        const text = `${item.title}\n${item.bodyKr}\n---\n${item.bodyEn}${item.imageUrl ? `\n\nImage: ${item.imageUrl}` : ''}`;
        navigator.clipboard.writeText(text).then(() => {
            addToast(`[${item.no}] 클립보드에 복사되었습니다.`);
        });
    };

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-[32px] font-bold tracking-tighter text-black flex items-center gap-3">
                        슬랙 게시
                    </h1>
                    <p className="text-[#666] text-[15px]">FAIL 항목을 형식에 맞춰 복사하고 ConsoleQA에 업데이트 했는지를 표시합니다.</p>
                </div>
                <button
                    onClick={loadFailItems}
                    disabled={loading}
                    className="vercel-btn-secondary"
                >
                    {loading ? '불러오는 중' : 'FAIL 항목 불러오기'}
                </button>
            </div>

            {failItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                    {failItems.map((item) => (
                        <div key={item.id} className="vercel-card overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                            <div className="px-6 py-4 border-b border-[#eaeaea] bg-[#fafafa] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-[14px] font-medium text-[#888]">No.</span>
                                    <span className="text-[16px] font-bold text-black">{item.no}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => copyToClipboard(item)}
                                        className="h-8 px-3 flex items-center gap-2 text-[12px] font-medium bg-white border border-[#eaeaea] hover:border-black rounded-md transition-all"
                                    >
                                        <IconCopy /> 복사하기
                                    </button>
                                    <button
                                        onClick={() => updateStatus(item, '전송완료')}
                                        disabled={!!processingId}
                                        className="h-8 px-3 flex items-center gap-2 text-[12px] font-medium bg-white border border-[#eaeaea] hover:border-black rounded-md transition-all"
                                    >
                                        <IconCheck /> 전송완료
                                    </button>
                                    <button
                                        onClick={() => updateStatus(item, '보류')}
                                        disabled={!!processingId}
                                        className="h-8 px-3 flex items-center gap-2 text-[12px] font-medium bg-white border border-[#eaeaea] hover:border-black rounded-md transition-all"
                                    >
                                        <IconClock /> 보류
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                                {/* Left Column: Title + Body (KR) */}
                                <div className="flex flex-col gap-6">
                                    <div className="flex-none">
                                        <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest block mb-2">제목</label>
                                        <div className="text-[15px] font-bold text-black bg-[#fcfcfc] p-3 rounded border border-[#f0f0f0]">
                                            {item.title || '(제목 없음)'}
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest block mb-2">본문 (한글)</label>
                                        <div className="flex-1 text-[14px] leading-relaxed text-[#444] whitespace-pre-wrap bg-[#fcfcfc] p-4 rounded border border-[#f0f0f0] min-h-[120px]">
                                            {item.bodyKr || '(내용 없음)'}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Body (EN) + Image */}
                                <div className="flex flex-col h-full">
                                    <div className="flex-1 flex flex-col">
                                        <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest block mb-2">본문 (영문)</label>
                                        <div className="flex-1 text-[14px] leading-relaxed text-[#444] whitespace-pre-wrap bg-[#fcfcfc] p-4 rounded border border-[#f0f0f0] min-h-[180px]">
                                            {item.bodyEn || '(No description)'}
                                        </div>
                                    </div>
                                    {item.imageUrl && (
                                        <div className="mt-6 flex-none">
                                            <label className="text-[11px] font-bold text-[#888] uppercase tracking-widest block mb-2">이미지</label>
                                            <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#0070f3] hover:underline block truncate">
                                                {item.imageUrl}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="vercel-card h-[400px] flex flex-col items-center justify-center border-dashed border-2 opacity-60">

                    <p className="text-lg font-bold text-black mb-2">전송 대기 항목 없음</p>
                    <p className="text-[#666] text-sm">상단 버튼을 눌러 FAIL 항목을 불러오세요.</p>
                </div>
            )}
        </div>
    );
}

import React, { useState, useEffect } from 'react';

export default function SlackSender() {
    // 설정
    const [notionToken, setNotionToken] = useState('');
    const [databaseId, setDatabaseId] = useState('');
    const [slackToken, setSlackToken] = useState('');
    const [channelId, setChannelId] = useState('');

    // 2차: 회사 Slack 설정
    const [useCompanySlack, setUseCompanySlack] = useState(false);
    const [companySlackToken, setCompanySlackToken] = useState('');
    const [projectChannelId, setProjectChannelId] = useState('');
    const [assigneeUserId, setAssigneeUserId] = useState('');

    // 상태
    const [loading, setLoading] = useState(false);
    const [failItems, setFailItems] = useState([]);
    const [results, setResults] = useState([]);
    const [error, setError] = useState('');

    // LocalStorage에서 설정 불러오기
    useEffect(() => {
        const savedNotionToken = localStorage.getItem('notion_token'); // uploader와 키 이름 맞춤
        const savedDbId = localStorage.getItem('notion_database_id');
        const savedSlackToken = localStorage.getItem('slackToken');
        const savedChannelId = localStorage.getItem('channelId');
        const savedCompanySlackToken = localStorage.getItem('companySlackToken');
        const savedProjectChannelId = localStorage.getItem('projectChannelId');
        const savedAssigneeUserId = localStorage.getItem('assigneeUserId');

        if (savedNotionToken) setNotionToken(savedNotionToken);
        if (savedDbId) setDatabaseId(savedDbId);
        if (savedSlackToken) setSlackToken(savedSlackToken);
        if (savedChannelId) setChannelId(savedChannelId);
        if (savedCompanySlackToken) setCompanySlackToken(savedCompanySlackToken);
        if (savedProjectChannelId) setProjectChannelId(savedProjectChannelId);
        if (savedAssigneeUserId) setAssigneeUserId(savedAssigneeUserId);
    }, []);

    // 설정 저장
    const saveSettings = () => {
        localStorage.setItem('notion_token', notionToken);
        localStorage.setItem('notion_database_id', databaseId);
        localStorage.setItem('slackToken', slackToken);
        localStorage.setItem('channelId', channelId);
        localStorage.setItem('companySlackToken', companySlackToken);
        localStorage.setItem('projectChannelId', projectChannelId);
        localStorage.setItem('assigneeUserId', assigneeUserId);
        alert('✅ 설정이 저장되었습니다!');
    };

    // Notion에서 FAIL 항목 가져오기
    const fetchFailItems = async () => {
        // CORS 대응을 위해 로컬 프록시 주소 사용
        const url = window.location.hostname === 'localhost'
            ? `/notion-api/v1/databases/${databaseId}/query`
            : `/notion-api/v1/databases/${databaseId}/query`; // 배포시 vercel.json 필요

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                filter: {
                    and: [
                        {
                            property: '결과',
                            select: { equals: 'FAIL' }
                        },
                        {
                            property: '전송 상태',
                            select: { equals: '미전송' }
                        }
                    ]
                }
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Notion API 오류');
        }

        const data = await response.json();
        return data.results.map(page => ({
            id: page.id,
            no: page.properties['No.']?.title?.[0]?.text?.content || '',
            depth1: page.properties['1 Depth 화면']?.select?.name || '',
            depth2: page.properties['2 Depth 영역']?.rich_text?.[0]?.text?.content || '',
            checkPoint: page.properties['확인 사항']?.rich_text?.[0]?.text?.content || '',
            scenario: page.properties['시나리오']?.rich_text?.[0]?.text?.content || '',
            title: page.properties['제목']?.rich_text?.[0]?.text?.content || '',
            bodyKr: page.properties['본문 (한글)']?.rich_text?.[0]?.text?.content || '',
            bodyEn: page.properties['본문 (영문)']?.rich_text?.[0]?.text?.content || '',
            imageUrl: page.properties['이미지 링크']?.url || ''
        }));
    };

    // FAIL 항목 로드
    const loadFailItems = async () => {
        if (!notionToken || !databaseId) {
            setError('⚠️ Notion 설정을 먼저 입력해주세요.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const items = await fetchFailItems();
            setFailItems(items);

            if (items.length === 0) {
                setError('📭 전송할 FAIL 항목이 없습니다.');
            }
        } catch (err) {
            setError(`❌ 오류: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Slack 전송 공통 로직 (CORS 및 보안 대응)
    const slackFetch = async (url, body, token) => {
        // 로컬 개발 환경인지 Vercel 배포 환경인지에 따라 URL 분기
        const apiPath = window.location.hostname === 'localhost' ? '/slack-api/chat.postMessage' : '/api/slack';

        const payload = window.location.hostname === 'localhost' ? body : { token, body };
        const headers = { 'Content-Type': 'application/json' };

        if (window.location.hostname === 'localhost') {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(apiPath, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        return response.json();
    }

    // 1차: 개인 Slack에 메시지 전송
    const sendToPersonalSlack = async (item) => {
        const message = {
            channel: channelId,
            text: `🚨 QA 테스트 FAIL 발생`,
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: `🚨 ${item.title || 'QA 테스트 FAIL'}`,
                        emoji: true
                    }
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*No:*\n${item.no}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*화면:*\n${item.depth1} > ${item.depth2}`
                        }
                    ]
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*확인 사항:*\n${item.checkPoint}`
                    }
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*시나리오:*\n${item.scenario}`
                    }
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*상세 내용:*\n${item.bodyKr || '(내용 없음)'}`
                    }
                },
                {
                    type: 'divider'
                }
            ]
        };

        if (item.imageUrl) {
            message.blocks.push({
                type: 'image',
                image_url: item.imageUrl,
                alt_text: 'Screenshot'
            });
        }

        const data = await slackFetch('https://slack.com/api/chat.postMessage', message, slackToken);

        if (!data.ok) {
            throw new Error(data.error || 'Slack API 오류');
        }

        return data;
    };

    // 2차: 회사 Slack Project Tracker에 스레드 생성 + assign
    const sendToCompanySlack = async (item) => {
        const mainMessage = {
            channel: projectChannelId,
            text: `🐛 Bug Report: ${item.title || item.no}`,
            blocks: [
                { type: 'header', text: { type: 'plain_text', text: `🐛 ${item.title || 'Bug Report'}`, emoji: true } },
                { type: 'section', fields: [{ type: 'mrkdwn', text: `*No:*\n${item.no}` }, { type: 'mrkdwn', text: `*Screen:*\n${item.depth1} > ${item.depth2}` }] },
                { type: 'section', text: { type: 'mrkdwn', text: `*Description (EN):*\n${item.bodyEn || item.bodyKr || '(No description)'}` } },
                { type: 'section', text: { type: 'mrkdwn', text: `*상세 설명 (KR):*\n${item.bodyKr || '(내용 없음)'}` } },
                { type: 'divider' }
            ]
        };

        if (item.imageUrl) {
            mainMessage.blocks.push({ type: 'image', image_url: item.imageUrl, alt_text: 'Bug Screenshot' });
        }

        const mainData = await slackFetch('https://slack.com/api/chat.postMessage', mainMessage, companySlackToken);
        if (!mainData.ok) throw new Error(mainData.error || 'Slack API 오류');

        if (assigneeUserId) {
            const threadMessage = {
                channel: projectChannelId,
                thread_ts: mainData.ts,
                text: `<@${assigneeUserId}> 이 이슈를 확인해주세요.`
            };
            await slackFetch('https://slack.com/api/chat.postMessage', threadMessage, companySlackToken);
        }

        return mainData;
    };

    // Notion 페이지 업데이트 (전송 상태)
    const updateNotionPage = async (pageId) => {
        const url = window.location.hostname === 'localhost' ? `/notion-api/v1/pages/${pageId}` : `/notion-api/v1/pages/${pageId}`;
        await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                properties: {
                    '전송 상태': {
                        select: { name: '전송완료' }
                    }
                }
            })
        });
    };

    // 전송 실행
    const handleSend = async () => {
        if (failItems.length === 0) {
            setError('⚠️ 먼저 FAIL 항목을 불러오세요.');
            return;
        }

        const token = useCompanySlack ? companySlackToken : slackToken;
        const channel = useCompanySlack ? projectChannelId : channelId;

        if (!token || !channel) {
            setError('⚠️ Slack 설정을 확인해주세요.');
            return;
        }

        setLoading(true);
        setError('');
        setResults([]);

        try {
            const sendResults = [];

            for (let i = 0; i < failItems.length; i++) {
                const item = failItems[i];

                try {
                    if (useCompanySlack) {
                        await sendToCompanySlack(item);
                    } else {
                        await sendToPersonalSlack(item);
                    }

                    await updateNotionPage(item.id);

                    sendResults.push(`✅ ${i + 1}/${failItems.length}: ${item.no} 전송 완료`);
                    setResults([...sendResults]);

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err) {
                    sendResults.push(`❌ ${i + 1}/${failItems.length}: ${item.no} 실패 - ${err.message}`);
                    setResults([...sendResults]);
                }
            }

            setLoading(false);
            setFailItems([]);
        } catch (err) {
            setError(`❌ 오류: ${err.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl p-10 border border-white">
                    {/* 헤더 */}
                    <div className="mb-10 text-center">
                        <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">
                            💬 Notion → <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">Slack Sender</span>
                        </h1>
                        <p className="text-slate-500 font-medium">
                            Notion에서 FAIL 항목을 가져와 Slack으로 전송합니다
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        {/* Notion 설정 */}
                        <div className="p-8 bg-blue-50/50 rounded-[24px] border border-blue-100">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-900">
                                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm">N</span>
                                Notion 설정
                            </h2>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-blue-700/60 uppercase mb-2 ml-1">Notion Token</label>
                                    <input
                                        type="password"
                                        value={notionToken}
                                        onChange={(e) => setNotionToken(e.target.value)}
                                        placeholder="secret_..."
                                        className="w-full px-5 py-4 bg-white border border-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-blue-700/60 uppercase mb-2 ml-1">Database ID</label>
                                    <input
                                        type="text"
                                        value={databaseId}
                                        onChange={(e) => setDatabaseId(e.target.value)}
                                        placeholder="database_id"
                                        className="w-full px-5 py-4 bg-white border border-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Slack 설정 */}
                        <div className="p-8 bg-purple-50/50 rounded-[24px] border border-purple-100">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-purple-900">
                                    <span className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white text-sm">S</span>
                                    Slack 설정
                                </h2>

                                <button
                                    onClick={() => setUseCompanySlack(!useCompanySlack)}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${useCompanySlack ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-200 text-slate-500'
                                        }`}
                                >
                                    {useCompanySlack ? 'Company' : 'Personal'}
                                </button>
                            </div>

                            <div className="space-y-5">
                                {!useCompanySlack ? (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-purple-700/60 uppercase mb-2 ml-1">Bot Token</label>
                                            <input
                                                type="password"
                                                value={slackToken}
                                                onChange={(e) => setSlackToken(e.target.value)}
                                                placeholder="xoxb-..."
                                                className="w-full px-5 py-4 bg-white border border-purple-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-purple-700/60 uppercase mb-2 ml-1">Channel ID</label>
                                            <input
                                                type="text"
                                                value={channelId}
                                                onChange={(e) => setChannelId(e.target.value)}
                                                placeholder="C..."
                                                className="w-full px-5 py-4 bg-white border border-purple-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-purple-700/60 uppercase mb-2 ml-1">Company Token</label>
                                            <input
                                                type="password"
                                                value={companySlackToken}
                                                onChange={(e) => setCompanySlackToken(e.target.value)}
                                                placeholder="xoxb-..."
                                                className="w-full px-5 py-4 bg-white border border-purple-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-purple-700/60 uppercase mb-2 ml-1">Project Channel ID</label>
                                            <input
                                                type="text"
                                                value={projectChannelId}
                                                onChange={(e) => setProjectChannelId(e.target.value)}
                                                placeholder="C..."
                                                className="w-full px-5 py-4 bg-white border border-purple-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 하단 제어부 */}
                    <div className="flex flex-col gap-4">
                        <button
                            onClick={saveSettings}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl"
                        >
                            💾 설정 반영하기
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={loadFailItems}
                                disabled={loading}
                                className="py-5 bg-white border-2 border-purple-100 text-purple-600 rounded-[20px] font-black text-lg hover:bg-purple-50 transition-all flex items-center justify-center gap-3 disabled:bg-slate-50 disabled:text-slate-300"
                            >
                                {loading ? '불러오는 중...' : '📥 FAIL 리스트 로드'}
                            </button>

                            {failItems.length > 0 && (
                                <button
                                    onClick={handleSend}
                                    disabled={loading}
                                    className="py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-[20px] font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl flex items-center justify-center gap-3"
                                >
                                    🚀 {failItems.length}개 항목 전송 시작
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 전송 항목 미리보기 */}
                    {failItems.length > 0 && (
                        <div className="mt-10 p-8 bg-slate-50 rounded-[32px] border border-slate-100">
                            <h3 className="text-lg font-bold mb-6 text-slate-800 flex items-center justify-between">
                                <span>📋 전송 대기 목록</span>
                                <span className="text-sm font-black text-purple-600 bg-purple-100 px-3 py-1 rounded-full">{failItems.length}</span>
                            </h3>
                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                {failItems.map((item, index) => (
                                    <div key={index} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-slate-700">{item.no}</div>
                                            <div className="text-xs text-slate-400">{item.depth1} &gt; {item.depth2}</div>
                                        </div>
                                        <div className="text-[13px] font-medium text-slate-600 bg-slate-50 px-3 py-1 rounded-lg max-w-[200px] truncate">
                                            {item.title || item.checkPoint}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 에러 및 결과 */}
                    {error && <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold text-center">{error}</div>}

                    {results.length > 0 && (
                        <div className="mt-10 bg-slate-900 rounded-[32px] p-8 text-xs font-mono text-slate-400 h-48 overflow-y-auto shadow-inner">
                            <div className="flex items-center gap-2 mb-4 text-white font-bold opacity-50 uppercase tracking-widest px-1">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                Transmission Logs
                            </div>
                            {results.map((result, index) => (
                                <div key={index} className="mb-2 pl-4 border-l border-slate-700 leading-relaxed font-bold">
                                    {result}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <style jsx="true">{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
      `}</style>
        </div>
    );
}

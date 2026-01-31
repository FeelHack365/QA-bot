import React, { useState, useEffect } from 'react';
import { useToast } from './App';

const IconSlack = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>;

export default function SlackSender() {
    const { addToast } = useToast();

    // Original Logic: 세팅 정보
    const [notionToken, setNotionToken] = useState('');
    const [databaseId, setDatabaseId] = useState('');
    const [slackToken, setSlackToken] = useState('');
    const [channelId, setChannelId] = useState('');
    const [useCompanySlack, setUseCompanySlack] = useState(false);
    const [companySlackToken, setCompanySlackToken] = useState('');
    const [projectChannelId, setProjectChannelId] = useState('');
    const [assigneeUserId, setAssigneeUserId] = useState('');

    // 상태
    const [loading, setLoading] = useState(false);
    const [failItems, setFailItems] = useState([]);
    const [results, setResults] = useState([]);

    // Original Logic: LocalStorage 불러오기
    useEffect(() => {
        const savedNotionToken = localStorage.getItem('notion_token');
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

    // Original Logic: API 페치
    const fetchFailItems = async () => {
        const url = window.location.hostname === 'localhost'
            ? `/notion-api/v1/databases/${databaseId.trim()}/query`
            : `/notion-api/v1/databases/${databaseId.trim()}/query`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionToken.trim()}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                filter: {
                    and: [
                        { property: '결과', select: { equals: 'FAIL' } },
                        { property: '전송 상태', select: { equals: '미전송' } }
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

    const loadFailItems = async () => {
        if (!notionToken || !databaseId) {
            addToast('Notion 설정을 먼저 확인해 주세요.', 'error');
            return;
        }
        setLoading(true); setFailItems([]);
        try {
            const items = await fetchFailItems();
            setFailItems(items);
            if (items.length === 0) addToast('📭 전송할 FAIL 항목이 없습니다.');
        } catch (err) {
            addToast(`❌ 오류: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const slackFetch = async (url, body, token) => {
        const apiPath = window.location.hostname === 'localhost' ? '/slack-api/chat.postMessage' : '/api/slack';
        const payload = window.location.hostname === 'localhost' ? body : { token, body };
        const headers = { 'Content-Type': 'application/json' };
        if (window.location.hostname === 'localhost') headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(apiPath, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        return response.json();
    }

    // Original Logic: 개인 슬랙 발송 (상세 블록)
    const sendToPersonalSlack = async (item) => {
        const message = {
            channel: channelId,
            text: `🚨 QA 테스트 FAIL 발생`,
            blocks: [
                { type: 'header', text: { type: 'plain_text', text: `🚨 ${item.title || 'QA 테스트 FAIL'}`, emoji: true } },
                {
                    type: 'section', fields: [
                        { type: 'mrkdwn', text: `*No:*\n${item.no}` },
                        { type: 'mrkdwn', text: `*화면:*\n${item.depth1} > ${item.depth2}` }
                    ]
                },
                { type: 'section', text: { type: 'mrkdwn', text: `*확인 사항:*\n${item.checkPoint}` } },
                { type: 'section', text: { type: 'mrkdwn', text: `*시나리오:*\n${item.scenario}` } },
                { type: 'section', text: { type: 'mrkdwn', text: `*상세내용*\n- ${item.title}\n- ${item.bodyKr || '(내용 없음)'}` } },
                { type: 'section', text: { type: 'mrkdwn', text: `*상세내용(영문)*\n- ${item.title}\n- ${item.bodyEn || '(No description)'}` } },
                { type: 'divider' }
            ]
        };
        if (item.imageUrl) {
            message.blocks.push({ type: 'image', image_url: item.imageUrl, alt_text: 'Screenshot' });
        }
        const data = await slackFetch('https://slack.com/api/chat.postMessage', message, slackToken);
        if (!data.ok) throw new Error(data.error || 'Slack API 오류');
        return data;
    };

    // Original Logic: 회사 슬랙 발송 (Bug Report)
    const sendToCompanySlack = async (item) => {
        const mainMessage = {
            channel: projectChannelId,
            text: `🐛 Bug Report: ${item.title || item.no}`,
            blocks: [
                { type: 'header', text: { type: 'plain_text', text: `🐛 ${item.title || 'Bug Report'}`, emoji: true } },
                { type: 'section', fields: [{ type: 'mrkdwn', text: `*No:*\n${item.no}` }, { type: 'mrkdwn', text: `*Screen:*\n${item.depth1} > ${item.depth2}` }] },
                { type: 'section', text: { type: 'mrkdwn', text: `*상세내용*\n- ${item.title}\n- ${item.bodyKr || '(내용 없음)'}` } },
                { type: 'section', text: { type: 'mrkdwn', text: `*상세내용(영문)*\n- ${item.title}\n- ${item.bodyEn || '(No description)'}` } },
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

    const handleSend = async () => {
        setLoading(true); setResults([]);
        try {
            const sendResults = [];
            for (let i = 0; i < failItems.length; i++) {
                const item = failItems[i];
                try {
                    if (useCompanySlack) await sendToCompanySlack(item);
                    else await sendToPersonalSlack(item);

                    // Notion 업데이트
                    const updateUrl = window.location.hostname === 'localhost' ? `/notion-api/v1/pages/${item.id}` : `/api/notion/patch?pageId=${item.id}`;
                    await fetch(updateUrl, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${notionToken}`,
                            'Content-Type': 'application/json',
                            'Notion-Version': '2022-06-28'
                        },
                        body: JSON.stringify({ properties: { '전송 상태': { select: { name: '전송완료' } } } })
                    });

                    sendResults.push(`✅ [${item.no}] 전송 완료`);
                } catch (err) {
                    sendResults.push(`❌ [${item.no}] 실패: ${err.message}`);
                }
                setResults([...sendResults]);
                await new Promise(r => setTimeout(r, 800));
            }
            setFailItems([]);
            addToast('🎉 모든 전송 작업이 완료되었습니다.');
        } catch (err) {
            addToast(`❌ 치명적 오류: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-[32px] font-bold tracking-tighter text-black">Slack Forwarding</h1>
                    <p className="text-[#666] text-[15px]">Select and dispatch FAIL items from Notion to project channels.</p>
                </div>
                <div className="flex border border-[#eaeaea] rounded-md overflow-hidden bg-[#fafafa]">
                    <button onClick={() => setUseCompanySlack(false)} className={`px-4 py-1.5 text-xs font-semibold transition-all ${!useCompanySlack ? 'bg-white shadow-sm text-black' : 'text-[#888]'}`}>Personal</button>
                    <button onClick={() => setUseCompanySlack(true)} className={`px-4 py-1.5 text-xs font-semibold transition-all ${useCompanySlack ? 'bg-black text-white' : 'text-[#888]'}`}>Company</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-12">
                    <div className="vercel-card bg-[#fafafa] p-8 flex items-center justify-between border-dashed border-2">
                        <div className="space-y-1">
                            <span className="text-[11px] font-bold text-[#999] tracking-widest uppercase">Action Center</span>
                            <h3 className="text-xl font-bold">{failItems.length} items staged for broadcast</h3>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={loadFailItems} disabled={loading} className="vercel-btn-secondary">Load FAIL Items</button>
                            <button onClick={handleSend} disabled={loading || failItems.length === 0} className="vercel-btn-primary">Execute Dispatch</button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-7">
                    <div className="vercel-card h-[500px] flex flex-col">
                        <div className="px-6 py-4 border-b border-[#eaeaea] bg-[#fafafa] flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-[#666]">Dispatch Queue</span>
                            <IconSlack />
                        </div>
                        <div className="flex-1 overflow-auto">
                            {failItems.length > 0 ? (
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-white border-b border-[#eaeaea] z-10 text-[11px] font-bold text-[#999] uppercase tracking-wider">
                                        <tr><th className="px-6 py-3">ID</th><th className="px-6 py-3">Context</th><th className="px-6 py-3">Summary</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#eaeaea]">
                                        {failItems.map(item => (
                                            <tr key={item.id} className="text-[13.5px] hover:bg-[#fafafa] transition-colors">
                                                <td className="px-6 py-4 font-bold">{item.no}</td>
                                                <td className="px-6 py-4 text-[#666]">{item.depth1} &gt; {item.depth2}</td>
                                                <td className="px-6 py-4 text-[#888] truncate max-w-[200px]">{item.title || item.checkPoint}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-40">
                                    <p className="mt-2 text-sm font-bold">대기 중인 항목이 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-5">
                    <div className="vercel-card h-[500px] bg-black flex flex-col overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-[#333] flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#666] uppercase tracking-[.3em]">Transmission Stream</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-[#0070f3] animate-pulse" />
                        </div>
                        <div className="flex-1 p-6 font-mono text-[11px] leading-6 overflow-auto text-[#888] selection:bg-white selection:text-black">
                            {results.map((l, i) => (
                                <div key={i} className="mb-1 flex gap-4 animate-in fade-in">
                                    <span className="text-[#333]">[{results.length - i}]</span>
                                    <span className={l.includes('완료') ? 'text-white' : 'text-[#ee0000]'}>{l}</span>
                                </div>
                            ))}
                            {results.length === 0 && (
                                <div className="h-full flex items-center justify-center opacity-20 tracking-[.3em] text-white">IDLE</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

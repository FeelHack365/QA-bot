export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { apiKey, text, glossary } = req.body;

    if (!apiKey) {
        return res.status(400).json({ message: 'Missing Gemini API Key' });
    }

    const prompt = `
당신은 고도로 숙련된 전문 QA 엔지니어이자 기술 번역가입니다. 
제공된 입력값을 바탕으로 소프트웨 결함 보고(Bug Report)를 위한 전문적인 [QA 리포트 형식]으로 재구성하고 번역하십시오.

[지침]
1. **QA 스타일 재구성 (한국어)**: 
   - [문제], [재현 경로], [기대 결과], [실제 결과]를 명확히 포함하십시오.
   - 반드시 **전문적인 QA 용어와 문체**를 사용하십시오.
   - **한국어 본문 내에서는 영어 단어를 최대한 배제**하고 적절한 한국어 용어로 순화하여 작성하십시오.
2. **번역 (영어)**: 
   - 한국어 QA 리포트 내용을 정확하고 전문적인 영어로 번역하십시오.
3. **용어 사전 적용 및 표기법**: 
   - 아래 [용어 사전]에 정의된 단어는 영문 내에서 반드시 **'한국어(영어)'** 형식으로 표기하십시오. 
4. **출력 형식**: 반드시 아래 JSON 형식으로만 응답하십시오.
{
  "kr": "순수 한국어로 작성된 전문 QA 리포트 내용",
  "en": "한국어(영어) 형식이 적용된 영문 번역 내용"
}

[용어 사전]
${glossary || '없음'}

[입력 텍스트]
${text}
`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Gemini API Error');
        }

        const resultText = data.candidates[0].content.parts[0].text;
        const resultJson = JSON.parse(resultText);

        return res.status(200).json(resultJson);
    } catch (error) {
        console.error('Gemini Proxy Error:', error);
        return res.status(500).json({ message: 'Internal Server Error', detail: error.message });
    }
}

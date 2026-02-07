export const generateGeminiPrompt = (text, glossary) => {
    return `
당신은 고도로 숙련된 전문 QA 엔지니어이자 기술 번역가입니다. 
제공된 입력값을 바탕으로 소프트웨어 결함 보고(Bug Report)를 위한 전문적인 [QA 리포트 형식]으로 재구성하고 번역하십시오.

[지침]
1. **QA 스타일 재구성 (한국어)**: 
   - [문제], [재현 경로], [기대 결과], [실제 결과]를 명확히 포함하십시오.
   - 반드시 **전문적인 QA 용어**를 사용하십시오.
   - **한국어 본문 내에서는 영어 단어를 최대한 배제**하고 적절한 한국어 용어로 순화하여 작성하십시오. (예: 'Button' -> '버튼', 'Click' -> '클릭')
2. **번역 (영어)**: 
   - 한국어 QA 리포트 내용을 정확하고 전문적인 영어로 번역하십시오.
3. **용어 사전 적용 및 표기법**: 
   - 아래 [용어 사전]에 정의된 단어는 반드시 영문 번역 시 **'한국어(영어)'** 형식으로 표기하십시오. (예: 용어 사전에 '결제: Payment'가 있다면 '결제(Payment)'로 표기)
4. **출력 형식**: 반드시 아래 JSON 형식으로만 응답하십시오.
{
  "kr": "순수 한국어로 작성된 전문 QA 리포트",
  "en": "한국어(영어) 형식이 적용된 영문 번역 리포트"
}

[용어 사전]
${glossary || '없음'}

[입력 텍스트]
${text}
`;
};

export const callGemini = async (text, glossary, apiKey) => {
    const isLocal = window.location.hostname === 'localhost';
    const prompt = generateGeminiPrompt(text, glossary);

    if (isLocal) {
        // Direct call via Vite Proxy
        const response = await fetch(`/gemini-api/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Gemini API Error');
        return JSON.parse(data.candidates[0].content.parts[0].text);
    } else {
        // Production call via Serverless Function
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, text, glossary })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Gemini Proxy Error');
        return data;
    }
};

export const analyzeScenarioWithImage = async (imageB64, memo, glossary, apiKey) => {
    const isLocal = window.location.hostname === 'localhost';
    const endpoint = isLocal
        ? `/gemini-api/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
당신은 고도로 숙련된 전문 QA 엔지니어입니다. 첨부된 [스크린샷]과 사용자의 [메모]를 정밀하게 분석하여 새로운 QA 시나리오와 테스트 결과(FAIL)를 작성하십시오.

[사용자 메모]
${memo}

[지침]
1. **전문가용 QA 문구 작성**: 모든 텍스트는 소프트웨어 결함 보고에 적합한 **전문적인 QA 용어와 문체**를 사용하십시오.
2. **1 Depth 화면**: 메모에서 해당 기능이 속한 주요 화면명을 추출하십시오.
3. **2 Depth 영역**: 메모에서 구체적인 기능 영역이나 컴포넌트명을 추출하십시오.
4. **확인 사항**: 해당 화면에서 무엇을 검증해야 하는지 명확한 한 문장으로 작성하십시오.
5. **시나리오**: 이 오류를 발견하기까지의 과정을 **단 1줄의 요약된 문장**으로 작성하십시오.
6. **제목**: "1 Depth > 2 Depth" 형식으로 작성하십시오.
7. **본문 (한글)**: 
   - [재현 경로], [기대 결과], [실제 결과]를 반드시 포함하십시오.
   - **한국어 본문 내에서는 영어 단어를 최대한 배제**하고 적절한 한국어 용어로 작성하십시오.
8. **본문 (영어)**: [제목]과 [본문 (한글)]을 전문적인 영어로 번역하십시오. 
   - [용어 사전]에 정의된 단어는 영문 내에서 반드시 **'한국어(영어)'** 형식으로 표기하십시오.
9. **출력 형식**: 반드시 아래 JSON 형식으로만 응답하십시오.
{
  "depth1": "화면명",
  "depth2": "영역명",
  "checkPoint": "확인 사항 내용",
  "scenario": "에러 발생 상황 1줄 요약",
  "title": "depth1 > depth2",
  "bodyKr": "순수 한국어 중심의 전문 QA 리포트 내용",
  "bodyEn": "한국어(영어) 형식이 적용된 영문 번역 내용"
}

[용어 사전]
${glossary || '없음'}
`;

    const body = {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: imageB64.split(',')[1] // Remove data:image/jpeg;base64,
                    }
                }
            ]
        }],
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini API Error');

    return JSON.parse(data.candidates[0].content.parts[0].text);
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { apiKey, text, target_lang, source_lang } = req.body;

    if (!apiKey) {
        return res.status(400).json({ message: 'Missing DeepL API Key' });
    }

    try {
        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: Array.isArray(text) ? text : [text],
                target_lang: target_lang || 'EN',
                source_lang: source_lang || 'KO'
            }),
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('DeepL Proxy Error:', error);
        return res.status(500).json({ message: 'Internal Server Error', detail: error.message });
    }
}

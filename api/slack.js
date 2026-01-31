export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const { token, body } = req.body;

    if (!token) {
        return res.status(400).json({ ok: false, error: 'Missing Slack Token' });
    }

    try {
        const response = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Slack Proxy Error:', error);
        return res.status(500).json({ ok: false, error: 'Internal Server Error', detail: error.message });
    }
}

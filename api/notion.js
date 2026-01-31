export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { token, body } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Missing Notion Token' });
    }

    try {
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({ message: 'Internal Server Error', detail: error.message });
    }
}

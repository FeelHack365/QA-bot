export default async function handler(req, res) {
    // Only allow POST to the proxy itself (the proxy then forwards the request with the desired method)
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // New format: { token, path, method, body }
    // Old format: { token, body } (path defaults to /v1/pages, method defaults to POST)
    const { token, body } = req.body;
    const path = req.body.path || '/v1/pages';
    const method = req.body.method || 'POST';

    if (!token) {
        return res.status(400).json({ message: 'Missing Notion Token' });
    }

    try {
        const fetchOptions = {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
            }
        };

        // Only add body for methods that support it
        if (body && ['POST', 'PATCH', 'PUT'].includes(method.toUpperCase())) {
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(`https://api.notion.com${path}`, fetchOptions);

        // Handle potential non-JSON responses (though Notion API usually returns JSON)
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = { message: await response.text() };
        }

        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Notion Proxy Error:', error);
        return res.status(500).json({ message: 'Internal Server Error', detail: error.message });
    }
}

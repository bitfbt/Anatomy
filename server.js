import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '20mb' }));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ── Claude Vision handler ──
async function analyzeWithClaude(base64Data, apiKey, prompt, mediaType) {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mediaType,
                            data: base64Data,
                        },
                    },
                    {
                        type: 'text',
                        text: prompt,
                    },
                ],
            },
        ],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock) throw new Error('No text response from Claude');

    let jsonStr = textBlock.text.trim();
    jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
    return JSON.parse(jsonStr);
}

// ── Analyze endpoint ──
app.post('/api/analyze', async (req, res) => {
    const { image, apiKey, prompt } = req.body;

    if (!image || !apiKey) {
        return res.status(400).json({ error: 'Missing image or apiKey' });
    }

    // Extract media type from data URL prefix
    let mediaType = 'image/jpeg';
    const dataUrlMatch = image.match(/^data:(image\/\w+);base64,/);
    if (dataUrlMatch) {
        mediaType = dataUrlMatch[1];
    } else {
        const header = Buffer.from(image.substring(0, 16), 'base64');
        if (header[0] === 0x89 && header[1] === 0x50) mediaType = 'image/png';
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    try {
        const result = await analyzeWithClaude(base64Data, apiKey, prompt, mediaType);
        return res.json(result);
    } catch (err) {
        console.error('AI analysis error:', err.message);
        const shortMsg = (err.message || 'AI analysis failed').slice(0, 200);
        return res.status(500).json({ error: shortMsg });
    }
});

app.listen(PORT, () => {
    console.log(`\n  🔬 AR Anatomy Scanner API proxy running on http://localhost:${PORT}`);
    console.log(`     Claude Vision for anatomy analysis\n`);
});

const IDENTIFY_PROMPT = `You are an anatomy identification AI. Look at this image and identify what body part or anatomical structure is shown.

RULES:
- Return ONLY valid JSON, no extra text, no markdown, no code fences
- Identify the primary body part visible (e.g., "Hand", "Foot", "Arm", "Leg", "Torso", "Head", "Eye", "Ear")
- If no recognizable body part, return "Unknown"
- Confidence is 0-100

Response format:
{"bodyPart":"Hand","confidence":95}`;

function getAnatomyPrompt(bodyPart, layer) {
    const structureType = layer === 'muscles' ? 'MUSCLES' : 'BONES';
    const structureDesc = layer === 'muscles'
        ? 'major muscles and muscle groups'
        : 'major bones and bone structures';

    return `You are an expert anatomy professor with deep knowledge of human anatomy. The image shows a human ${bodyPart}. Identify and label the major ${structureType} that would be found in this ${bodyPart}.

For each anatomical structure, provide:
1. Its name and educational description
2. An x,y label position (percentage 0-100 on the image)
3. A "shape" array of polygon points (percentage coordinates) that outlines the approximate area where this structure is located under the skin surface shown in the image

RULES:
- Return ONLY valid JSON, no extra text, no markdown, no code fences
- Identify 5-8 ${structureDesc}
- x, y = percentage position for the label (0-100)
- shape = array of [x, y] percentage coordinate pairs forming a closed polygon outline of the structure
- Each shape should have 4-8 points that approximate the structure's boundary
- Polygons should follow the visible contour of the body part in the image
- Make shapes anatomically accurate relative to what's visible in the photo
- Keep shapes tightly fitted to where the actual structure would be — avoid making them too large

Response format:
{"object":"${bodyPart}","layer":"${layer}","confidence":95,"parts":[{"name":"Example","detail":"Educational description","x":50,"y":50,"shape":[[45,40],[55,40],[58,55],[52,62],[45,60],[42,50]]}]}`;
}

export async function identifyBodyPart(base64Image, apiKey) {
    if (!apiKey) {
        throw new Error('Claude API key is required. Open Settings to enter it.');
    }

    const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image: base64Image,
            apiKey,
            prompt: IDENTIFY_PROMPT,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return {
        bodyPart: data.bodyPart || 'Unknown',
        confidence: data.confidence || 0,
    };
}

export async function analyzeAnatomy(base64Image, apiKey, bodyPart, layer) {
    if (!apiKey) {
        throw new Error('Claude API key is required. Open Settings to enter it.');
    }

    const prompt = getAnatomyPrompt(bodyPart, layer);

    const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image: base64Image,
            apiKey,
            prompt,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();

    if (!data.object || !Array.isArray(data.parts)) {
        return { object: bodyPart, layer, confidence: 0, parts: [] };
    }

    data.parts = data.parts.map(p => ({
        name: p.name || 'Unknown',
        detail: p.detail || '',
        x: Math.max(0, Math.min(100, Number(p.x) || 50)),
        y: Math.max(0, Math.min(100, Number(p.y) || 50)),
        shape: Array.isArray(p.shape) ? p.shape.map(pt => [
            Math.max(0, Math.min(100, Number(pt[0]) || 0)),
            Math.max(0, Math.min(100, Number(pt[1]) || 0)),
        ]) : [],
    }));

    data.layer = layer;
    return data;
}

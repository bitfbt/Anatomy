const PALM = [0, 5, 9, 13, 17];
const finite = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angleDelta = (next, previous) => Math.atan2(Math.sin(next - previous), Math.cos(next - previous));

export const HAND_CONTINUITY_CONFIG = {
    historySize: 24,
    minHistory: 4,
    maxAgeMs: 1000,
    fadeStartMs: 600,
    maxPredictionMs: 180,
    maxSampleGapMs: 250,
};

function geometry(landmarks, aspect) {
    if (landmarks?.length !== 21 || !landmarks.every(finite)) return null;
    const palm = PALM.map(index => ({ x: landmarks[index].x * aspect, y: landmarks[index].y }));
    const x = palm.reduce((sum, point) => sum + point.x, 0) / palm.length;
    const y = palm.reduce((sum, point) => sum + point.y, 0) / palm.length;
    const size = Math.sqrt(palm.reduce((sum, point) => sum + (point.x - x) ** 2 + (point.y - y) ** 2, 0) / palm.length);
    if (size < 0.005) return null;
    return { x, y, size, angle: Math.atan2(palm[4].y - palm[1].y, palm[4].x - palm[1].x) };
}

function inside(point, width, height, bounds) {
    return point.x * width >= bounds.left && point.x * width <= bounds.right
        && point.y * height >= bounds.top && point.y * height <= bounds.bottom;
}

// A central, enlarged hand is different from a hand moving out of view sideways.
function closeUp(landmarks, width, height, bounds) {
    const xs = landmarks.map(point => point.x * width);
    const ys = landmarks.map(point => point.y * height);
    const left = Math.min(...xs), right = Math.max(...xs);
    const top = Math.min(...ys), bottom = Math.max(...ys);
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    const visible = landmarks.filter(point => inside(point, width, height, bounds)).length;
    return visible >= 2 && left <= centerX && right >= centerX && top <= centerY && bottom >= centerY
        && (right - left >= (bounds.right - bounds.left) * 0.8
            || bottom - top >= (bounds.bottom - bounds.top) * 0.8);
}

function matchCost(previous, current, observation, track) {
    const ratio = current.size / previous.size;
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y) / Math.max(current.size, previous.size);
    const rotation = Math.abs(angleDelta(current.angle, previous.angle));
    if (ratio < 0.55 || ratio > 1.8 || distance > 1.8 || rotation > 0.9) return Infinity;
    const conflictingSide = ['Left', 'Right'].includes(observation.handedness)
        && ['Left', 'Right'].includes(track.handedness)
        && observation.handedness !== track.handedness
        && observation.confidence >= 0.8 && track.confidence >= 0.8;
    return conflictingSide ? Infinity : distance + Math.abs(Math.log(ratio)) + rotation;
}

function slope(history, values) {
    const times = history.map(frame => frame.time - history.at(-1).time);
    const meanTime = times.reduce((sum, value) => sum + value, 0) / times.length;
    const meanValue = values.reduce((sum, value) => sum + value, 0) / values.length;
    const denominator = times.reduce((sum, time) => sum + (time - meanTime) ** 2, 0);
    return denominator > 0
        ? times.reduce((sum, time, index) => sum + (time - meanTime) * (values[index] - meanValue), 0) / denominator
        : 0;
}

function transform(landmarks, aspect, from, to, scale, angle) {
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    return landmarks.map(point => {
        const x = point.x * aspect - from.x, y = point.y - from.y;
        return {
            ...point,
            x: (to.x + scale * (x * cosine - y * sine)) / aspect,
            y: to.y + scale * (x * sine + y * cosine),
            z: (Number.isFinite(point.z) ? point.z : 0) * scale,
        };
    });
}

function predict(track, age, aspect) {
    // Keep longer anatomy history without letting old movement bias a new turn.
    const history = track.history.slice(-5);
    const last = history.at(-1);
    const horizon = Math.min(age, HAND_CONTINUITY_CONFIG.maxPredictionMs);
    const angles = [history[0].geometry.angle];
    for (let index = 1; index < history.length; index += 1) {
        angles.push(angles.at(-1) + angleDelta(history[index].geometry.angle, history[index - 1].geometry.angle));
    }
    const dx = clamp(slope(history, history.map(frame => frame.geometry.x)) * horizon, -last.geometry.size * 0.6, last.geometry.size * 0.6);
    const dy = clamp(slope(history, history.map(frame => frame.geometry.y)) * horizon, -last.geometry.size * 0.6, last.geometry.size * 0.6);
    const scale = clamp(Math.exp(slope(history, history.map(frame => Math.log(frame.geometry.size))) * horizon), 0.8, 1.3);
    const angle = clamp(slope(history, angles) * horizon, -0.25, 0.25);
    return transform(last.landmarks, aspect, last.geometry, {
        x: last.geometry.x + dx, y: last.geometry.y + dy,
    }, scale, angle);
}

// Use visible palm anchors when available, preserving the last measured hand
// shape. Partial or predicted frames never replenish the measured history.
function anchorToCrop(last, current, aspect, width, height, bounds) {
    const indices = PALM.filter(index => inside(current[index], width, height, bounds));
    if (indices.length === 0) return null;
    const center = points => ({
        x: indices.reduce((sum, index) => sum + points[index].x * aspect, 0) / indices.length,
        y: indices.reduce((sum, index) => sum + points[index].y, 0) / indices.length,
    });
    const from = center(last.landmarks), to = center(current);
    let dot = 0, cross = 0, norm = 0;
    indices.forEach(index => {
        const x = last.landmarks[index].x * aspect - from.x, y = last.landmarks[index].y - from.y;
        const nextX = current[index].x * aspect - to.x, nextY = current[index].y - to.y;
        dot += x * nextX + y * nextY;
        cross += x * nextY - y * nextX;
        norm += x * x + y * y;
    });
    const scale = norm > 0.00001 ? Math.hypot(dot, cross) / norm : 1;
    const angle = norm > 0.00001 ? Math.atan2(cross, dot) : 0;
    if (scale < 0.65 || scale > 1.6 || Math.abs(angle) > 0.45
        || Math.hypot(to.x - from.x, to.y - from.y) > last.geometry.size * 1.5) return null;
    const projected = transform(last.landmarks, aspect, from, to, scale, angle);
    const residual = indices.reduce((sum, index) => sum + Math.hypot(
        (projected[index].x - current[index].x) * aspect, projected[index].y - current[index].y,
    ), 0) / indices.length;
    return residual <= last.geometry.size * 0.2 ? projected : null;
}

export class HandContinuityTracker {
    constructor() {
        this.tracks = new Map();
        this.nextId = 0;
        this.viewport = null;
        this.lastTime = null;
    }

    reset() {
        this.tracks.clear();
        this.viewport = null;
        this.lastTime = null;
    }

    update(observations, now, width, height, bounds) {
        const viewport = [width, height, bounds.left, bounds.top, bounds.right, bounds.bottom].join(':');
        if (this.viewport !== viewport || (this.lastTime !== null && now <= this.lastTime)) this.reset();
        this.viewport = viewport;
        this.lastTime = now;
        const aspect = width / height;
        for (const [id, track] of this.tracks) {
            if (now - track.history.at(-1).time >= HAND_CONTINUITY_CONFIG.maxAgeMs) this.tracks.delete(id);
        }
        const shapes = observations.map(observation => geometry(observation.landmarks, aspect));
        // Unidentifiable corrupt geometry must not poison or prolong a history.
        if (shapes.some(shape => !shape)) this.tracks.clear();
        const matched = new Set();
        const cropped = new Map();
        const trackIds = observations.map(() => null);
        const candidates = observations.map((observation, index) => shapes[index]
            ? [...this.tracks].map(([id, track]) => ({ id, cost: matchCost(track.history.at(-1).geometry, shapes[index], observation, track) }))
                .filter(candidate => Number.isFinite(candidate.cost)).sort((a, b) => a.cost - b.cost)
            : []);
        // Discard ambiguous histories rather than assigning one hand to another.
        const ambiguous = new Set();
        candidates.forEach(options => {
            if (options.length > 1 && options[1].cost - options[0].cost < 0.25) {
                options.forEach(option => ambiguous.add(option.id));
            }
        });
        for (const id of ambiguous) this.tracks.delete(id);
        const order = observations.map((_, index) => index).sort((a, b) => (candidates[a][0]?.cost ?? Infinity) - (candidates[b][0]?.cost ?? Infinity));
        for (const index of order) {
            const observation = observations[index];
            if (!shapes[index]) continue;
            const candidate = candidates[index].find(option => this.tracks.has(option.id) && !matched.has(option.id));
            let track = candidate ? this.tracks.get(candidate.id) : null;
            if (!track) {
                for (const [id, previous] of this.tracks) {
                    const spatialCost = matchCost(previous.history.at(-1).geometry, shapes[index], { ...observation, confidence: 0 }, previous);
                    // A palm/back handedness flip must not leave a second,
                    // predicted hand under the current detection.
                    if (!matched.has(id) && spatialCost < 0.5) this.tracks.delete(id);
                }
            }
            // A clearly identified current hand that jumps beyond the spatial
            // gate supersedes its old location, including when it leaves view.
            if (!track && observation.confidence >= 0.8 && ['Left', 'Right'].includes(observation.handedness)) {
                for (const [id, previous] of this.tracks) {
                    if (!matched.has(id) && previous.handedness === observation.handedness) this.tracks.delete(id);
                }
            }
            if (track) matched.add(candidate.id);
            if (!observation.valid) {
                if (track && closeUp(observation.landmarks, width, height, bounds)) cropped.set(candidate.id, {landmarks:observation.landmarks, index});
                else if (track) this.tracks.delete(candidate.id);
                continue;
            }
            if (!track) {
                const id = `continuity-hand-${this.nextId++}`;
                track = { id, history: [] };
                this.tracks.set(id, track);
            }
            const previous = track.history.at(-1);
            if (previous && now - previous.time > HAND_CONTINUITY_CONFIG.maxSampleGapMs) track.history = [];
            track.handedness = observation.handedness;
            track.confidence = observation.confidence;
            track.history.push({ time: now, geometry: shapes[index], landmarks: observation.landmarks.map(point => ({ ...point })) });
            track.history = track.history.slice(-HAND_CONTINUITY_CONFIG.historySize);
            trackIds[index] = track.id;
        }
        const live = new Set(trackIds.filter(Boolean));
        const predictions = [];
        for (const [id, track] of this.tracks) {
            if (live.has(id) || track.history.length < HAND_CONTINUITY_CONFIG.minHistory) continue;
            const last = track.history.at(-1);
            const age = now - last.time;
            const landmarks = cropped.has(id)
                ? anchorToCrop(last, cropped.get(id).landmarks, aspect, width, height, bounds)
                : predict(track, age, aspect);
            if (!landmarks || (!PALM.some(index => inside(landmarks[index], width, height, bounds))
                && !closeUp(landmarks, width, height, bounds))) {
                this.tracks.delete(id);
                continue;
            }
            const fade = age <= HAND_CONTINUITY_CONFIG.fadeStartMs ? 1
                : (HAND_CONTINUITY_CONFIG.maxAgeMs - age) / (HAND_CONTINUITY_CONFIG.maxAgeMs - HAND_CONTINUITY_CONFIG.fadeStartMs);
            predictions.push({ trackId: id, landmarks, alpha: 0.8 * fade, ageMs: age, handedness: track.handedness,
                observationIndex:cropped.get(id)?.index });
        }
        return { trackIds, predictions };
    }
}

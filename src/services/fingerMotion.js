// Sparse image tracking for brief close-ups after the full-hand detector loses
// the hand. Coordinates are pixels in the small, unmirrored grayscale frames.
// Image evidence is required for every returned point; missing points are not
// extrapolated. The caller decides whether enough points agree on hand motion.
const PATCH_RADIUS = 4;
const PATCH_SIDE = PATCH_RADIUS * 2 + 1;
const PATCH_AREA = PATCH_SIDE * PATCH_SIDE;
const SEARCH_RADIUS = 10;
const MAX_POINTS = 64;
const MIN_VARIANCE = 12;
const MIN_CORNER_ENERGY = 2;
const MAX_ERROR = 0.24;

function validFrame(frame) {
    return frame && Number.isInteger(frame.width) && Number.isInteger(frame.height)
        && frame.width >= PATCH_SIDE && frame.height >= PATCH_SIDE
        && frame.data instanceof Uint8Array
        && frame.data.length >= frame.width * frame.height;
}

function inside(frame, x, y) {
    return x >= PATCH_RADIUS && y >= PATCH_RADIUS
        && x < frame.width - PATCH_RADIUS && y < frame.height - PATCH_RADIUS;
}

function patchAt(frame, x, y) {
    if (!inside(frame, x, y)) return null;
    const values = new Float32Array(PATCH_AREA);
    const { data, width } = frame;
    let sum = 0, index = 0;
    for (let dy = -PATCH_RADIUS; dy <= PATCH_RADIUS; dy++) {
        const row = (y + dy) * width + x - PATCH_RADIUS;
        for (let dx = 0; dx < PATCH_SIDE; dx++) {
            const value = data[row + dx];
            values[index++] = value;
            sum += value;
        }
    }
    const mean = sum / PATCH_AREA;
    let energy = 0;
    for (let i = 0; i < values.length; i++) {
        values[i] -= mean;
        energy += values[i] * values[i];
    }
    if (energy / PATCH_AREA < MIN_VARIANCE) return null;

    // A straight finger edge only constrains motion across that edge. Require
    // gradients in both directions to avoid treating sliding along it as fact.
    let xx = 0, xy = 0, yy = 0;
    const innerSide = PATCH_SIDE - 2;
    for (let dy = -PATCH_RADIUS + 1; dy < PATCH_RADIUS; dy++) {
        for (let dx = -PATCH_RADIUS + 1; dx < PATCH_RADIUS; dx++) {
            const offset = (y + dy) * width + x + dx;
            const gx = (data[offset + 1] - data[offset - 1]) / 2;
            const gy = (data[offset + width] - data[offset - width]) / 2;
            xx += gx * gx; xy += gx * gy; yy += gy * gy;
        }
    }
    const minimumEigenvalue = (xx + yy - Math.hypot(xx - yy, 2 * xy)) / 2;
    if (minimumEigenvalue / (innerSide * innerSide) < MIN_CORNER_ENERGY) return null;
    return { values, energy };
}

function matchPatch(source, target, x, y, searchX=x, searchY=y) {
    const patch = patchAt(source, x, y);
    if (!patch) return null;
    const left = Math.max(PATCH_RADIUS, searchX - SEARCH_RADIUS);
    const right = Math.min(target.width - PATCH_RADIUS - 1, searchX + SEARCH_RADIUS);
    const top = Math.max(PATCH_RADIUS, searchY - SEARCH_RADIUS);
    const bottom = Math.min(target.height - PATCH_RADIUS - 1, searchY + SEARCH_RADIUS);
    const costs = [];
    let best = null;
    for (let cy = top; cy <= bottom; cy++) {
        for (let cx = left; cx <= right; cx++) {
            let sum = 0, squares = 0, covariance = 0, index = 0;
            for (let dy = -PATCH_RADIUS; dy <= PATCH_RADIUS; dy++) {
                const row = (cy + dy) * target.width + cx - PATCH_RADIUS;
                for (let dx = 0; dx < PATCH_SIDE; dx++) {
                    const value = target.data[row + dx];
                    sum += value;
                    squares += value * value;
                    covariance += patch.values[index++] * value;
                }
            }
            const energy = Math.max(0, squares - sum * sum / PATCH_AREA);
            if (energy / PATCH_AREA < MIN_VARIANCE) continue;
            // Zero-mean normalized squared difference tolerates exposure shifts
            // while still rejecting patches that have unrelated visual content.
            const error = Math.max(0, 1 - 2 * covariance / (patch.energy + energy));
            const candidate = { x: cx, y: cy, error };
            costs.push(candidate);
            if (!best || error < best.error) best = candidate;
        }
    }
    if (!best || best.error > MAX_ERROR) return null;
    let alternativeError = Infinity;
    for (const candidate of costs) {
        if (Math.max(Math.abs(candidate.x - best.x), Math.abs(candidate.y - best.y)) > 2) {
            alternativeError = Math.min(alternativeError, candidate.error);
        }
    }
    // Repeated patterns can produce a convincing but arbitrary displacement.
    if (alternativeError < Math.max(best.error + 0.015, best.error * 1.15)) return null;
    return best;
}

/**
 * Track up to 64 points between equally sized grayscale Uint8Array frames.
 * Search is bounded to +/-10 pixels around the old or motion-predicted location
 * and a fixed 9x9 patch per point. A prediction only guides the search; matches
 * still need image agreement in both directions.
 * Returns only independently verified matches; `error` is a normalized image
 * mismatch (0 is exact), not an anatomical confidence or a probability.
 */
export function trackImagePoints(previousFrame, currentFrame, points, {predictions=[]}={}) {
    if (!validFrame(previousFrame) || !validFrame(currentFrame) || !Array.isArray(points)
        || previousFrame.width !== currentFrame.width || previousFrame.height !== currentFrame.height) return [];
    const matches = [];
    for (const [index,point] of points.slice(0, MAX_POINTS).entries()) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        const x = Math.round(point.x), y = Math.round(point.y);
        const predicted=predictions[index];
        const guided=Number.isFinite(predicted?.x)&&Number.isFinite(predicted?.y)
            &&Math.hypot(predicted.x-x,predicted.y-y)<=64;
        const forward = matchPatch(previousFrame, currentFrame, x, y,
            guided?Math.round(predicted.x):x,guided?Math.round(predicted.y):y);
        if (!forward) continue;
        const backward = matchPatch(currentFrame, previousFrame, forward.x, forward.y,x,y);
        if (!backward || Math.hypot(backward.x - x, backward.y - y) > 1.5) continue;
        matches.push({
            from: { x: point.x, y: point.y },
            to: { x: point.x + forward.x - x, y: point.y + forward.y - y },
            error: Math.max(forward.error, backward.error),
        });
    }
    return matches;
}

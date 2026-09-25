import { HAND } from './handLandmarks.js';

export const HAND_TRACKING_THRESHOLDS = {
    strongConfidence: 0.70,
    edgeMarginPx: 18,
    minVisibleRatio: 0.35,
};

export function hasInvalidLandmarks(landmarks) {
    return landmarks.slice(0, 21).some(point => (
        !Number.isFinite(point?.x) || !Number.isFinite(point?.y)
    ));
}

export function getHandBounds(landmarks, width, height) {
    const points = landmarks.slice(0, 21).map(point => ({
        x: point.x * width,
        y: point.y * height,
    }));
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);

    return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
        points,
    };
}

// This validates visible landmark geometry for an educational overlay. It does
// not infer hidden anatomy or make a medical assessment.
export function validateHandForRendering(landmarks, confidence, drawW, drawH, visibleBounds) {
    if (!Array.isArray(landmarks) || landmarks.length < 21) {
        return { valid: false, reason: 'No 21 landmarks detected', blocksGrace: false };
    }
    if (hasInvalidLandmarks(landmarks)) {
        return { valid: false, reason: 'Landmarks invalid', blocksGrace: false };
    }

    const bounds = getHandBounds(landmarks, drawW, drawH);
    const visibleW = visibleBounds.right - visibleBounds.left;
    const visibleH = visibleBounds.bottom - visibleBounds.top;
    const bboxArea = Math.max(1, bounds.width * bounds.height);
    const overlapW = Math.max(0, Math.min(bounds.maxX, visibleBounds.right) - Math.max(bounds.minX, visibleBounds.left));
    const overlapH = Math.max(0, Math.min(bounds.maxY, visibleBounds.bottom) - Math.max(bounds.minY, visibleBounds.top));
    const visibleRatio = (overlapW * overlapH) / bboxArea;
    const edgeTooClose = bounds.minX < visibleBounds.left + HAND_TRACKING_THRESHOLDS.edgeMarginPx
        || bounds.maxX > visibleBounds.right - HAND_TRACKING_THRESHOLDS.edgeMarginPx
        || bounds.minY < visibleBounds.top + HAND_TRACKING_THRESHOLDS.edgeMarginPx
        || bounds.maxY > visibleBounds.bottom - HAND_TRACKING_THRESHOLDS.edgeMarginPx;
    const importantLandmarkIds = [
        HAND.WRIST,
        HAND.THUMB_TIP,
        HAND.INDEX_TIP,
        HAND.MIDDLE_TIP,
        HAND.RING_TIP,
        HAND.PINKY_TIP,
    ];
    const importantClippedCount = importantLandmarkIds.filter((index) => {
        const point = bounds.points[index];
        return point.x < visibleBounds.left - 4
            || point.x > visibleBounds.right + 4
            || point.y < visibleBounds.top - 4
            || point.y > visibleBounds.bottom + 4;
    }).length;
    const tooSmall = Math.max(bounds.width, bounds.height) < Math.min(visibleW, visibleH) * 0.04
        || Math.min(bounds.width, bounds.height) < 4;
    const visiblePalmPoints = [HAND.INDEX_MCP, HAND.MIDDLE_MCP, HAND.RING_MCP, HAND.PINKY_MCP]
        .filter(index => {
            const point = bounds.points[index];
            return point.x >= visibleBounds.left && point.x <= visibleBounds.right
                && point.y >= visibleBounds.top && point.y <= visibleBounds.bottom;
        }).length;

    // Close-ups can crop several fingertips while leaving a useful palm view.
    // Keep the overlay until most of the hand or its palm is outside the view.
    if (visibleRatio < HAND_TRACKING_THRESHOLDS.minVisibleRatio || visiblePalmPoints < 2) {
        return {
            valid: false,
            reason: 'Hand partly outside frame',
            blocksGrace: true,
            bounds,
            visibleRatio,
        };
    }
    if (tooSmall) return { valid: false, reason: 'Open hand for better tracking', blocksGrace: false, bounds, visibleRatio };
    // MediaPipe's handedness score classifies left versus right; it is not
    // landmark presence confidence. The detector already gates hand presence.
    const nearEdge = edgeTooClose || importantClippedCount > 0;

    return {
        valid: true,
        uncertain: nearEdge || confidence < HAND_TRACKING_THRESHOLDS.strongConfidence,
        reason: confidence < HAND_TRACKING_THRESHOLDS.strongConfidence
            ? 'Detection uncertain'
            : 'valid',
        warning: nearEdge ? 'Keep fingertips and wrist in view for a complete overlay.' : null,
        blocksGrace: false,
        bounds,
        visibleRatio,
    };
}

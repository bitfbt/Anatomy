import { HAND } from './handLandmarks.js';

export const HAND_TRACKING_THRESHOLDS = {
    strongConfidence: 0.70,
    minAcceptedConfidence: 0.55,
    edgeMarginPx: 18,
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
    const importantClipped = importantLandmarkIds.some((index) => {
        const point = bounds.points[index];
        return point.x < visibleBounds.left - 4
            || point.x > visibleBounds.right + 4
            || point.y < visibleBounds.top - 4
            || point.y > visibleBounds.bottom + 4;
    });
    const tooSmall = bounds.width < visibleW * 0.055 || bounds.height < visibleH * 0.10;
    const tooLarge = bounds.width > visibleW * 0.88 || bounds.height > visibleH * 0.94;

    // A hand can still have a high detector score while its wrist or fingertips
    // are pressed against the visible crop. Do not render a partial anatomy
    // overlay in that case; it is more misleading than a short pause.
    if (visibleRatio < 0.80 || importantClipped || edgeTooClose) {
        return {
            valid: false,
            reason: visibleRatio < 0.80 || importantClipped
                ? 'Hand partly outside frame'
                : 'Move hand fully into frame',
            blocksGrace: true,
            bounds,
            visibleRatio,
        };
    }
    if (tooSmall) return { valid: false, reason: 'Open hand for better tracking', blocksGrace: false, bounds, visibleRatio };
    if (tooLarge) return { valid: false, reason: 'Move hand farther away', blocksGrace: true, bounds, visibleRatio };
    if (confidence < HAND_TRACKING_THRESHOLDS.minAcceptedConfidence) {
        return { valid: false, reason: 'Confidence below threshold', blocksGrace: false, bounds, visibleRatio };
    }

    return {
        valid: true,
        uncertain: confidence < HAND_TRACKING_THRESHOLDS.strongConfidence,
        reason: confidence < HAND_TRACKING_THRESHOLDS.strongConfidence
            ? 'Detection uncertain'
            : 'valid',
        warning: null,
        blocksGrace: false,
        bounds,
        visibleRatio,
    };
}

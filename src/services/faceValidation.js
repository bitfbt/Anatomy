const REQUIRED_FACE_LANDMARKS = [10, 152, 33, 263, 61, 291, 1, 234, 454];

export const FACE_TRACKING_THRESHOLDS = {
    minimumLandmarks: 468,
    strongQuality: 0.72,
    minimumVisibleRatio: 0.93,
    maximumYawRatio: 0.46,
    warningYawRatio: 0.26,
    warningRollRadians: 0.28,
};

export function validateFaceForRendering(landmarks, canvasWidth, canvasHeight, visibleBounds) {
    const bounds = visibleBounds || {
        left: 0,
        top: 0,
        right: canvasWidth,
        bottom: canvasHeight,
    };
    if (!Array.isArray(landmarks) || landmarks.length < FACE_TRACKING_THRESHOLDS.minimumLandmarks) {
        return reject('No complete face landmarks detected');
    }
    if (landmarks.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) {
        return reject('Face landmarks invalid');
    }

    const points = landmarks.map(point => ({ x: point.x * canvasWidth, y: point.y * canvasHeight }));
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const box = {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
    };
    box.width = box.right - box.left;
    box.height = box.bottom - box.top;

    const visibleWidth = Math.max(1, bounds.right - bounds.left);
    const visibleHeight = Math.max(1, bounds.bottom - bounds.top);
    const visibleCount = points.filter(point => (
        point.x >= bounds.left && point.x <= bounds.right &&
        point.y >= bounds.top && point.y <= bounds.bottom
    )).length;
    const visibleRatio = visibleCount / points.length;
    const requiredInside = REQUIRED_FACE_LANDMARKS.every(index => {
        const point = points[index];
        const margin = Math.max(8, Math.min(visibleWidth, visibleHeight) * 0.012);
        return point && point.x >= bounds.left + margin && point.x <= bounds.right - margin
            && point.y >= bounds.top + margin && point.y <= bounds.bottom - margin;
    });

    if (!requiredInside || visibleRatio < FACE_TRACKING_THRESHOLDS.minimumVisibleRatio) {
        return reject('Move face fully into frame', { visibleRatio, box, blocksGrace: true });
    }
    if (box.width < visibleWidth * 0.13 || box.height < visibleHeight * 0.20) {
        return reject('Move face closer to camera', { visibleRatio, box });
    }
    if (box.width > visibleWidth * 0.88 || box.height > visibleHeight * 0.92) {
        return reject('Move face farther from camera', { visibleRatio, box, blocksGrace: true });
    }

    const leftEye = points[33];
    const rightEye = points[263];
    const nose = points[1];
    const eyeDx = rightEye.x - leftEye.x;
    const eyeDy = rightEye.y - leftEye.y;
    const eyeDistance = Math.max(1, Math.hypot(eyeDx, eyeDy));
    let roll = Math.abs(Math.atan2(eyeDy, eyeDx));
    if (roll > Math.PI / 2) roll = Math.PI - roll;
    const eyeCenterX = (leftEye.x + rightEye.x) / 2;
    const yawRatio = Math.abs(nose.x - eyeCenterX) / eyeDistance;
    if (yawRatio > FACE_TRACKING_THRESHOLDS.maximumYawRatio) {
        return reject('Face angle too large', { visibleRatio, box, yawRatio, roll });
    }

    const sizeScore = clamp(Math.min(box.width / (visibleWidth * 0.34), box.height / (visibleHeight * 0.52)), 0, 1);
    const poseScore = clamp(1 - yawRatio * 1.15 - roll * 0.52, 0, 1);
    const quality = clamp(0.46 + visibleRatio * 0.24 + sizeScore * 0.17 + poseScore * 0.13, 0, 0.99);
    const uncertain = quality < FACE_TRACKING_THRESHOLDS.strongQuality
        || yawRatio > FACE_TRACKING_THRESHOLDS.warningYawRatio
        || roll > FACE_TRACKING_THRESHOLDS.warningRollRadians;

    return {
        valid: true,
        uncertain,
        confidence: quality,
        reason: null,
        warning: uncertain ? 'Face front toward camera for better alignment.' : null,
        visibleRatio,
        box,
        yawRatio,
        roll,
        blocksGrace: false,
    };
}

function reject(reason, detail = {}) {
    return {
        valid: false,
        uncertain: false,
        confidence: 0,
        reason,
        warning: null,
        visibleRatio: detail.visibleRatio ?? 0,
        box: detail.box ?? null,
        yawRatio: detail.yawRatio ?? null,
        roll: detail.roll ?? null,
        blocksGrace: detail.blocksGrace ?? false,
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

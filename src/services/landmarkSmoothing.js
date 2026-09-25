export const SMOOTHING_CONFIG = {
    jitterAlpha: 0.22,
    jitterMotionThreshold: 0.003,
    alpha: 0.60,
    normalMotionThreshold: 0.010,
    fastAlpha: 0.95,
    fastMotionThreshold: 0.020,
    referenceFrameMs: 1000 / 60,
    staleAfterMs: 450,
};

export class LandmarkSmoother {
    constructor(config = SMOOTHING_CONFIG) {
        this.config = { ...SMOOTHING_CONFIG, ...config };
        this.tracks = new Map();
    }

    smooth(trackId, landmarks, timestamp) {
        const previous = this.tracks.get(trackId);
        // A new stream/topology or reset clock must never blend with old joints.
        // Invalid timestamps are rendered directly without seeding a history.
        if (!Number.isFinite(timestamp)) {
            this.tracks.delete(trackId);
            return cloneLandmarks(landmarks);
        }
        const elapsed = previous ? timestamp - previous.timestamp : 0;
        if (!previous || elapsed <= 0 || elapsed > this.config.staleAfterMs
            || previous.landmarks.length !== landmarks.length) {
            const seeded = cloneLandmarks(landmarks);
            this.tracks.set(trackId, { landmarks: seeded, timestamp });
            return seeded;
        }

        const frames = elapsed / this.config.referenceFrameMs;
        const motions = landmarks.map((landmark, index) => Math.hypot(
            landmark.x - previous.landmarks[index].x,
            landmark.y - previous.landmarks[index].y,
        ) / frames);
        const sharedMotion = motions.reduce((sum, motion) => sum + motion, 0) / Math.max(1, motions.length);
        const smoothed = landmarks.map((landmark, index) => {
            // Whole-hand movement shares a response; a single moving finger
            // can react faster without making all stationary joints jitter.
            const baseAlpha = motionAlpha(Math.max(sharedMotion, motions[index]), this.config);
            // Same filter time constant at 15, 30 and 60 camera frames/second.
            const alpha = 1 - (1 - baseAlpha) ** frames;
            return {
                ...landmark,
                x: lerp(previous.landmarks[index].x, landmark.x, alpha),
                y: lerp(previous.landmarks[index].y, landmark.y, alpha),
                z: lerp(previous.landmarks[index].z ?? 0, landmark.z ?? 0, alpha),
            };
        });

        this.tracks.set(trackId, { landmarks: smoothed, timestamp });
        return smoothed;
    }

    prune(activeTrackIds) {
        const active = new Set(activeTrackIds);
        for (const trackId of this.tracks.keys()) {
            if (!active.has(trackId)) this.tracks.delete(trackId);
        }
    }

    reset() {
        this.tracks.clear();
    }
}

function cloneLandmarks(landmarks) {
    return landmarks.map(landmark => ({ ...landmark }));
}

function motionAlpha(motion, config) {
    if (motion <= config.jitterMotionThreshold) return config.jitterAlpha;
    if (motion >= config.fastMotionThreshold) return config.fastAlpha;
    if (motion <= config.normalMotionThreshold) {
        return lerp(config.jitterAlpha, config.alpha,
            (motion - config.jitterMotionThreshold) / (config.normalMotionThreshold - config.jitterMotionThreshold));
    }
    return lerp(config.alpha, config.fastAlpha,
        (motion - config.normalMotionThreshold) / (config.fastMotionThreshold - config.normalMotionThreshold));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

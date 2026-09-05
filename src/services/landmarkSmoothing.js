export const SMOOTHING_CONFIG = {
    alpha: 0.38,
    fastAlpha: 0.72,
    fastMotionThreshold: 0.055,
    staleAfterMs: 450,
};

export class LandmarkSmoother {
    constructor(config = SMOOTHING_CONFIG) {
        this.config = config;
        this.tracks = new Map();
    }

    smooth(trackId, landmarks, timestamp) {
        const previous = this.tracks.get(trackId);
        if (!previous || timestamp - previous.timestamp > this.config.staleAfterMs) {
            const seeded = cloneLandmarks(landmarks);
            this.tracks.set(trackId, { landmarks: seeded, timestamp });
            return seeded;
        }

        const motion = averageMotion(previous.landmarks, landmarks);
        const alpha = motion > this.config.fastMotionThreshold
            ? this.config.fastAlpha
            : this.config.alpha;
        const smoothed = landmarks.map((landmark, index) => ({
            ...landmark,
            x: lerp(previous.landmarks[index].x, landmark.x, alpha),
            y: lerp(previous.landmarks[index].y, landmark.y, alpha),
            z: lerp(previous.landmarks[index].z ?? 0, landmark.z ?? 0, alpha),
        }));

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

function averageMotion(previous, next) {
    const total = next.reduce((sum, landmark, index) => {
        const old = previous[index];
        return sum + Math.sqrt((landmark.x - old.x) ** 2 + (landmark.y - old.y) ** 2);
    }, 0);
    return total / Math.max(1, next.length);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

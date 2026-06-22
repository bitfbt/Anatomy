import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let handLandmarker = null;
let isInitializing = false;

export async function initTrackers() {
    if (handLandmarker) return;
    if (isInitializing) {
        while (isInitializing) await new Promise(r => setTimeout(r, 100));
        return;
    }

    isInitializing = true;
    try {
        // Pin WASM version to match the installed npm package (0.10.32).
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
        );

        // Try GPU first; fall back to CPU if WebGPU isn't available.
        const delegate = (typeof navigator !== 'undefined' && navigator.gpu) ? 'GPU' : 'CPU';

        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                delegate,
            },
            runningMode: 'VIDEO',
            numHands: 2,
        });

        console.log(`✅ Hand tracker initialized (delegate: ${delegate})`);
    } catch (err) {
        console.error('Tracker init failed:', err);
        throw err;
    } finally {
        isInitializing = false;
    }
}

export function detectHands(video, timestamp) {
    if (!handLandmarker || !video) return null;
    try { return handLandmarker.detectForVideo(video, timestamp); }
    catch { return null; }
}

export const HAND = {
    WRIST: 0,
    THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
    INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
    MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
    RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
    PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
};

export const POSE = {
    NOSE: 0,
    LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7, RIGHT_EAR: 8,
    LEFT_MOUTH: 9, RIGHT_MOUTH: 10,
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
    LEFT_WRIST: 15, RIGHT_WRIST: 16,
    LEFT_PINKY: 17, RIGHT_PINKY: 18,
    LEFT_INDEX: 19, RIGHT_INDEX: 20,
    LEFT_THUMB: 21, RIGHT_THUMB: 22,
    LEFT_HIP: 23, RIGHT_HIP: 24,
    LEFT_KNEE: 25, RIGHT_KNEE: 26,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
    LEFT_HEEL: 29, RIGHT_HEEL: 30,
    LEFT_FOOT: 31, RIGHT_FOOT: 32,
};

// Key face mesh landmark indices
export const FACE = {
    // Forehead
    FOREHEAD_TOP: 10,
    // Eyes
    LEFT_EYE_TOP: 159, LEFT_EYE_BOTTOM: 145, LEFT_EYE_LEFT: 33, LEFT_EYE_RIGHT: 133,
    RIGHT_EYE_TOP: 386, RIGHT_EYE_BOTTOM: 374, RIGHT_EYE_LEFT: 362, RIGHT_EYE_RIGHT: 263,
    // Nose
    NOSE_TIP: 1, NOSE_BRIDGE: 6, NOSE_LEFT: 129, NOSE_RIGHT: 358,
    NOSE_BOTTOM: 2,
    // Face contour
    CHIN: 152, LEFT_CHEEK: 234, RIGHT_CHEEK: 454,
    LEFT_JAW: 172, RIGHT_JAW: 397,
    LEFT_TEMPLE: 127, RIGHT_TEMPLE: 356,
    // Mouth
    UPPER_LIP: 13, LOWER_LIP: 14, MOUTH_LEFT: 61, MOUTH_RIGHT: 291,
    // Outer face outline key points
    FACE_TOP: 10,
    FACE_LEFT_0: 109, FACE_LEFT_1: 67, FACE_LEFT_2: 103, FACE_LEFT_3: 54,
    FACE_LEFT_4: 21, FACE_LEFT_5: 162, FACE_LEFT_6: 127,
    FACE_RIGHT_0: 338, FACE_RIGHT_1: 297, FACE_RIGHT_2: 332, FACE_RIGHT_3: 284,
    FACE_RIGHT_4: 251, FACE_RIGHT_5: 389, FACE_RIGHT_6: 356,
};

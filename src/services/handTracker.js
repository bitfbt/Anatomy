import { FaceLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { FACE, HAND, POSE } from './handLandmarks.js';

export { FACE, HAND, POSE };

let handLandmarker = null;
let faceLandmarker = null;
let visionPromise = null;
let handInitialization = null;
let faceInitialization = null;

export const HAND_DETECTION_CONFIG = {
    minHandDetectionConfidence: 0.45,
    minHandPresenceConfidence: 0.45,
    minTrackingConfidence: 0.5,
};

export const FACE_DETECTION_CONFIG = {
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
};

export async function initTrackers(target = 'hand') {
    const initializers = [];
    if (target === 'hand' || target === 'all') initializers.push(initHandTracker());
    if (target === 'face' || target === 'all') initializers.push(initFaceTracker());
    await Promise.all(initializers);
}

function resolveVisionFileset() {
    if (!visionPromise) {
        // Pin the WASM runtime to the installed package version to avoid a
        // browser/runtime mismatch after a fresh install.
        visionPromise = FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
        );
    }
    return visionPromise;
}

function detectorDelegate() {
    return (typeof navigator !== 'undefined' && navigator.gpu) ? 'GPU' : 'CPU';
}

async function initHandTracker() {
    if (handLandmarker) return;
    if (handInitialization) return handInitialization;
    handInitialization = (async () => {
        const vision = await resolveVisionFileset();
        const delegate = detectorDelegate();
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                delegate,
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: HAND_DETECTION_CONFIG.minHandDetectionConfidence,
            minHandPresenceConfidence: HAND_DETECTION_CONFIG.minHandPresenceConfidence,
            minTrackingConfidence: HAND_DETECTION_CONFIG.minTrackingConfidence,
        });
        console.log('hand detector initialized', { delegate, ...HAND_DETECTION_CONFIG });
    })();
    try {
        await handInitialization;
    } finally {
        handInitialization = null;
    }
}

async function initFaceTracker() {
    if (faceLandmarker) return;
    if (faceInitialization) return faceInitialization;
    faceInitialization = (async () => {
        const vision = await resolveVisionFileset();
        const delegate = detectorDelegate();
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                delegate,
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            minFaceDetectionConfidence: FACE_DETECTION_CONFIG.minFaceDetectionConfidence,
            minFacePresenceConfidence: FACE_DETECTION_CONFIG.minFacePresenceConfidence,
            minTrackingConfidence: FACE_DETECTION_CONFIG.minTrackingConfidence,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
        });
        console.log('face detector initialized', { delegate, ...FACE_DETECTION_CONFIG });
    })();
    try {
        await faceInitialization;
    } finally {
        faceInitialization = null;
    }
}

export function detectHands(video, timestamp) {
    if (!handLandmarker || !video) return null;
    try { return handLandmarker.detectForVideo(video, timestamp); }
    catch (err) {
        console.warn('hand detector frame failed', err);
        return null;
    }
}

export function detectFaces(video, timestamp) {
    if (!faceLandmarker || !video) return null;
    try { return faceLandmarker.detectForVideo(video, timestamp); }
    catch (err) {
        console.warn('face detector frame failed', err);
        return null;
    }
}

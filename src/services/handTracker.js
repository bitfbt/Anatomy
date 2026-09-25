import { PoseLandmarker, FaceLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { FACE, HAND, POSE } from './handLandmarks.js';

export { FACE, HAND, POSE };

let poseLandmarker = null;
let poseInitialization = null;
let handLandmarker = null;
let faceLandmarker = null;
let visionPromise = null;
let handInitialization = null;
let faceInitialization = null;

export const HAND_DETECTION_CONFIG = {
    minHandDetectionConfidence: 0.35,
    minHandPresenceConfidence: 0.35,
    minTrackingConfidence: 0.4,
};

export const FACE_DETECTION_CONFIG = {
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
};

export async function initTrackers(target = 'hand') {
    const initializers = [];
    if (target === 'body' || target === 'hand' || target === 'all') initializers.push(initPoseTracker());
    if (target === 'hand' || target === 'all') initializers.push(initHandTracker());
    if (target === 'face' || target === 'all') initializers.push(initFaceTracker());
    await Promise.all(initializers);
}

function resolveVisionFileset() {
    if (!visionPromise) {
        // Pin the WASM runtime to the installed package version to avoid a
        // browser/runtime mismatch after a fresh install.
        // Keep the runtime in the app bundle. Camera frames and landmarks stay
        // on-device; startup does not need a request to a CDN.
        visionPromise = FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe/wasm`);
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
                modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
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
                modelAssetPath: `${import.meta.env.BASE_URL}models/face_landmarker.task`,
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

async function initPoseTracker() {
    if (poseLandmarker) return;
    if (poseInitialization) return poseInitialization;
    poseInitialization = (async () => {
        const vision = await resolveVisionFileset();
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`,
                delegate: detectorDelegate(),
            },
            runningMode: 'VIDEO', numPoses: 1,
            minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5, outputSegmentationMasks: false,
        });
    })();
    try { await poseInitialization; } finally { poseInitialization = null; }
}
export function detectBody(video, timestamp) {
    if (!poseLandmarker || !video) return null;
    try { return poseLandmarker.detectForVideo(video, timestamp); }
    catch (error) { console.warn('Body tracking frame failed', error); return null; }
}

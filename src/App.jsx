import { useState, useRef, useCallback, useEffect } from 'react';
import Camera from './components/Camera';
import ScanOverlay from './components/ScanOverlay';
import HUD from './components/HUD';
import ScanButton from './components/ScanButton';
import ErrorFallback from './components/ErrorFallback';
import { initTrackers, detectFaces, detectHands } from './services/handTracker';
import { drawFaceMuscles, drawHandMuscles, drawStylizedHandBones } from './services/anatomyRenderer';
import { LandmarkSmoother } from './services/landmarkSmoothing';
import { CAMERA_CONFIG } from './services/handAnatomyData';
import { HAND_TRACKING_THRESHOLDS, validateHandForRendering } from './services/handValidation';
import { validateFaceForRendering } from './services/faceValidation';

const LOST_HAND_GRACE_MS = 500;
const STALE_FADE_START_MS = 300;
const FRAME_INTERVAL_MS = 33;
const STRONG_CONFIDENCE = HAND_TRACKING_THRESHOLDS.strongConfidence;
const IS_DEV = import.meta.env?.DEV ?? false;
// The camera element is not mirrored in CSS. Keep the HUD and handedness
// messaging consistent with the same source of truth used by anatomy data.
const IS_MIRRORED_CAMERA = CAMERA_CONFIG.isMirroredCamera;

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}

function findBoneHit(point, bones) {
  let best = null;
  let bestDistance = Infinity;
  bones.forEach((bone) => {
    const distance = bone.type === 'node'
      ? Math.hypot(point.x - bone.center.x, point.y - bone.center.y)
      : distanceToSegment(point, bone.from, bone.to);
    const threshold = bone.type === 'node' ? bone.radius : bone.radius;
    if (distance <= threshold && distance < bestDistance) {
      best = bone;
      bestDistance = distance;
    }
  });
  return best;
}

// States: idle | loading | active
export default function App() {
  const [state, setState] = useState('idle');
  const [anatomyTarget, setAnatomyTarget] = useState('hand');
  const [layer, setLayer] = useState('skeleton');
  const [labelMode, setLabelMode] = useState('off');
  const [wristMode, setWristMode] = useState('simple');
  const [muscleLabelMode, setMuscleLabelMode] = useState('clean');
  const [muscleSide, setMuscleSide] = useState('palm');
  const [error, setError] = useState(null);
  const [cameraError, setCameraError] = useState(false);
  const [detectedParts, setDetectedParts] = useState([]);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [hoveredBone, setHoveredBone] = useState(null);
  const [pinnedBone, setPinnedBone] = useState(null);
  const [tooltipPoint, setTooltipPoint] = useState(null);

  const cameraRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const cameraErrorRef = useRef(false);
  const anatomyTargetRef = useRef('hand');
  const layerRef = useRef('skeleton');
  const labelModeRef = useRef('off');
  const wristModeRef = useRef('simple');
  const muscleLabelModeRef = useRef('clean');
  const muscleSideRef = useRef('palm');
  const boneHitTargetsRef = useRef([]);
  const smootherRef = useRef(new LandmarkSmoother());
  const viewportTransformRef = useRef({ offsetX: 0, offsetY: 0 });
  const lastValidHandAtRef = useRef(null);
  const lastValidLandmarksRef = useRef(null);
  const lastValidHandMetaRef = useRef(null);
  const lastPipelineLogAtRef = useRef(0);

  useEffect(() => { layerRef.current = layer; }, [layer]);
  useEffect(() => { anatomyTargetRef.current = anatomyTarget; }, [anatomyTarget]);
  useEffect(() => { labelModeRef.current = labelMode; }, [labelMode]);
  useEffect(() => { wristModeRef.current = wristMode; }, [wristMode]);
  useEffect(() => { muscleLabelModeRef.current = muscleLabelMode; }, [muscleLabelMode]);
  useEffect(() => { muscleSideRef.current = muscleSide; }, [muscleSide]);

  const handleCameraError = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    cameraErrorRef.current = true;
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    boneHitTargetsRef.current = [];
    setCameraError(true);
    setState('idle');
    setDetectedParts([]);
    setTrackingInfo(null);
    setHoveredBone(null);
    setPinnedBone(null);
  }, []);

  const startTracking = useCallback(() => {
    if (cameraErrorRef.current) return;
    const video = cameraRef.current?.getVideoElement();
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      console.warn('tracking start skipped', { hasVideo: !!video, hasCanvas: !!canvas });
      return;
    }
    console.log('tracking loop started');
    const ctx = canvas.getContext('2d');
    let lastTimestamp = 0;

    function trackFrame() {
      if (!video.videoWidth) {
        animFrameRef.current = requestAnimationFrame(trackFrame);
        return;
      }

      const now = performance.now();
      // Throttle to ~30fps to avoid MediaPipe timestamp issues
      if (now - lastTimestamp < FRAME_INTERVAL_MS) {
        animFrameRef.current = requestAnimationFrame(trackFrame);
        return;
      }
      lastTimestamp = now;

      // Render at viewport dimensions so the overlay aligns with the CSS-displayed
      // video (object-fit:cover). Raw videoWidth/videoHeight would stretch the canvas.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let canvasCleared = true;
      let renderSkeletonCalled = false;

      // Compute object-fit:cover transform: landmarks are in normalized video space
      // (0-1), but the viewport shows a cropped region. Translate so drawings land
      // exactly where the video pixels appear on screen.
      const videoAR = video.videoWidth / video.videoHeight;
      const containerAR = vw / vh;
      let drawW, drawH, offsetX = 0, offsetY = 0;
      if (videoAR > containerAR) {
        // Video wider — left/right cropped
        drawH = vh;
        drawW = video.videoWidth * (vh / video.videoHeight);
        offsetX = (drawW - vw) / 2;
      } else {
        // Video taller — top/bottom cropped
        drawW = vw;
        drawH = video.videoHeight * (vw / video.videoWidth);
        offsetY = (drawH - vh) / 2;
      }

      ctx.save();
      ctx.translate(-offsetX, -offsetY);
      viewportTransformRef.current = { offsetX, offsetY };

      const parts = [];
      const activeTrackIds = [];
      const acceptedHands = [];
      const frameHitTargets = [];
      const validationResults = [];
      const currentTarget = anatomyTargetRef.current;
      let rawDetectorConfidence = 0;
      const rawConfidenceAvailable = currentTarget === 'hand';
      let currentRejectedReason = null;
      let hasGraceBlockingRejection = false;
      const visibleBounds = {
        left: offsetX + 18,
        top: offsetY + 18,
        right: offsetX + vw - 18,
        bottom: offsetY + vh - 18,
      };

      const renderTrackedAnatomy = (landmarks, confidence, uncertain) => {
        renderSkeletonCalled = true;
        if (currentTarget === 'face') {
          return drawFaceMuscles(ctx, landmarks, drawW, drawH, {
            labelMode: muscleLabelModeRef.current,
            confidence,
            isUncertain: uncertain,
            visibleBounds,
          });
        }
        return layerRef.current === 'skeleton'
          ? drawStylizedHandBones(ctx, landmarks, drawW, drawH, {
            labelMode: labelModeRef.current,
            wristMode: wristModeRef.current,
            visibleBounds,
          })
          : drawHandMuscles(ctx, landmarks, drawW, drawH, {
            labelMode: muscleLabelModeRef.current,
            side: muscleSideRef.current,
            confidence,
            isUncertain: uncertain,
            visibleBounds,
          });
      };

      const detectorResult = currentTarget === 'face'
        ? detectFaces(video, now)
        : detectHands(video, now);
      const detections = currentTarget === 'face'
        ? detectorResult?.faceLandmarks
        : detectorResult?.landmarks;
      const rawDetectionCount = detections?.length ?? 0;
      const shouldLogPipeline = now - lastPipelineLogAtRef.current > 1000;
      if (currentTarget === 'face' && rawDetectionCount > 0) {
        detections.slice(0, 1).forEach((landmarks, faceIndex) => {
          const renderValidation = validateFaceForRendering(landmarks, drawW, drawH, visibleBounds);
          const confidence = renderValidation.confidence;
          const validation = {
            targetIndex: faceIndex,
            landmarkCount: landmarks?.length ?? 0,
            confidence,
            valid: renderValidation.valid,
            reason: renderValidation.reason,
            visibleRatio: renderValidation.visibleRatio,
            renderSkeletonCalled: false,
          };
          validationResults.push(validation);
          if (!renderValidation.valid) {
            currentRejectedReason = currentRejectedReason || renderValidation.reason;
            hasGraceBlockingRejection = hasGraceBlockingRejection || renderValidation.blocksGrace;
            return;
          }

          const trackId = `face-${faceIndex}`;
          parts.push('face');
          activeTrackIds.push(trackId);
          const smoothedLandmarks = smootherRef.current.smooth(trackId, landmarks, now);
          lastValidLandmarksRef.current = smoothedLandmarks;
          lastValidHandAtRef.current = now;
          lastValidHandMetaRef.current = { trackId, target: 'face', handedness: 'Face', confidence };
          acceptedHands.push({
            trackId,
            target: 'face',
            handedness: 'Face',
            confidence,
            uncertain: renderValidation.uncertain,
            warnings: [
              ...(renderValidation.uncertain ? ['Low confidence - facial anatomy may be inaccurate'] : []),
              ...(renderValidation.warning ? [renderValidation.warning] : []),
            ],
          });
          validation.renderSkeletonCalled = true;
          const renderResult = renderTrackedAnatomy(smoothedLandmarks, confidence, renderValidation.uncertain);
          if (renderResult?.hitTargets) frameHitTargets.push(...renderResult.hitTargets);
        });
      } else if (currentTarget === 'hand' && rawDetectionCount > 0) {
        detections.forEach((landmarks, handIndex) => {
          const handedness = detectorResult.handednesses?.[handIndex]?.[0];
          const confidence = handedness?.score ?? handedness?.categoryScore ?? 0.65;
          rawDetectorConfidence = Math.max(rawDetectorConfidence, confidence);
          const landmarkCount = landmarks?.length ?? 0;
          const renderValidation = validateHandForRendering(landmarks, confidence, drawW, drawH, visibleBounds);
          const validation = {
            handIndex,
            landmarkCount,
            confidence,
            valid: renderValidation.valid,
            reason: renderValidation.reason,
            visibleRatio: renderValidation.visibleRatio,
            renderSkeletonCalled: false,
          };
          if (!renderValidation.valid) {
            currentRejectedReason = currentRejectedReason || renderValidation.reason;
            hasGraceBlockingRejection = hasGraceBlockingRejection || renderValidation.blocksGrace;
            validationResults.push(validation);
            return;
          }
          validationResults.push(validation);
          const trackId = `${handedness?.categoryName || 'hand'}-${handIndex}`;
          const handednessLabel = handedness?.categoryName || 'Hand';

          parts.push(handednessLabel === 'Hand' ? 'hand' : `${handednessLabel} hand`);
          activeTrackIds.push(trackId);
          const smoothedLandmarks = smootherRef.current.smooth(trackId, landmarks, now);
          lastValidLandmarksRef.current = smoothedLandmarks;
          lastValidHandAtRef.current = now;
          lastValidHandMetaRef.current = {
            trackId,
            target: 'hand',
            handedness: handednessLabel,
            confidence,
          };
          acceptedHands.push({
            trackId,
            handedness: handednessLabel,
            confidence,
            uncertain: renderValidation.uncertain,
            warnings: [
              ...(renderValidation.uncertain
                ? [layerRef.current === 'muscles'
                  ? 'Low confidence - anatomy view may be inaccurate'
                  : 'Detection uncertain']
                : []),
              ...(renderValidation.warning ? [renderValidation.warning] : []),
            ],
          });

          validation.renderSkeletonCalled = true;
          const renderResult = renderTrackedAnatomy(smoothedLandmarks, confidence, renderValidation.uncertain);
          if (renderResult?.bones) frameHitTargets.push(...renderResult.bones);

        });
      }
      const timeSinceLastValid = lastValidHandAtRef.current ? now - lastValidHandAtRef.current : null;
      const faceOverlayOff = currentTarget === 'face' && muscleLabelModeRef.current === 'off';
      const canRenderGraceFrame = acceptedHands.length === 0
        && lastValidLandmarksRef.current
        && timeSinceLastValid !== null
        && timeSinceLastValid < LOST_HAND_GRACE_MS
        && !hasGraceBlockingRejection
        && lastValidHandMetaRef.current?.target !== undefined
        && lastValidHandMetaRef.current.target === currentTarget
        && !faceOverlayOff
        && (layerRef.current === 'skeleton' || layerRef.current === 'muscles');
      if (canRenderGraceFrame) {
        ctx.save();
        ctx.globalAlpha = timeSinceLastValid < STALE_FADE_START_MS ? 0.42 : 0.20;
        const renderResult = renderTrackedAnatomy(
          lastValidLandmarksRef.current,
          lastValidHandMetaRef.current?.confidence ?? 0,
          true
        );
        ctx.restore();
        if (renderResult?.bones) frameHitTargets.push(...renderResult.bones);
        if (renderResult?.hitTargets) frameHitTargets.push(...renderResult.hitTargets);
      }
      if (IS_DEV && shouldLogPipeline) {
        console.log('tracking pipeline', {
          rawDetectionCount,
          validationResults: validationResults.map(result => ({
            handIndex: result.handIndex,
            landmarkCount: result.landmarkCount,
            rawConfidence: result.confidence,
            accepted: result.valid,
            rejectionReason: result.valid ? null : result.reason,
            renderSkeletonCalled: result.renderSkeletonCalled,
            visibleRatio: result.visibleRatio,
          })),
          rawDetectorConfidence,
          rawConfidenceAvailable,
          target: currentTarget,
          lastValidConfidence: lastValidHandMetaRef.current?.confidence ?? 0,
          renderSkeletonCalled,
          canvasCleared,
          layer: layerRef.current,
          labelMode: labelModeRef.current,
          wristMode: wristModeRef.current,
          muscleLabelMode: muscleLabelModeRef.current,
          muscleSide: muscleSideRef.current,
          timeSinceLastValidMs: timeSinceLastValid,
          graceFrame: canRenderGraceFrame,
          rejectedReason: currentRejectedReason,
        });
        lastPipelineLogAtRef.current = now;
      }
      if (acceptedHands.length > 0) {
        smootherRef.current.prune(activeTrackIds);
      } else if (!lastValidHandAtRef.current || now - lastValidHandAtRef.current >= LOST_HAND_GRACE_MS) {
        smootherRef.current.reset();
        lastValidLandmarksRef.current = null;
        lastValidHandMetaRef.current = null;
      }

      ctx.restore();
      boneHitTargetsRef.current = (acceptedHands.length > 0 || canRenderGraceFrame) ? frameHitTargets : [];

      setDetectedParts(parts);
      if (acceptedHands.length > 0) {
        const avgConfidence = acceptedHands.reduce((sum, hand) => sum + hand.confidence, 0) / acceptedHands.length;
        const warnings = [...new Set(acceptedHands.flatMap(hand => hand.warnings || []))];
        const handednessLabels = currentTarget === 'face'
          ? 'Face'
          : acceptedHands
            .map(hand => hand.handedness === 'Hand' ? 'Hand' : `${hand.handedness} Hand`)
            .join(', ');
        const uncertain = acceptedHands.some(hand => hand.uncertain);
        setTrackingInfo({
          status: uncertain
            ? 'Detection uncertain'
            : currentTarget === 'face'
              ? 'Tracking: Face'
              : acceptedHands.length === 1 ? `Tracking: ${handednessLabels}` : `Tracking: ${acceptedHands.length} hands`,
          statusType: uncertain ? 'uncertain' : 'tracking',
          target: currentTarget,
          confidence: avgConfidence,
          rawConfidence: rawDetectorConfidence,
          rawConfidenceAvailable,
          acceptedConfidence: avgConfidence,
          currentConfidence: avgConfidence,
          lastValidConfidence: lastValidHandMetaRef.current?.confidence ?? avgConfidence,
          warnings,
          handedness: handednessLabels,
          handednessUncertain: currentTarget === 'hand'
            && acceptedHands.some(hand => !hand.handedness || hand.confidence < STRONG_CONFIDENCE),
          rawDetections: rawDetectionCount,
          acceptedHands: acceptedHands.length,
          acceptedTargets: acceptedHands.length,
          acceptedLandmarks: true,
          skeletonStatus: currentTarget === 'face'
            ? faceOverlayOff ? 'Off' : 'Facial muscles rendering'
            : layerRef.current === 'skeleton' ? 'Rendering' : 'Muscle overlay',
          rejectionReason: null,
          lastValidMs: 0,
          rendererActive: !faceOverlayOff && (layerRef.current === 'skeleton' || layerRef.current === 'muscles'),
          canvasSize: `${canvas.width}x${canvas.height}`,
        });
      } else if (canRenderGraceFrame) {
        const lastMeta = lastValidHandMetaRef.current;
        const handednessLabel = currentTarget === 'face'
          ? 'Face'
          : lastMeta?.handedness && lastMeta.handedness !== 'Hand'
          ? `${lastMeta.handedness} Hand`
          : 'Hand';
        const overlayLabel = currentTarget === 'face'
          ? 'facial muscle overlay'
          : layerRef.current === 'muscles' ? 'muscle overlay' : 'skeleton';
        setTrackingInfo({
          status: 'Detection uncertain',
          statusType: 'uncertain',
          target: currentTarget,
          confidence: 0,
          rawConfidence: rawDetectorConfidence,
          rawConfidenceAvailable,
          acceptedConfidence: 0,
          currentConfidence: 0,
          lastValidConfidence: lastMeta?.confidence ?? 0,
          warnings: [timeSinceLastValid < STALE_FADE_START_MS
            ? `Brief detection drop — fading last stable ${overlayLabel}.`
            : 'Detection uncertain — clearing soon if tracking does not recover.'],
          handedness: 'Uncertain',
          lastHandedness: handednessLabel,
          handednessUncertain: true,
          rawDetections: rawDetectionCount,
          acceptedHands: 0,
          acceptedTargets: 0,
          acceptedLandmarks: false,
          skeletonStatus: 'Fading',
          rejectionReason: currentRejectedReason || 'Waiting for stable detection',
          lastValidMs: timeSinceLastValid,
          rendererActive: true,
          canvasSize: `${canvas.width}x${canvas.height}`,
        });
      } else if (currentRejectedReason) {
        setHoveredBone(null);
        setPinnedBone(null);
        const moveIntoFrame = currentRejectedReason.includes('frame') || hasGraceBlockingRejection;
        const lastValidMs = lastValidHandAtRef.current ? now - lastValidHandAtRef.current : null;
        setTrackingInfo({
          status: moveIntoFrame ? `Move ${currentTarget} into frame` : 'Detection uncertain',
          statusType: moveIntoFrame ? 'move-frame' : 'uncertain',
          target: currentTarget,
          confidence: 0,
          rawConfidence: rawDetectorConfidence,
          rawConfidenceAvailable,
          acceptedConfidence: 0,
          currentConfidence: 0,
          lastValidConfidence: lastValidHandMetaRef.current?.confidence ?? 0,
          warnings: [moveIntoFrame ? `Move ${currentTarget} fully into frame.` : currentRejectedReason],
          handedness: 'Uncertain',
          handednessUncertain: true,
          rawDetections: rawDetectionCount,
          acceptedHands: 0,
          acceptedTargets: 0,
          acceptedLandmarks: false,
          skeletonStatus: moveIntoFrame ? `Move ${currentTarget} into frame` : 'Paused',
          rejectionReason: currentRejectedReason,
          lastValidMs,
          rendererActive: false,
          canvasSize: `${canvas.width}x${canvas.height}`,
        });
      } else {
        setHoveredBone(null);
        setPinnedBone(null);
        const lastValidMs = lastValidHandAtRef.current ? now - lastValidHandAtRef.current : null;
        setTrackingInfo({
          status: `No ${currentTarget} detected`,
          statusType: 'no-hand',
          target: currentTarget,
          confidence: 0,
          rawConfidence: rawDetectorConfidence,
          rawConfidenceAvailable,
          acceptedConfidence: 0,
          currentConfidence: 0,
          lastValidConfidence: lastValidHandMetaRef.current?.confidence ?? 0,
          warnings: [`No ${currentTarget} detected — place your ${currentTarget} in frame.`],
          handedness: 'None',
          handednessUncertain: true,
          rawDetections: rawDetectionCount,
          acceptedHands: 0,
          acceptedTargets: 0,
          acceptedLandmarks: false,
          skeletonStatus: 'Waiting',
          rejectionReason: rawDetectionCount > 0
            ? currentTarget === 'face' ? 'No complete face landmarks detected' : 'No 21 landmarks detected'
            : `No ${currentTarget} detected`,
          lastValidMs,
          rendererActive: false,
          canvasSize: `${canvas.width}x${canvas.height}`,
        });
      }
      animFrameRef.current = requestAnimationFrame(trackFrame);
    }

    trackFrame();
  }, []);

  const handleScan = useCallback(async () => {
    cameraErrorRef.current = false;
    setState('loading');
    setError(null);
    try {
      await initTrackers(anatomyTargetRef.current);
      if (cameraErrorRef.current) return;
      setState('active');
      // Preload the alternate local model without making hand startup depend on
      // the larger face model succeeding.
      const alternateTarget = anatomyTargetRef.current === 'face' ? 'hand' : 'face';
      void initTrackers(alternateTarget).catch(err => {
        if (IS_DEV) console.warn(`${alternateTarget} detector preload failed`, err);
      });
      setTimeout(() => {
        if (!cameraErrorRef.current) startTracking();
      }, 100);
    } catch (err) {
      if (cameraErrorRef.current) return;
      setError('Failed to load tracking models: ' + err.message);
      setState('idle');
    }
  }, [startTracking]);

  const handleRescan = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    boneHitTargetsRef.current = [];
    setDetectedParts([]);
    setHoveredBone(null);
    setPinnedBone(null);
    smootherRef.current.reset();
    lastValidHandAtRef.current = null;
    lastValidLandmarksRef.current = null;
    lastValidHandMetaRef.current = null;
    setState('idle');
  }, []);

  const handleAnalyze = useCallback(() => {
    console.log('Analyze clicked');
    const nextLayer = anatomyTargetRef.current === 'face' ? 'muscles' : 'skeleton';
    setLayer(nextLayer);
    layerRef.current = nextLayer;
    if (state === 'active' && !animFrameRef.current) startTracking();
  }, [startTracking, state]);

  const handleLayerChange = useCallback((nextLayer) => {
    if (anatomyTargetRef.current === 'face' && nextLayer !== 'muscles') return;
    setLayer(nextLayer);
    layerRef.current = nextLayer;
    setHoveredBone(null);
    setPinnedBone(null);

    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleAnatomyTargetChange = useCallback((nextTarget) => {
    if (nextTarget !== 'hand' && nextTarget !== 'face') return;
    anatomyTargetRef.current = nextTarget;
    setAnatomyTarget(nextTarget);
    if (nextTarget === 'face') {
      layerRef.current = 'muscles';
      setLayer('muscles');
    }
    boneHitTargetsRef.current = [];
    smootherRef.current.reset();
    lastValidHandAtRef.current = null;
    lastValidLandmarksRef.current = null;
    lastValidHandMetaRef.current = null;
    setDetectedParts([]);
    setTrackingInfo(null);
    setHoveredBone(null);
    setPinnedBone(null);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    void initTrackers(nextTarget).catch(err => {
      setError(`Failed to load ${nextTarget} tracking model: ${err.message}`);
    });
  }, []);

  const getCanvasPoint = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const transform = viewportTransformRef.current;
    return {
      x: event.clientX - rect.left + transform.offsetX,
      y: event.clientY - rect.top + transform.offsetY,
    };
  }, []);

  const handleCanvasPointerMove = useCallback((event) => {
    if (pinnedBone) return;
    const point = getCanvasPoint(event);
    if (!point) return;
    const hit = findBoneHit(point, boneHitTargetsRef.current);
    setHoveredBone(hit);
    setTooltipPoint(hit ? { x: event.clientX, y: event.clientY } : null);
  }, [getCanvasPoint, pinnedBone]);

  const handleCanvasClick = useCallback((event) => {
    const point = getCanvasPoint(event);
    if (!point) return;
    const hit = findBoneHit(point, boneHitTargetsRef.current);
    setPinnedBone(hit);
    setHoveredBone(null);
    setTooltipPoint(hit ? { x: event.clientX, y: event.clientY } : null);
  }, [getCanvasPoint]);

  const handleCanvasPointerLeave = useCallback(() => {
    if (!pinnedBone) {
      setHoveredBone(null);
      setTooltipPoint(null);
    }
  }, [pinnedBone]);

  const isActive = state === 'active';
  const hasValidTarget = (trackingInfo?.acceptedTargets ?? trackingInfo?.acceptedHands ?? 0) > 0;
  const filterClass = isActive && hasValidTarget
    ? layer === 'skeleton'
      ? 'filter-skeleton'
      : layer === 'muscles'
        ? 'filter-muscles'
        : ''
    : '';
  const activeBoneInfo = pinnedBone || hoveredBone;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: '#000' }}>
      {!cameraError && (
        <Camera ref={cameraRef} active={state !== 'idle'} onError={handleCameraError} filterClass={filterClass} />
      )}

      <canvas
        ref={canvasRef}
        onPointerMove={handleCanvasPointerMove}
        onPointerLeave={handleCanvasPointerLeave}
        onClick={handleCanvasClick}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          zIndex: 35, pointerEvents: isActive ? 'auto' : 'none', display: isActive ? 'block' : 'none',
        }}
      />

      {isActive && activeBoneInfo && tooltipPoint && (
        <div
          className={`bone-tooltip ${pinnedBone ? 'pinned' : ''}`}
          style={{
            left: Math.min(window.innerWidth - 238, Math.max(12, tooltipPoint.x + 14)),
            top: Math.min(window.innerHeight - 130, Math.max(12, tooltipPoint.y + 14)),
          }}
        >
          <strong>{activeBoneInfo.name}</strong>
          <span>{activeBoneInfo.group}</span>
          {activeBoneInfo.finger && <span>{activeBoneInfo.finger} · {activeBoneInfo.segment}</span>}
          {!activeBoneInfo.finger && activeBoneInfo.side && (
            <span>{activeBoneInfo.side === 'center' ? 'Midline' : `${activeBoneInfo.side} side`} · {activeBoneInfo.segment}</span>
          )}
          {activeBoneInfo.location && <span>{activeBoneInfo.location}</span>}
          <p>{activeBoneInfo.explanation}</p>
        </div>
      )}

      {cameraError && <ErrorFallback type="camera" />}
      {error && <ErrorFallback type="tracker-error" message={error} onRetry={handleScan} />}

      <ScanOverlay state={state} />

      <HUD
        state={state}
        anatomyTarget={anatomyTarget}
        layer={layer}
        detectedParts={detectedParts}
        trackingInfo={trackingInfo}
        labelMode={labelMode}
        wristMode={wristMode}
        muscleLabelMode={muscleLabelMode}
        muscleSide={muscleSide}
        isMirroredCamera={IS_MIRRORED_CAMERA}
      />

      {!cameraError && (
        <ScanButton
          state={state}
          anatomyTarget={anatomyTarget}
          onAnatomyTargetChange={handleAnatomyTargetChange}
          onScan={handleScan}
          onRescan={handleRescan}
          onAnalyze={handleAnalyze}
          labelMode={labelMode}
          onLabelModeChange={setLabelMode}
          wristMode={wristMode}
          onWristModeChange={setWristMode}
          layer={layer}
          onLayerChange={handleLayerChange}
          muscleLabelMode={muscleLabelMode}
          onMuscleLabelModeChange={setMuscleLabelMode}
          muscleSide={muscleSide}
          onMuscleSideChange={setMuscleSide}
        />
      )}
    </div>
  );
}

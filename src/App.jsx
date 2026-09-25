import { ForearmTracker } from './services/forearmTracking';
import { alignForearmToHand } from './services/forearmAlignment';
import { ForearmPlacement } from './services/forearmPlacement';
import ForearmControls from './components/ForearmControls';
import { drawForearm, drawForearmLabels } from './services/forearmAnatomy';
import { drawBodyAnatomy } from './services/bodyAnatomy';
import { useState, useRef, useCallback, useEffect } from 'react';
import Camera from './components/Camera';
import ScanOverlay from './components/ScanOverlay';
import HUD from './components/HUD';
import WristLegend from './components/WristLegend';
import ScanButton from './components/ScanButton';
import ErrorFallback from './components/ErrorFallback';
import { initTrackers, detectFaces, detectHands, detectBody } from './services/handTracker';
import { drawFaceSkull, drawFaceMuscles, drawHandMuscles, drawStylizedHandBones, drawTrackedFingerAnatomy } from './services/anatomyRenderer';
import { LandmarkSmoother } from './services/landmarkSmoothing';
import { HandContinuityTracker } from './services/handContinuity';
import { FingerContinuityTracker, FingerFrameSampler } from './services/fingerContinuity';
import { CAMERA_CONFIG } from './services/handAnatomyData';
import { HAND_TRACKING_THRESHOLDS, validateHandForRendering } from './services/handValidation';
import { validateFaceForRendering } from './services/faceValidation';
import { findAnatomyHit } from './services/anatomyHitTesting';
import CameraSwitch from './components/CameraSwitch';
import { createTrackingLifecycle } from './services/trackingLifecycle';

const LOST_HAND_GRACE_MS = 500;
const STALE_FADE_START_MS = 300;
const STRONG_CONFIDENCE = HAND_TRACKING_THRESHOLDS.strongConfidence;
const IS_DEV = import.meta.env?.DEV ?? false;
// The camera element is not mirrored in CSS. Keep the HUD and handedness
// messaging consistent with the same source of truth used by anatomy data.
const IS_MIRRORED_CAMERA = CAMERA_CONFIG.isMirroredCamera;

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
  const [cameraErrorMessage, setCameraErrorMessage] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('environment');
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [detectedParts, setDetectedParts] = useState([]);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [hoveredBone, setHoveredBone] = useState(null);
  const [pinnedBone, setPinnedBone] = useState(null);
  const [tooltipPoint, setTooltipPoint] = useState(null);
  const [aligningElbow, setAligningElbow] = useState(false);

  const cameraRef = useRef(null);
  const canvasRef = useRef(null);
  const lifecycleRef = useRef(createTrackingLifecycle());
  const modelsReadyRef = useRef(false);
  const cameraErrorRef = useRef(false);
  const anatomyTargetRef = useRef('hand');
  const layerRef = useRef('skeleton');
  const labelModeRef = useRef('off');
  const wristModeRef = useRef('simple');
  const muscleLabelModeRef = useRef('clean');
  const muscleSideRef = useRef('palm');
  const boneHitTargetsRef = useRef([]);
  const smootherRef = useRef(new LandmarkSmoother());
  const handContinuityRef = useRef(new HandContinuityTracker());
  const fingerContinuityRef = useRef(new FingerContinuityTracker());
  const fingerFrameSamplerRef = useRef(new FingerFrameSampler());
  const forearmTrackerRef = useRef(new ForearmTracker());
  const forearmPlacementRef = useRef(new ForearmPlacement());
  const forearmCandidatesRef = useRef([]);
  const aligningElbowRef = useRef(false);
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

  const resetEphemeralState = useCallback(() => {
    smootherRef.current.reset();
    handContinuityRef.current.reset();
    fingerContinuityRef.current.reset();
    fingerFrameSamplerRef.current.reset();
    forearmTrackerRef.current.reset();
    forearmPlacementRef.current.reset();
    forearmCandidatesRef.current = [];
    boneHitTargetsRef.current = [];
    lastValidHandAtRef.current = null;
    lastValidLandmarksRef.current = null;
    lastValidHandMetaRef.current = null;
    aligningElbowRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const clearTrackingDisplay = useCallback(() => {
    resetEphemeralState();
    setAligningElbow(false);
    setHoveredBone(null);
    setPinnedBone(null);
    setTooltipPoint(null);
    setTrackingInfo(null);
    setDetectedParts([]);
  }, [resetEphemeralState]);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    return () => {
      lifecycle.cancelScan();
      resetEphemeralState();
    };
  }, [resetEphemeralState]);

  const handleCameraReleased = useCallback(() => {
    lifecycleRef.current.stopLoop();
    clearTrackingDisplay();
  }, [clearTrackingDisplay]);

  const handleCameraError = useCallback((error) => {
    lifecycleRef.current.cancelScan();
    clearTrackingDisplay();
    setCameraSwitching(false);
    cameraErrorRef.current = true;
    const isPermissionError = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
    setCameraErrorMessage(isPermissionError ? null : 'AnatomyLens could not start the camera. Close other apps using the camera, then retry.');
    setCameraError(true);
    setState('idle');
  }, [clearTrackingDisplay]);

  const handleCameraSwitch = useCallback(() => {
    lifecycleRef.current.stopLoop();
    clearTrackingDisplay();
    setCameraSwitching(state !== 'idle');
    cameraErrorRef.current = false;
    setCameraError(false);
    setCameraErrorMessage(null);
    setCameraFacing(current => current === 'user' ? 'environment' : 'user');
  }, [state, clearTrackingDisplay]);

  const startTracking = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (cameraErrorRef.current || !modelsReadyRef.current || !lifecycle.isActive() || lifecycle.isRunning()) return;
    const video = cameraRef.current?.getVideoElement();
    const canvas = canvasRef.current;
    if (!video?.srcObject || !canvas) return;
    const ctx = canvas.getContext('2d');
    let lastVideoTime = -1;
    let lastVideoStream = null;
    let lastSurface = '';
    const trackingFrame = document.createElement('canvas');
    const trackingContext = trackingFrame.getContext('2d', {alpha:false});
    const owner = lifecycle.startLoop(() => {
      trackingFrame.width = 0;
      trackingFrame.height = 0;
      lastVideoStream = null;
    });
    if (!owner) return;

    function trackFrame() {
      if (!owner.isCurrent()) return;
      if (!video.srcObject || !video.videoWidth || video.readyState < 2 || video.currentTime === lastVideoTime) {
        owner.schedule(trackFrame);
        return;
      }

      const now = performance.now();
      lastVideoTime = video.currentTime;
      if (lastVideoStream !== video.srcObject) {
        smootherRef.current.reset();
        handContinuityRef.current.reset();
        fingerContinuityRef.current.reset();
        forearmTrackerRef.current.reset();
        forearmPlacementRef.current.reset();
        forearmCandidatesRef.current = [];
        aligningElbowRef.current = false;
        setAligningElbow(false);
        lastVideoStream = video.srcObject;
      }

      // Render at viewport dimensions so the overlay aligns with the CSS-displayed
      // video (object-fit:cover). Raw videoWidth/videoHeight would stretch the canvas.
      const surface = canvas.getBoundingClientRect();
      const vw = Math.round(surface.width);
      const vh = Math.round(surface.height);
      if (vw < 1 || vh < 1) {
        owner.schedule(trackFrame);
        return;
      }
      const surfaceKey = `${vw}:${vh}:${video.videoWidth}:${video.videoHeight}`;
      if (surfaceKey !== lastSurface) {
        smootherRef.current.reset();
        forearmTrackerRef.current.reset();
        forearmPlacementRef.current.reset();
        forearmCandidatesRef.current = [];
        aligningElbowRef.current = false;
        setAligningElbow(false);
        handContinuityRef.current.reset();
        fingerContinuityRef.current.reset();
        lastSurface = surfaceKey;
      }
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Both landmark models and image motion see the same captured pixels.
      // Reading the live video twice can pair landmarks from different frames.
      if (trackingFrame.width !== video.videoWidth || trackingFrame.height !== video.videoHeight) {
        trackingFrame.width = video.videoWidth;
        trackingFrame.height = video.videoHeight;
      }
      trackingContext.drawImage(video, 0, 0);
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

      if (anatomyTargetRef.current === 'body') {
        const raw = detectBody(trackingFrame, now)?.landmarks?.[0];
        let result = { count: 0, partial: true };
        if (raw?.length === 33) {
          const smoothed = smootherRef.current.smooth('body-0', raw, now);
          result = drawBodyAnatomy(ctx, smoothed, drawW, drawH, {
            layer: layerRef.current,
            labelMode: layerRef.current === 'skeleton' ? labelModeRef.current : muscleLabelModeRef.current,
            visibleBounds: { left: offsetX + 18, top: offsetY + 18, right: offsetX + vw - 18, bottom: offsetY + vh - 18 },
          });
        } else smootherRef.current.reset();
        ctx.restore();
        boneHitTargetsRef.current = [];
        setDetectedParts(result.count ? ['body'] : []);
        setTrackingInfo({ target: 'body', status: result.count ? result.partial ? 'Tracking: Partial body' : 'Tracking: Full body' : 'Step back so your body is visible',
          statusType: result.count ? 'tracking' : 'waiting', acceptedTargets: result.count ? 1 : 0,
          acceptedLandmarks: result.count > 0, skeletonStatus: result.count ? 'Rendering' : 'Waiting',
          warnings: [result.partial ? 'Keep shoulders, hips and feet in frame. Hidden regions are not drawn.' : 'Move slowly and face the camera.'],
        });
        owner.schedule(trackFrame);
        return;
      }

      const parts = [];
      const activeTrackIds = [];
      const acceptedHands = [];
      const frameHitTargets = [];
      const forearmLabelRequests = [];
      const pairedForearmTracks = new Set();
      const forearmCandidates = [];
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
          if (layerRef.current === 'skeleton') {
            return drawFaceSkull(ctx, landmarks, drawW, drawH, {
              labelMode: labelModeRef.current,
              visibleBounds,
            });
          }
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
            isUncertain: uncertain,
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

      const armPose = currentTarget === 'hand' ? detectBody(trackingFrame, now)?.landmarks?.[0] : null;
      const usedArmWrists = new Set();
      const forearmInfo = {trackedForearms:0, estimatedForearms:0, approximateForearms:0,
        manualForearms:0, pinnedForearms:0, croppedForearms:0, missingForearms:0};
      const detectorResult = currentTarget === 'face'
        ? detectFaces(trackingFrame, now)
        : detectHands(trackingFrame, now);
      const detections = currentTarget === 'face'
        ? detectorResult?.faceLandmarks
        : detectorResult?.landmarks;
      const rawDetectionCount = detections?.length ?? 0;
      const handObservations = currentTarget === 'hand' ? (detections ?? []).map((landmarks, index) => {
        const handedness = detectorResult.handednesses?.[index]?.[0];
        const confidence = handedness?.score ?? handedness?.categoryScore ?? 0.65;
        const validation = validateHandForRendering(landmarks, confidence, drawW, drawH, visibleBounds);
        return { landmarks, confidence, handedness: handedness?.categoryName || 'Hand', valid: validation.valid, validation };
      }) : [];
      const continuity = currentTarget === 'hand'
        ? handContinuityRef.current.update(handObservations, now, drawW, drawH, visibleBounds)
        : { trackIds: [], predictions: [] };
      const imageFrame = currentTarget === 'hand' ? fingerFrameSamplerRef.current.capture(trackingFrame) : null;
      if (currentTarget === 'hand') forearmPlacementRef.current.updateFrame(imageFrame, now);
      const fingerPredictions = currentTarget === 'hand' ? fingerContinuityRef.current.update(
        handObservations.map((observation, index) => ({
          ...observation,
          trackId: continuity.trackIds[index],
        })).filter(observation => observation.valid),
        imageFrame, now,
        { left: offsetX / drawW, top: offsetY / drawH, right: (offsetX + vw) / drawW, bottom: (offsetY + vh) / drawH },
      ) : [];
      const fingerHandIds = new Set(fingerPredictions.map(finger => finger.trackId));
      // A retained close-up digit (including its brief focus-loss prediction)
      // takes precedence over a second extrapolated whole-hand drawing.
      continuity.predictions = continuity.predictions.filter(prediction => !fingerHandIds.has(prediction.trackId));
      const predictedHandCount = continuity.predictions.length + fingerHandIds.size;
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
          const armBounds = {left: offsetX, top: offsetY, right: offsetX+vw, bottom: offsetY+vh};
          const renderValidation = handObservations[handIndex].validation;
          const measuredForearm = forearmTrackerRef.current.resolve(landmarks, armPose, drawW, drawH, armBounds, usedArmWrists, now);
          const placementTrackId = continuity.trackIds[handIndex] || `hand-${handIndex}`;
          const forearmMatch = renderValidation.valid ? forearmPlacementRef.current.resolve(landmarks, measuredForearm, {
            trackId:placementTrackId,w:drawW,h:drawH,bounds:armBounds,now,
          }) : measuredForearm;
          if (renderValidation.valid) forearmCandidates.push({trackId:placementTrackId,hand:landmarks,
            w:drawW,h:drawH,bounds:armBounds,match:forearmMatch,time:now});
          // A current wrist can support a visible forearm even with cropped
          // fingers. Do not draw the rejected hand geometry in this case.
          const forearmOnly = !renderValidation.valid && !!forearmMatch;

          const validation = {
            handIndex,
            landmarkCount,
            confidence,
            valid: renderValidation.valid || forearmOnly,
            reason: renderValidation.reason,
            visibleRatio: renderValidation.visibleRatio,
            renderSkeletonCalled: false,
          };
          if (!renderValidation.valid && !forearmOnly) {
            currentRejectedReason = currentRejectedReason || renderValidation.reason;
            hasGraceBlockingRejection = hasGraceBlockingRejection || renderValidation.blocksGrace;
            validationResults.push(validation);
            return;
          }
          validationResults.push(validation);
          const pairedPrediction = forearmOnly
            ? continuity.predictions.find(prediction => prediction.observationIndex === handIndex) : null;
          const trackId = continuity.trackIds[handIndex]
            || pairedPrediction?.trackId
            || (forearmMatch ? `hand-arm-${forearmMatch.index}` : `${handedness?.categoryName || 'hand'}-${handIndex}`);
          const handednessLabel = handedness?.categoryName || 'Hand';

          parts.push(handednessLabel === 'Hand' ? 'hand' : `${handednessLabel} hand`);
          activeTrackIds.push(trackId);
          const smoothedLandmarks = smootherRef.current.smooth(trackId, landmarks, now);
          // A cropped hand may already have a continuity rendering queued for
          // this frame. The forearm must use that exact same wrist and palm.
          const forearmHand = pairedPrediction?.landmarks || smoothedLandmarks;
          lastValidLandmarksRef.current = forearmOnly ? null : smoothedLandmarks;
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
          if (forearmMatch) {
            const armTrackId = `pose-${forearmMatch.index}-forearm`;
            activeTrackIds.push(armTrackId);
            const alignedForearm = alignForearmToHand(forearmMatch, forearmHand, smootherRef.current, armTrackId, now);
            const {elbow} = alignedForearm;
            const forearmDrawn = drawForearm(ctx, forearmHand, alignedForearm, drawW, drawH, {
              layer: layerRef.current, side: muscleSideRef.current,
              labelMode: layerRef.current === 'skeleton' ? labelModeRef.current : muscleLabelModeRef.current,
              visibleBounds: armBounds,
              labelCollector: forearmLabelRequests,
            });
            renderSkeletonCalled = renderSkeletonCalled || forearmDrawn;
            if (forearmDrawn) {
              if (pairedPrediction) pairedForearmTracks.add(pairedPrediction.trackId);
              const kind = forearmMatch.source === 'approximate' ? 'approximateForearms'
                : forearmMatch.source === 'manual-pinned' ? 'pinnedForearms'
                : forearmMatch.source === 'manual-tracked' ? 'manualForearms'
                : forearmMatch.held && forearmMatch.ageMs > 180 ? 'estimatedForearms' : 'trackedForearms';
              forearmInfo[kind] += 1;
              if (elbow.x * drawW < armBounds.left || elbow.x * drawW > armBounds.right
                || elbow.y * drawH < armBounds.top || elbow.y * drawH > armBounds.bottom) forearmInfo.croppedForearms += 1;
              if (forearmMatch.held) acceptedHands[acceptedHands.length - 1].warnings.push('Briefly retaining the last detected elbow. Keep your arm in view.');
            }
          } else {
            forearmInfo.missingForearms += 1;
            acceptedHands[acceptedHands.length - 1].warnings.push('Show your elbow to align the forearm.');
          }
          if (forearmOnly) acceptedHands[acceptedHands.length - 1].warnings = ['Tracking the visible forearm; fingers are outside the view.'];
          const renderResult = forearmOnly ? null : renderTrackedAnatomy(smoothedLandmarks, confidence, renderValidation.uncertain);
          if (renderResult?.bones) frameHitTargets.push(...renderResult.bones);
          if (renderResult?.hitTargets) frameHitTargets.push(...renderResult.hitTargets);

        });
      }
      // Draw each missing hand independently, even if another hand or a current
      // forearm is still visible. These estimates never become measurements.
      for (const prediction of continuity.predictions) {
        activeTrackIds.push(prediction.trackId);
        ctx.save();
        ctx.globalAlpha *= prediction.alpha;
        // Coast an existing arm placement with the same predicted wrist for a
        // brief detector blink. This cannot create or refresh an elbow estimate.
        if (!pairedForearmTracks.has(prediction.trackId) && prediction.ageMs <= 180) {
          const heldArm = forearmPlacementRef.current.coast(prediction.landmarks, {
            trackId:prediction.trackId,w:drawW,h:drawH,bounds:visibleBounds,now,
          }) || forearmTrackerRef.current.resolve(prediction.landmarks, null, drawW, drawH, visibleBounds, usedArmWrists, now);
          if (heldArm) {
            const armTrackId = `pose-${heldArm.index}-forearm`;
            activeTrackIds.push(armTrackId);
            const alignedArm = alignForearmToHand(heldArm, prediction.landmarks, smootherRef.current, armTrackId, now);
            if (drawForearm(ctx, prediction.landmarks, alignedArm, drawW, drawH, {
              layer:layerRef.current, side:muscleSideRef.current, labelMode:'off', visibleBounds,
            })) forearmInfo.estimatedForearms += 1;
          }
        }
        const predictedResult=renderTrackedAnatomy(prediction.landmarks, 0, true);
        if(predictedResult?.hitTargets)frameHitTargets.push(...predictedResult.hitTargets);
        ctx.restore();
      }
      for (const finger of fingerPredictions) {
        activeTrackIds.push(finger.trackId);
        ctx.save();
        ctx.globalAlpha *= finger.alpha;
        const fingerResult=drawTrackedFingerAnatomy(ctx, finger, drawW, drawH, {
          layer: layerRef.current,
          side: muscleSideRef.current,
          labelMode: layerRef.current === 'skeleton' ? labelModeRef.current : muscleLabelModeRef.current,
          visibleBounds,
        });
        if(fingerResult?.hitTargets)frameHitTargets.push(...fingerResult.hitTargets);
        ctx.restore();
        renderSkeletonCalled = true;
      }
      const hasPredictedHands = predictedHandCount > 0;
      const timeSinceLastValid = lastValidHandAtRef.current ? now - lastValidHandAtRef.current : null;
      const faceOverlayOff = currentTarget === 'face' && layerRef.current === 'muscles' && muscleLabelModeRef.current === 'off';
      const canRenderGraceFrame = currentTarget === 'face' && acceptedHands.length === 0
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
      frameHitTargets.push(...drawForearmLabels(ctx, forearmLabelRequests));
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
          predictedHands: predictedHandCount,
          predictedFingers: fingerPredictions.length,
          rejectedReason: currentRejectedReason,
        });
        lastPipelineLogAtRef.current = now;
      }
      if (acceptedHands.length > 0 || hasPredictedHands) {
        smootherRef.current.prune(activeTrackIds);
      } else if (!lastValidHandAtRef.current || now - lastValidHandAtRef.current >= LOST_HAND_GRACE_MS) {
        smootherRef.current.reset();
        lastValidLandmarksRef.current = null;
        lastValidHandMetaRef.current = null;
      }

      ctx.restore();
      boneHitTargetsRef.current = (acceptedHands.length > 0 || canRenderGraceFrame || hasPredictedHands) ? frameHitTargets : [];
      forearmCandidatesRef.current = forearmCandidates;
      forearmInfo.alignableHands = forearmCandidates.length;

      setDetectedParts(parts);
      if (acceptedHands.length > 0) {
        const avgConfidence = acceptedHands.reduce((sum, hand) => sum + hand.confidence, 0) / acceptedHands.length;
        const warnings = [...new Set(acceptedHands.flatMap(hand => hand.warnings || []))];
        const handednessLabels = currentTarget === 'face'
          ? 'Face'
          : acceptedHands
            .map(hand => hand.handedness === 'Hand' ? 'Hand' : `${hand.handedness} Hand`)
            .join(', ');
        const uncertain = hasPredictedHands || acceptedHands.some(hand => hand.uncertain);
        setTrackingInfo({
          ...forearmInfo,
          status: uncertain
            ? 'Detection uncertain'
            : currentTarget === 'face'
              ? 'Tracking: Face'
              : acceptedHands.length === 1 ? `Tracking: ${handednessLabels}` : `Tracking: ${acceptedHands.length} hands`,
          statusType: uncertain ? 'uncertain' : 'tracking',
          predictedHands: predictedHandCount,
          trackedFingerNames: [...new Set(fingerPredictions.map(finger => finger.name))],
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
            ? faceOverlayOff ? 'Off' : layerRef.current === 'skeleton' ? 'Skull rendering' : 'Facial muscles rendering'
            : layerRef.current === 'skeleton' ? 'Rendering' : 'Muscle overlay',
          rejectionReason: null,
          lastValidMs: 0,
          rendererActive: !faceOverlayOff && (layerRef.current === 'skeleton' || layerRef.current === 'muscles'),
          canvasSize: `${canvas.width}x${canvas.height}`,
        });
      } else if (hasPredictedHands) {
        setTrackingInfo({
          ...forearmInfo,
          status: 'Estimated tracking',
          statusType: 'estimated',
          target: 'hand',
          predictedHands: predictedHandCount,
          trackedFingerNames: [...new Set(fingerPredictions.map(finger => finger.name))],
          acceptedHands: 0,
          acceptedTargets: 0,
          acceptedLandmarks: false,
          currentConfidence: 0,
          rawConfidence: rawDetectorConfidence,
          rawConfidenceAvailable,
          rendererActive: true,
          skeletonStatus: 'Estimated',
          lastValidMs: Math.max(...continuity.predictions.map(prediction => prediction.ageMs), ...fingerPredictions.map(finger => finger.ageMs)),
          warnings: [fingerPredictions.length
            ? 'Following a previously recognized finger using current camera detail.'
            : 'Following recent hand movement; move back slightly to restore live tracking.'],
        });
      } else if (canRenderGraceFrame) {
        const lastMeta = lastValidHandMetaRef.current;
        const handednessLabel = currentTarget === 'face'
          ? 'Face'
          : lastMeta?.handedness && lastMeta.handedness !== 'Hand'
          ? `${lastMeta.handedness} Hand`
          : 'Hand';
        const overlayLabel = currentTarget === 'face'
          ? layerRef.current === 'skeleton' ? 'skull overlay' : 'facial muscle overlay'
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
      owner.schedule(trackFrame);
    }

    trackFrame();
  }, []);

  const handleCameraReady = useCallback(() => {
    setCameraSwitching(false);
    startTracking();
  }, [startTracking]);

  const handleScan = useCallback(async () => {
    const lifecycle = lifecycleRef.current;
    const token = lifecycle.beginScan();
    clearTrackingDisplay();
    modelsReadyRef.current = false;
    cameraErrorRef.current = false;
    setState('loading');
    setError(null);
    try {
      await initTrackers(anatomyTargetRef.current);
      if (!lifecycle.isCurrentScan(token)) return;
      modelsReadyRef.current = true;
      setState('active');
      startTracking();
    } catch {
      if (!lifecycle.isCurrentScan(token)) return;
      lifecycle.cancelScan();
      clearTrackingDisplay();
      setError('Tracking could not start. Please try again.');
      setState('idle');
    }
  }, [startTracking, clearTrackingDisplay]);

  const handleCameraRetry = useCallback(() => {
    cameraErrorRef.current = false;
    setCameraError(false);
    setCameraErrorMessage(null);
    void handleScan();
  }, [handleScan]);

  const handleRescan = useCallback(() => {
    lifecycleRef.current.cancelScan();
    clearTrackingDisplay();
    setCameraSwitching(false);
    setState('idle');
  }, [clearTrackingDisplay]);

  const handleAnalyze = useCallback(() => {
    void cameraRef.current?.resumePlayback();
    const nextLayer = layerRef.current;
    setLayer(nextLayer);
    layerRef.current = nextLayer;
    if (state === 'active') startTracking();
  }, [startTracking, state]);

  const handleLayerChange = useCallback((nextLayer) => {
    if (!['skeleton', 'muscles'].includes(nextLayer)) return;
    setLayer(nextLayer);
    layerRef.current = nextLayer;
    boneHitTargetsRef.current = [];
    setHoveredBone(null);
    setPinnedBone(null);
    setTooltipPoint(null);

    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }, []);


  const handleAnatomyTargetChange = useCallback((nextTarget) => {
    // Full body and Face are coming soon; Hand + forearm is the available target.
    if (nextTarget !== 'hand' || nextTarget === anatomyTargetRef.current) return;
    handleRescan();
    setTrackingInfo(null);
    setTooltipPoint(null);
    anatomyTargetRef.current = nextTarget;
    setAnatomyTarget(nextTarget);
    const nextLayer = 'skeleton';
    layerRef.current = nextLayer;
    setLayer(nextLayer);
    if (nextTarget === 'face') {
      labelModeRef.current = 'clean';
      setLabelMode('clean');
    }
    muscleLabelModeRef.current = 'clean';
    setMuscleLabelMode('clean');
    // Pause the loop and show loading while the selected model initializes.
    // Hand startup never downloads the face model in the background.
    void handleScan();
  }, [handleRescan, handleScan]);

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
    if (pinnedBone || aligningElbowRef.current) return;
    const point = getCanvasPoint(event);
    if (!point) return;
    const hit = findAnatomyHit(point, boneHitTargetsRef.current);
    setHoveredBone(hit);
    setTooltipPoint(hit ? { x: event.clientX, y: event.clientY } : null);
  }, [getCanvasPoint, pinnedBone]);

  const handleCanvasClick = useCallback((event) => {
    const point = getCanvasPoint(event);
    if (!point) return;
    if (aligningElbowRef.current) {
      const now=performance.now();
      const candidates=forearmCandidatesRef.current.filter(candidate=>now-candidate.time<300)
        .sort((a,b)=>Math.hypot(point.x-a.hand[0].x*a.w,point.y-a.hand[0].y*a.h)
          -Math.hypot(point.x-b.hand[0].x*b.w,point.y-b.hand[0].y*b.h));
      for (const candidate of candidates) {
        if (forearmPlacementRef.current.setElbow(candidate.trackId,{x:point.x/candidate.w,y:point.y/candidate.h},
          candidate.hand,candidate.w,candidate.h,candidate.bounds,now)) {
          aligningElbowRef.current=false;
          setAligningElbow(false);
          setPinnedBone(null);setHoveredBone(null);setTooltipPoint(null);
          return;
        }
      }
      return;
    }
    const hit = findAnatomyHit(point, boneHitTargetsRef.current);
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
  const hasValidTarget = (trackingInfo?.acceptedTargets ?? trackingInfo?.acceptedHands ?? 0) > 0
    || (trackingInfo?.predictedHands ?? 0) > 0;
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
        <Camera ref={cameraRef} active={state !== 'idle'} onError={handleCameraError} onReleased={handleCameraReleased}
          facingMode={cameraFacing} onReady={handleCameraReady} filterClass={filterClass} />
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
          role="tooltip"
          aria-label={`${activeBoneInfo.name} details`}
          style={{
            left: Math.min(window.innerWidth - 238, Math.max(12, tooltipPoint.x + 14)),
            top: Math.max(12,Math.min(window.innerHeight - 230, tooltipPoint.y + 14)),
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

      {cameraError && <ErrorFallback type="camera" message={cameraErrorMessage} onRetry={handleCameraRetry} />}
      {cameraError && <CameraSwitch facingMode={cameraFacing} onSwitch={handleCameraSwitch} idle />}
      {error && <ErrorFallback type="tracker-error" message={error} onRetry={handleScan} />}

      <ScanOverlay state={state} />

      {isActive && anatomyTarget === 'hand' && layer === 'skeleton' && wristMode === 'detailed'
        && hasValidTarget && !(trackingInfo?.trackedFingerNames?.length) && <WristLegend />}

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

      {isActive && anatomyTarget === 'hand' && (aligningElbow || (trackingInfo?.alignableHands ?? 0) > 0) && (
        <ForearmControls aligning={aligningElbow}
          hasManual={(trackingInfo?.manualForearms ?? 0)+(trackingInfo?.pinnedForearms ?? 0)>0}
          onAlign={() => {aligningElbowRef.current=true;setAligningElbow(true);setPinnedBone(null);setHoveredBone(null);}}
          onCancel={() => {aligningElbowRef.current=false;setAligningElbow(false);}}
          onAuto={() => forearmPlacementRef.current.clearManual()}
        />
      )}

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
          onMuscleLabelModeChange={next => {setMuscleLabelMode(next);setPinnedBone(null);setHoveredBone(null);boneHitTargetsRef.current=[];}}
          muscleSide={muscleSide}
          onMuscleSideChange={next => {setMuscleSide(next);setPinnedBone(null);setHoveredBone(null);boneHitTargetsRef.current=[];}}
          cameraFacing={cameraFacing}
          onCameraSwitch={handleCameraSwitch}
          cameraSwitching={cameraSwitching}
        />
      )}
    </div>
  );
}

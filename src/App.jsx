import { useState, useRef, useCallback, useEffect } from 'react';
import Camera from './components/Camera';
import ScanOverlay from './components/ScanOverlay';
import HUD from './components/HUD';
import ScanButton from './components/ScanButton';
import Settings from './components/Settings';
import ErrorFallback from './components/ErrorFallback';
import LayerToggle from './components/LayerToggle';
import AnatomyOverlay from './components/AnatomyOverlay';
import Labels from './components/Labels';
import { initTrackers, detectHands } from './services/handTracker';
import { drawHandMuscles, drawHandSkeleton } from './services/anatomyRenderer';
import { identifyBodyPart, analyzeAnatomy } from './services/ai';

// States: idle | loading | active
export default function App() {
  const [state, setState] = useState('idle');
  const [layer, setLayer] = useState('muscles');
  const [error, setError] = useState(null);
  const [cameraError, setCameraError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detectedParts, setDetectedParts] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  const cameraRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const layerRef = useRef('muscles');

  useEffect(() => { layerRef.current = layer; }, [layer]);

  const handleCameraError = useCallback(() => setCameraError(true), []);

  const startTracking = useCallback(() => {
    const video = cameraRef.current?.getVideoElement();
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    let lastTimestamp = 0;

    function trackFrame() {
      if (!video.videoWidth) {
        animFrameRef.current = requestAnimationFrame(trackFrame);
        return;
      }

      // Render at viewport dimensions so the overlay aligns with the CSS-displayed
      // video (object-fit:cover). Raw videoWidth/videoHeight would stretch the canvas.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = performance.now();
      // Throttle to ~30fps to avoid MediaPipe timestamp issues
      if (now - lastTimestamp < 33) {
        animFrameRef.current = requestAnimationFrame(trackFrame);
        return;
      }
      lastTimestamp = now;

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

      const parts = [];

      const handResult = detectHands(video, now);
      if (handResult?.landmarks?.length > 0) {
        parts.push(`${handResult.landmarks.length} hand${handResult.landmarks.length > 1 ? 's' : ''}`);
        handResult.landmarks.forEach(landmarks => {
          if (layerRef.current === 'skeleton') {
            drawHandSkeleton(ctx, landmarks, drawW, drawH);
          } else {
            drawHandMuscles(ctx, landmarks, drawW, drawH);
          }
        });
      }

      ctx.restore();

      setDetectedParts(parts);
      animFrameRef.current = requestAnimationFrame(trackFrame);
    }

    trackFrame();
  }, []);

  const handleScan = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      await initTrackers();
      setState('active');
      setTimeout(() => startTracking(), 100);
    } catch (err) {
      setError('Failed to load tracking models: ' + err.message);
      setState('idle');
    }
  }, [startTracking]);

  const handleRescan = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setDetectedParts([]);
    setAnalysisData(null);
    setAnalysisError(null);
    setIsAnalyzing(false);
    setState('idle');
  }, []);

  const handleAnalyze = useCallback(async (currentLayer) => {
    const apiKey = localStorage.getItem('ar_scanner_api_key');
    if (!apiKey) {
      setAnalysisError('API key required — open Settings to enter it.');
      return;
    }

    const frame = cameraRef.current?.captureVisible();
    if (!frame) return;

    setIsAnalyzing(true);
    setAnalysisData(null);
    setAnalysisError(null);

    try {
      const { bodyPart } = await identifyBodyPart(frame, apiKey);
      const result = await analyzeAnatomy(frame, apiKey, bodyPart, currentLayer);
      setAnalysisData(result);
    } catch (err) {
      setAnalysisError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // When layer changes while analysis is showing, re-run with the new layer
  const handleLayerChange = useCallback((newLayer) => {
    setLayer(newLayer);
    if (analysisData && !isAnalyzing) {
      const apiKey = localStorage.getItem('ar_scanner_api_key');
      if (!apiKey) return;
      const frame = cameraRef.current?.captureVisible();
      if (!frame) return;

      setIsAnalyzing(true);
      setAnalysisData(null);
      analyzeAnatomy(frame, apiKey, analysisData.object, newLayer)
        .then(result => setAnalysisData(result))
        .catch(err => setAnalysisError(err.message))
        .finally(() => setIsAnalyzing(false));
    }
  }, [analysisData, isAnalyzing]);

  const isActive = state === 'active';
  const filterClass = isActive ? (layer === 'skeleton' ? 'filter-skeleton' : 'filter-muscles') : '';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: '#000' }}>
      {!cameraError && (
        <Camera ref={cameraRef} active={true} onError={handleCameraError} filterClass={filterClass} />
      )}

      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        zIndex: 35, pointerEvents: 'none', display: isActive ? 'block' : 'none',
      }} />

      {isActive && (
        <AnatomyOverlay
          parts={analysisData?.parts}
          layer={layer}
          visible={!!analysisData && !isAnalyzing}
        />
      )}

      {isActive && (
        <Labels
          parts={analysisData?.parts}
          layer={layer}
          visible={!!analysisData && !isAnalyzing}
        />
      )}

      {cameraError && <ErrorFallback type="camera" />}
      {error && <ErrorFallback type="ai-error" message={error} onRetry={handleRescan} />}

      <ScanOverlay state={state} />

      <HUD
        state={state}
        layer={layer}
        detectedParts={detectedParts}
        isAnalyzing={isAnalyzing}
        analysisData={analysisData}
        analysisError={analysisError}
      />

      {isActive && (
        <LayerToggle activeLayer={layer} onLayerChange={handleLayerChange} disabled={false} />
      )}

      <ScanButton
        state={state}
        onScan={handleScan}
        onRescan={handleRescan}
        onAnalyze={() => handleAnalyze(layer)}
        isAnalyzing={isAnalyzing}
      />

      <button className="settings-btn" onClick={() => setSettingsOpen(true)} id="settings-button">⚙</button>
      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

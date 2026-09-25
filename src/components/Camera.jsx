import { useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { playCameraVideo } from '../services/cameraPlayback';
import { createCameraSession } from '../services/cameraSession';

const Camera = forwardRef(function Camera({ active, onError, onReady, onReleased, facingMode='environment', filterClass }, ref) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const sessionRef = useRef(null);
    const [hasPermission, setHasPermission] = useState(null);
    const [needsPlayback, setNeedsPlayback] = useState(false);

    const resumePlayback = useCallback(async () => {
        const video = videoRef.current;
        if (!video?.srcObject) return;
        const stream = video.srcObject;
        const playing = await playCameraVideo(video);
        if (video === videoRef.current && streamRef.current === stream) {
            setNeedsPlayback(!playing);
        }
    }, []);

    useImperativeHandle(ref, () => ({
        getVideoElement: () => videoRef.current,
        resumePlayback,
    }));

    useEffect(() => {
        if (!active) return;
        const video = videoRef.current;
        let clearStreamListeners = () => {};
        const session = createCameraSession({
            facingMode,
            getUserMedia: constraints => navigator.mediaDevices.getUserMedia(constraints),
            onStream: stream => {
                clearStreamListeners();
                streamRef.current = stream;
                if (video) video.srcObject = stream;
                if (!stream) {
                    video?.pause();
                    onReleased?.();
                    return;
                }
                setHasPermission(true);
                setNeedsPlayback(false);
                onReady?.();
                const interrupted = () => {
                    setNeedsPlayback(true);
                };
                const tracks = stream.getVideoTracks();
                tracks.forEach(track => {
                    track.addEventListener('ended', interrupted);
                    track.addEventListener('mute', interrupted);
                    track.addEventListener('unmute', resumePlayback);
                });
                // play() can succeed without the camera delivering any frames.
                let lastTime = video?.currentTime;
                let stalledAt = Date.now();
                const watchdog = window.setInterval(() => {
                    if (video && video.readyState >= 2 && video.currentTime !== lastTime) {
                        lastTime = video.currentTime;
                        stalledAt = Date.now();
                    } else if (Date.now() - stalledAt >= 8000) {
                        session.setActive(false);
                        setNeedsPlayback(true);
                    }
                }, 1000);
                clearStreamListeners = () => {
                    window.clearInterval(watchdog);
                    tracks.forEach(track => {
                        track.removeEventListener('ended', interrupted);
                        track.removeEventListener('mute', interrupted);
                        track.removeEventListener('unmute', resumePlayback);
                    });
                };
                void resumePlayback();
            },
            onError: err => {
                setHasPermission(false);
                if (onError) onError(err);
            },
        });
        sessionRef.current = session;
        const updateVisibility = () => {
            void session.setActive(document.visibilityState === 'visible');
        };
        const hide = () => session.setActive(false);
        document.addEventListener('visibilitychange', updateVisibility);
        window.addEventListener('pagehide', hide);
        window.addEventListener('pageshow', updateVisibility);
        updateVisibility();

        return () => {
            document.removeEventListener('visibilitychange', updateVisibility);
            window.removeEventListener('pagehide', hide);
            window.removeEventListener('pageshow', updateVisibility);
            clearStreamListeners();
            session.dispose();
            sessionRef.current = null;
        };
    }, [active, onError, onReady, onReleased, facingMode, resumePlayback]);

    if (hasPermission === false) return null;

    return (
        <>
        <div className={`camera-container ${filterClass || ''}`}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                controls={false}
                disablePictureInPicture
                style={{ pointerEvents: 'none' }}
                onLoadedMetadata={resumePlayback}
                onPlaying={() => setNeedsPlayback(false)}
                onPause={() => {
                    if (active && streamRef.current) setNeedsPlayback(true);
                }}
            />
        </div>
        {active && needsPlayback && (
            <button className="camera-resume" onClick={() => {
                if (document.visibilityState !== 'visible') return;
                setNeedsPlayback(false);
                const session = sessionRef.current;
                session?.setActive(false);
                void session?.setActive(true);
            }}>
                Restart camera
            </button>
        )}
        </>
    );
});

export default Camera;

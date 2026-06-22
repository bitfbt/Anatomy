import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';

const Camera = forwardRef(function Camera({ active, onError, filterClass }, ref) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const canvasRef = useRef(null);
    const [hasPermission, setHasPermission] = useState(null);

    useImperativeHandle(ref, () => ({
        // Raw capture — full video frame (for internal use)
        capture: () => {
            const video = videoRef.current;
            if (!video) return null;
            let canvas = canvasRef.current;
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvasRef.current = canvas;
            }
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            return canvas.toDataURL('image/jpeg', 0.85);
        },
        // Visible capture — crops to what the user actually sees (object-fit: cover)
        // Claude's returned % coordinates will then map directly to the SVG overlay
        captureVisible: () => {
            const video = videoRef.current;
            if (!video || !video.videoWidth) return null;

            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const cw = window.innerWidth;
            const ch = window.innerHeight;

            const videoAR = vw / vh;
            const containerAR = cw / ch;

            let sx, sy, sw, sh;
            if (videoAR > containerAR) {
                // Video wider than viewport — crop left/right
                sh = vh;
                sw = vh * containerAR;
                sx = (vw - sw) / 2;
                sy = 0;
            } else {
                // Video taller than viewport — crop top/bottom
                sw = vw;
                sh = vw / containerAR;
                sx = 0;
                sy = (vh - sh) / 2;
            }

            const canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
            return canvas.toDataURL('image/jpeg', 0.85);
        },
        getVideoElement: () => videoRef.current,
    }));

    useEffect(() => {
        if (!active) return;
        let cancelled = false;

        async function startCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });

                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setHasPermission(true);
            } catch (err) {
                console.error('Camera error:', err);
                setHasPermission(false);
                if (onError) onError(err);
            }
        }

        startCamera();

        return () => {
            cancelled = true;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
        };
    }, [active, onError]);

    if (hasPermission === false) return null;

    return (
        <div className={`camera-container ${filterClass || ''}`}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
            />
        </div>
    );
});

export default Camera;

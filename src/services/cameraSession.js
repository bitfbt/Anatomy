// Serialize capture requests, including across React effect cleanup/remounts.
// getUserMedia cannot be cancelled while the permission/device request is pending.
let captureQueue = Promise.resolve();

export function createCameraSession({ getUserMedia, onStream, onError, facingMode = 'environment' }) {
    let enabled = false;
    let disposed = false;
    let generation = 0;
    let stream = null;
    let pending = null;

    function release() {
        generation += 1;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            onStream(null);
        }
    }

    function start() {
        if (disposed || !enabled || stream || pending) return pending;
        const requestedGeneration = generation;
        const isCurrent = () => !disposed && enabled && generation === requestedGeneration;
        const request = captureQueue.then(async () => {
            if (!isCurrent()) return;
            const acquired = await getUserMedia({
                video: {
                    facingMode: { ideal: facingMode === 'user' ? 'user' : 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30, max: 30 },
                },
                audio: false,
            });
            if (!isCurrent()) {
                acquired.getTracks().forEach(track => track.stop());
                return;
            }
            stream = acquired;
            onStream(acquired);
        });
        captureQueue = request.catch(() => {});
        pending = request.catch(error => {
            if (isCurrent()) onError(error);
        }).finally(() => {
            pending = null;
            // The app may have returned while an obsolete request was pending.
            if (generation !== requestedGeneration) void start();
        });
        return pending;
    }

    return {
        setActive(active) {
            if (disposed) return;
            enabled = active;
            if (!active) release();
            else return start();
        },
        dispose() {
            enabled = false;
            disposed = true;
            release();
        },
    };
}

// iOS may leave a camera video paused even when getUserMedia succeeds.
// Call this directly from a user gesture as well as when metadata arrives.
export async function playCameraVideo(video) {
    if (!video?.srcObject) return false;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    try {
        await video.play();
        return !video.paused;
    } catch {
        // Permission to capture and permission to play are separate. Keep the
        // stream so a subsequent tap can resume it without another permission.
        return false;
    }
}

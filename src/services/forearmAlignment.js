// Smooth the measured elbow-to-wrist vector, then attach it to exactly the
// wrist used by the hand renderer. Independent world-position filters can lag
// by different amounts when the whole arm moves, opening a visible seam.
export function alignForearmToHand(match, renderedHand, smoother, trackId, timestamp) {
    if (!match || !renderedHand?.[0]) return null;
    const wrist = renderedHand[0];
    // A user-selected or image-tracked point is already in camera coordinates.
    // Bending the hand must not translate that explicitly placed elbow.
    if (match.source?.startsWith('manual-')) return {...match,wrist};
    const offset = {x:match.elbow.x-match.wrist.x, y:match.elbow.y-match.wrist.y, z:0};
    const [aligned] = smoother.smooth(trackId, [offset], timestamp);
    return {...match, wrist, elbow:{...match.elbow, x:wrist.x+aligned.x, y:wrist.y+aligned.y}};
}

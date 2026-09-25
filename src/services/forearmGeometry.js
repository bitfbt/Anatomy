const dot = (a, b) => a.x * b.x + a.y * b.y;
const unit = vector => {
    const length = Math.hypot(vector.x, vector.y);
    return length > .001 ? {x: vector.x / length, y: vector.y / length} : null;
};
const between = (a, b) => ({x: b.x - a.x, y: b.y - a.y});

// Both surfaces end at the very same displayed hand landmark. Only the distal
// cross-section turns with the palm; rotating the whole forearm with the hand
// would pull its proximal end off the observed elbow when the wrist bends.
export function createForearmGeometry(hand, match, w, h, {layer = 'skeleton'} = {}) {
    if (!match || ![w, h, match.elbow?.x, match.elbow?.y,
        ...[0, 2, 5, 9, 13, 17].flatMap(index => [hand?.[index]?.x, hand?.[index]?.y])].every(Number.isFinite)
        || w <= 0 || h <= 0) return null;
    const point = index => ({x: hand[index].x * w, y: hand[index].y * h});
    const wrist = point(0), elbow = {x: match.elbow.x * w, y: match.elbow.y * h};
    const segment = between(elbow, wrist);
    const length = Math.hypot(segment.x, segment.y);
    if (length < 15) return null;
    const forward = {x: segment.x / length, y: segment.y / length};
    const index = point(5), middle = point(9), ring = point(13), pinky = point(17);
    const span = Math.hypot(pinky.x - index.x, pinky.y - index.y);
    const width = Math.min(length * .26, span * .70);
    if (width < 1) return null;
    const palmCenter = {x: (index.x + middle.x + ring.x + pinky.x) / 4,
        y: (index.y + middle.y + ring.y + pinky.y) / 4};
    const handDistal = unit(between(wrist, middle)) || unit(between(wrist, palmCenter)) || forward;
    const rawRadial = unit(between(pinky, index));
    let wristRadial;
    if (layer === 'muscles') {
        // The tissue heel in drawHandMuscles uses this exact MCP lateral axis.
        wristRadial = rawRadial;
    } else {
        // Match the orthogonal wrist frame used by createCarpalLayout.
        wristRadial = {x: -handDistal.y, y: handDistal.x};
        if (dot(wristRadial, rawRadial) < 0) wristRadial = {x: -wristRadial.x, y: -wristRadial.y};
    }
    let proximalRadial = {x: -forward.y, y: forward.x};
    if (dot(proximalRadial, wristRadial) < 0) proximalRadial = {x: -proximalRadial.x, y: -proximalRadial.y};
    const angle = Math.atan2(proximalRadial.x * wristRadial.y - proximalRadial.y * wristRadial.x,
        dot(proximalRadial, wristRadial));
    const radialAt = t => {
        const amount = Math.max(0, Math.min(1, (t - .70) / .30));
        const smooth = amount * amount * (3 - 2 * amount);
        const cosine = Math.cos(angle * smooth), sine = Math.sin(angle * smooth);
        return {x: proximalRadial.x * cosine - proximalRadial.y * sine,
            y: proximalRadial.x * sine + proximalRadial.y * cosine};
    };
    // The atlas has a short tendon continuation beyond its wrist. Let it enter
    // the existing palm heel, capped in pixels and by visible hand/arm scale.
    const overlap = layer === 'muscles' ? Math.min(12, span * .065, length * .035) : 0;
    const at = (t, offset = 0) => {
        const axis = radialAt(t);
        const continuation = Math.max(0, Math.min(overlap, (t - 1) * length));
        const clamped = Math.max(0, Math.min(1, t));
        return {x: elbow.x + segment.x * clamped + handDistal.x * continuation + axis.x * offset,
            y: elbow.y + segment.y * clamped + handDistal.y * continuation + axis.y * offset};
    };
    const clipPolygon = [];
    const end = 1 + overlap / length;
    for (let i = 0; i <= 20; i++) clipPolygon.push(at(end * i / 20, width * 1.2));
    for (let i = 20; i >= 0; i--) clipPolygon.push(at(end * i / 20, -width * 1.2));
    return {elbow, wrist, length, width, forward, handDistal, wristRadial, proximalRadial,
        radialAt, at, overlap, clipPolygon, project: (x, y) => at(y, x * width)};
}

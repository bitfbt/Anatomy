const FACE_CONTOUR = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
    234, 127, 162, 21, 54, 103, 67, 109];
const LEFT_EYE_RING = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const RIGHT_EYE_RING = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
const OUTER_MOUTH_RING = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
    375, 321, 405, 314, 17, 84, 181, 91, 146];
const LEFT_BROW = [70, 63, 105, 66, 107];
const RIGHT_BROW = [336, 296, 334, 293, 300];

// This dataset maps visible skin landmarks to an estimated educational
// projection. It does not detect muscles through skin and is not a medical
// model. Each entry owns its anatomy name, side, source landmarks, geometry
// class, fiber direction, opacity, label priority, and visibility policy.
export const FACE_MUSCLE_DEFINITIONS = [
    definition('frontalis-left', 'Frontalis', 'left', 'forehead', 'fan', 'frontalis',
        [10, 109, 67, 103, ...LEFT_BROW, 9], 'vertical', 0.55, 1, ['simple', 'detailed']),
    definition('frontalis-right', 'Frontalis', 'right', 'forehead', 'fan', 'frontalis',
        [10, 338, 297, 332, ...RIGHT_BROW, 9], 'vertical', 0.55, 1, ['simple', 'detailed']),
    definition('corrugator-left', 'Corrugator supercilii', 'left', 'forehead', 'ribbon', 'corrugator',
        [107, 66, 105], 'oblique', 0.50, 8),
    definition('corrugator-right', 'Corrugator supercilii', 'right', 'forehead', 'ribbon', 'corrugator',
        [336, 296, 334], 'oblique', 0.50, 8),
    definition('depressor-supercilii-left', 'Depressor supercilii', 'left', 'forehead', 'ribbon', 'depressor-supercilii',
        [107, 55, 6], 'downward', 0.44, 16),
    definition('depressor-supercilii-right', 'Depressor supercilii', 'right', 'forehead', 'ribbon', 'depressor-supercilii',
        [336, 285, 6], 'downward', 0.44, 16),
    definition('procerus', 'Procerus', 'center', 'nose', 'ribbon', 'procerus',
        [9, 6, 168], 'vertical', 0.48, 12),
    definition('temporalis-left', 'Temporalis', 'left', 'jaw', 'fan', 'temporalis',
        [109, 67, 103, 54, 21, 162, 127], 'fan', 0.42, 14),
    definition('temporalis-right', 'Temporalis', 'right', 'jaw', 'fan', 'temporalis',
        [338, 297, 332, 284, 251, 389, 356], 'fan', 0.42, 14),

    definition('orbicularis-oculi-left', 'Orbicularis oculi', 'left', 'eyes', 'ring', 'eye-ring',
        LEFT_EYE_RING, 'circular', 0.52, 2, ['simple', 'detailed']),
    definition('orbicularis-oculi-right', 'Orbicularis oculi', 'right', 'eyes', 'ring', 'eye-ring',
        RIGHT_EYE_RING, 'circular', 0.52, 2, ['simple', 'detailed']),

    definition('nasalis', 'Nasalis', 'center', 'nose', 'sheet', 'nasalis',
        [129, 98, 2, 327, 358, 1], 'horizontal', 0.49, 4, ['simple', 'detailed']),
    definition('levator-alaeque-left', 'Levator labii superioris alaeque nasi', 'left', 'cheeks', 'ribbon', 'levator-alaeque',
        [122, 98, 37], 'downward', 0.50, 10),
    definition('levator-alaeque-right', 'Levator labii superioris alaeque nasi', 'right', 'cheeks', 'ribbon', 'levator-alaeque',
        [351, 327, 267], 'downward', 0.50, 10),
    definition('levator-labii-left', 'Levator labii superioris', 'left', 'cheeks', 'ribbon', 'levator-labii',
        [116, 205, 39], 'downward', 0.51, 9),
    definition('levator-labii-right', 'Levator labii superioris', 'right', 'cheeks', 'ribbon', 'levator-labii',
        [345, 425, 269], 'downward', 0.51, 9),
    definition('zygomaticus-minor-left', 'Zygomaticus minor', 'left', 'cheeks', 'ribbon', 'zygomaticus-minor',
        [111, 117, 39], 'diagonal', 0.50, 11),
    definition('zygomaticus-minor-right', 'Zygomaticus minor', 'right', 'cheeks', 'ribbon', 'zygomaticus-minor',
        [340, 346, 269], 'diagonal', 0.50, 11),
    definition('zygomaticus-major-left', 'Zygomaticus major', 'left', 'cheeks', 'ribbon', 'zygomaticus-major',
        [116, 123, 61], 'diagonal', 0.56, 5, ['simple', 'detailed']),
    definition('zygomaticus-major-right', 'Zygomaticus major', 'right', 'cheeks', 'ribbon', 'zygomaticus-major',
        [345, 352, 291], 'diagonal', 0.56, 5, ['simple', 'detailed']),
    definition('risorius-left', 'Risorius', 'left', 'cheeks', 'ribbon', 'risorius',
        [234, 147, 61], 'horizontal', 0.44, 13),
    definition('risorius-right', 'Risorius', 'right', 'cheeks', 'ribbon', 'risorius',
        [454, 376, 291], 'horizontal', 0.44, 13),

    definition('orbicularis-oris', 'Orbicularis oris', 'center', 'mouth', 'ring', 'mouth-ring',
        OUTER_MOUTH_RING, 'circular', 0.58, 3, ['simple', 'detailed']),
    definition('depressor-anguli-left', 'Depressor anguli oris', 'left', 'mouth', 'triangle', 'depressor-anguli',
        [61, 91, 201], 'downward', 0.51, 7),
    definition('depressor-anguli-right', 'Depressor anguli oris', 'right', 'mouth', 'triangle', 'depressor-anguli',
        [291, 321, 421], 'downward', 0.51, 7),
    definition('depressor-labii-left', 'Depressor labii inferioris', 'left', 'mouth', 'ribbon', 'depressor-labii',
        [84, 201, 18], 'downward', 0.48, 15),
    definition('depressor-labii-right', 'Depressor labii inferioris', 'right', 'mouth', 'ribbon', 'depressor-labii',
        [314, 421, 18], 'downward', 0.48, 15),
    definition('mentalis-left', 'Mentalis', 'left', 'mouth', 'fan', 'mentalis',
        [84, 201, 18], 'vertical', 0.52, 6),
    definition('mentalis-right', 'Mentalis', 'right', 'mouth', 'fan', 'mentalis',
        [314, 421, 18], 'vertical', 0.52, 6),
    definition('masseter-left', 'Masseter', 'left', 'jaw', 'sheet', 'masseter',
        [127, 234, 93, 132, 58, 172, 136], 'vertical', 0.56, 4, ['simple', 'detailed']),
    definition('masseter-right', 'Masseter', 'right', 'jaw', 'sheet', 'masseter',
        [356, 454, 323, 361, 288, 397, 365], 'vertical', 0.56, 4, ['simple', 'detailed']),
    {
        ...definition('platysma', 'Platysma', 'center', 'jaw', 'sheet', 'platysma',
            [172, 152, 397], 'downward', 0.28, 18),
        visibility: { requiresNeck: true, maximumYaw: 0.34 },
        clipRegion: 'neck',
    },
];

const SIMPLE_GROUPS = [
    { id: 'forehead', displayName: 'Forehead', priority: 1 },
    { id: 'eyes', displayName: 'Eyes', priority: 2 },
    { id: 'nose', displayName: 'Nose', priority: 3 },
    { id: 'cheeks', displayName: 'Cheeks', priority: 4 },
    { id: 'mouth', displayName: 'Mouth', priority: 5 },
    { id: 'jaw', displayName: 'Jaw', priority: 6 },
];

function definition(id, displayName, side, group, muscleType, geometryKey, landmarkAnchors,
    fiberDirection, baseOpacity, labelPriority, modes = ['detailed']) {
    return {
        id,
        displayName,
        side,
        group,
        muscleType,
        geometryKey,
        landmarkAnchors,
        controlPoints: [...landmarkAnchors],
        fiberDirection,
        baseOpacity,
        labelAnchor: landmarkAnchors[Math.floor(landmarkAnchors.length / 2)],
        labelPriority,
        modes,
        visibility: { maximumYaw: 0.48 },
        clipRegion: 'face',
    };
}

export function createFaceMuscleModel(landmarks, width, height, options = {}) {
    if (!Array.isArray(landmarks) || landmarks.length < 468 || options.mode === 'off') {
        return { muscles: [], labels: [], frame: null, mode: options.mode || 'off' };
    }

    const mode = options.mode === 'detailed' ? 'detailed' : 'simple';
    const frame = extractFaceFrame(landmarks, width, height, options.visibleBounds);
    const qualityOpacity = clamp(
        (Number.isFinite(options.confidence) ? 0.76 + options.confidence * 0.24 : 0.94)
            * (options.isUncertain ? 0.76 : 1),
        0.54,
        1,
    );
    const muscles = FACE_MUSCLE_DEFINITIONS
        .filter(item => item.modes.includes(mode))
        .filter(item => isDefinitionVisible(item, frame))
        .map(item => buildMuscleGeometry(item, frame, qualityOpacity))
        .filter(Boolean);

    return {
        muscles,
        labels: createFaceMuscleLabels(muscles, mode, frame),
        frame,
        mode,
    };
}

export function createFaceMuscleLabels(muscles, mode, frame) {
    if (!frame || !muscles.length) return [];
    if (mode === 'simple') {
        return SIMPLE_GROUPS.map(group => {
            const members = muscles.filter(muscle => muscle.group === group.id);
            if (!members.length) return null;
            return {
                text: group.displayName,
                point: average(members.map(muscle => muscle.labelAnchor)),
                priority: group.priority,
            };
        }).filter(Boolean);
    }

    const strongestByName = new Map();
    muscles.forEach(muscle => {
        const current = strongestByName.get(muscle.displayName);
        if (!current || muscle.opacity > current.opacity) strongestByName.set(muscle.displayName, muscle);
    });
    return [...strongestByName.values()]
        .sort((a, b) => a.labelPriority - b.labelPriority)
        .map(muscle => ({
            text: muscle.displayName,
            point: muscle.labelAnchor,
            priority: muscle.labelPriority,
            preferredSide: muscle.labelAnchor.x < frame.center.x ? -1 : 1,
        }));
}

function extractFaceFrame(landmarks, width, height, visibleBounds) {
    const point = index => ({
        x: landmarks[index].x * width,
        y: landmarks[index].y * height,
        z: (landmarks[index].z || 0) * width,
    });
    const points = indices => indices.map(point);
    const leftEye = points(LEFT_EYE_RING);
    const rightEye = points(RIGHT_EYE_RING);
    const leftEyeCenter = average(leftEye);
    const rightEyeCenter = average(rightEye);
    const eyeCenter = midpoint(leftEyeCenter, rightEyeCenter);
    const horizontalAxis = normalize({
        x: rightEyeCenter.x - leftEyeCenter.x,
        y: rightEyeCenter.y - leftEyeCenter.y,
    }, { x: 1, y: 0 });
    let verticalAxis = { x: -horizontalAxis.y, y: horizontalAxis.x };
    const foreheadTop = point(10);
    const chin = point(152);
    const foreheadToChin = { x: chin.x - foreheadTop.x, y: chin.y - foreheadTop.y };
    if (dot(verticalAxis, foreheadToChin) < 0) verticalAxis = scaleVector(verticalAxis, -1);
    const leftTemple = point(234);
    const rightTemple = point(454);
    const faceWidth = Math.max(40, distance(leftTemple, rightTemple));
    const faceHeight = Math.max(60, distance(foreheadTop, chin));
    const center = midpoint(leftTemple, rightTemple);
    const nose = point(1);
    const eyeDistance = Math.max(1, distance(leftEyeCenter, rightEyeCenter));
    const yaw = clamp(dot(subtract(nose, eyeCenter), horizontalAxis) / eyeDistance, -0.58, 0.58);
    const leftSpan = Math.max(1, Math.abs(dot(subtract(nose, leftTemple), horizontalAxis)));
    const rightSpan = Math.max(1, Math.abs(dot(subtract(rightTemple, nose), horizontalAxis)));
    const maxSpan = Math.max(leftSpan, rightSpan);
    const sideVisibility = {
        left: clamp(0.46 + 0.54 * (leftSpan / maxSpan), 0.46, 1),
        right: clamp(0.46 + 0.54 * (rightSpan / maxSpan), 0.46, 1),
    };
    const bounds = visibleBounds || { left: 0, top: 0, right: width, bottom: height };
    const neckDepth = bounds.bottom - chin.y;

    return {
        point,
        points,
        width,
        height,
        bounds,
        faceWidth,
        faceHeight,
        scale: clamp((faceWidth + faceHeight * 0.72) / 430, 0.55, 2.2),
        center,
        foreheadTop,
        chin,
        nose,
        horizontalAxis,
        verticalAxis,
        yaw,
        yawMagnitude: Math.abs(yaw),
        sideVisibility,
        neckVisible: neckDepth > faceHeight * 0.24,
        faceContour: points(FACE_CONTOUR),
        leftEye,
        rightEye,
        mouthRing: points(OUTER_MOUTH_RING),
        leftBrow: points(LEFT_BROW),
        rightBrow: points(RIGHT_BROW),
    };
}

function isDefinitionVisible(item, frame) {
    if (item.visibility?.requiresNeck && !frame.neckVisible) return false;
    if (item.visibility?.maximumYaw && frame.yawMagnitude > item.visibility.maximumYaw) return false;
    return true;
}

function buildMuscleGeometry(item, frame, qualityOpacity) {
    const geometry = geometryFor(item, frame);
    if (!geometry) return null;
    const screenSide = geometry.labelAnchor.x < frame.center.x ? 'left' : 'right';
    const sideOpacity = item.side === 'center' ? 1 : frame.sideVisibility[screenSide];
    const opacity = clamp(item.baseOpacity * qualityOpacity * sideOpacity, 0.18, 0.62);
    return {
        ...item,
        ...geometry,
        opacity,
        hitRadius: geometry.hitRadius || frame.faceWidth * 0.045,
        explanation: `${item.displayName} is positioned from visible face landmarks as an approximate educational overlay.`,
    };
}

function geometryFor(item, frame) {
    switch (item.geometryKey) {
        case 'frontalis': return frontalisGeometry(item, frame);
        case 'temporalis': return temporalisGeometry(item, frame);
        case 'eye-ring': return ringGeometry(item, frame, item.side === 'left' ? frame.leftEye : frame.rightEye, 1.44, 1.62, 1.08, 1.10);
        case 'mouth-ring': return ringGeometry(item, frame, frame.mouthRing, 1.06, 1.13, 0.92, 0.79);
        case 'nasalis': return nasalisGeometry(item, frame);
        case 'masseter': return masseterGeometry(item, frame);
        case 'depressor-anguli': return depressorAnguliGeometry(item, frame);
        case 'mentalis': return mentalisGeometry(item, frame);
        case 'platysma': return platysmaGeometry(item, frame);
        default: return ribbonGeometry(item, frame);
    }
}

function frontalisGeometry(item, frame) {
    const isLeft = item.side === 'left';
    const brow = isLeft ? frame.leftBrow : frame.rightBrow;
    const browCenter = average(brow);
    const oppositeBrow = average(isLeft ? frame.rightBrow : frame.leftBrow);
    const browCenterAll = midpoint(browCenter, oppositeBrow);
    const upperCenter = mix(frame.foreheadTop, browCenterAll, 0.20);
    const sideUpper = mix(upperCenter, browCenter, 0.10);
    const upperIndices = isLeft ? [109, 67, 103] : [338, 297, 332];
    const lower = (isLeft ? brow : [...brow].reverse()).map(value => mix(value, sideUpper, 0.22));
    const points = [
        sideUpper,
        ...frame.points(upperIndices).map(value => mix(value, browCenter, 0.24)),
        ...lower,
        mix(frame.point(9), sideUpper, 0.30),
    ];
    return patchGeometry(points, average(points), average(points.slice(0, 4)), browCenter, frame.faceWidth * 0.065);
}

function temporalisGeometry(item, frame) {
    const points = frame.points(item.landmarkAnchors).map((value, index) => (
        index < 3 ? mix(value, frame.center, 0.06) : value
    ));
    const upper = average(points.slice(0, 3));
    const lower = points[points.length - 1];
    return patchGeometry(points, average(points), upper, lower, frame.faceWidth * 0.07);
}

function nasalisGeometry(item, frame) {
    const left = frame.point(129);
    const right = frame.point(358);
    const bridge = mix(frame.point(6), frame.point(1), 0.46);
    const lower = frame.point(2);
    const points = [mix(left, bridge, 0.16), bridge, mix(right, bridge, 0.16), right, lower, left];
    return patchGeometry(points, frame.point(1), left, right, frame.faceWidth * 0.045);
}

function masseterGeometry(item, frame) {
    const leftSide = item.side === 'left';
    const topOuter = mix(frame.point(leftSide ? 234 : 454), frame.point(leftSide ? 127 : 356), 0.22);
    const topInner = mix(topOuter, frame.center, 0.14);
    const bottomOuter = average(frame.points(leftSide ? [172, 136] : [397, 365]));
    const bottomInner = mix(bottomOuter, frame.center, 0.15);
    const points = [topOuter, topInner, bottomInner, bottomOuter];
    return patchGeometry(points, average(points), midpoint(topOuter, topInner), midpoint(bottomOuter, bottomInner), frame.faceWidth * 0.065);
}

function depressorAnguliGeometry(item, frame) {
    const leftSide = item.side === 'left';
    const corner = frame.point(leftSide ? 61 : 291);
    const outer = frame.point(leftSide ? 91 : 321);
    const lower = mix(frame.point(leftSide ? 201 : 421), frame.point(152), 0.08);
    const inner = mix(lower, frame.center, 0.08);
    const points = [corner, outer, lower, inner];
    return patchGeometry(points, average(points), corner, lower, frame.faceWidth * 0.045);
}

function mentalisGeometry(item, frame) {
    const leftSide = item.side === 'left';
    const upper = frame.point(leftSide ? 84 : 314);
    const center = frame.point(leftSide ? 201 : 421);
    const lower = mix(center, frame.point(152), 0.30);
    const axis = normalize(subtract(lower, upper), frame.verticalAxis);
    const normal = { x: -axis.y, y: axis.x };
    const half = frame.faceWidth * 0.020;
    const points = [
        add(upper, scaleVector(normal, half * 0.55)),
        add(center, scaleVector(normal, half)),
        lower,
        add(center, scaleVector(normal, -half)),
        add(upper, scaleVector(normal, -half * 0.55)),
    ];
    return patchGeometry(points, center, upper, lower, frame.faceWidth * 0.035);
}

function platysmaGeometry(item, frame) {
    if (!frame.neckVisible) return null;
    const lowerCenter = add(frame.chin, scaleVector(frame.verticalAxis, frame.faceHeight * 0.27));
    const lowerLeft = add(lowerCenter, scaleVector(frame.horizontalAxis, -frame.faceWidth * 0.31));
    const lowerRight = add(lowerCenter, scaleVector(frame.horizontalAxis, frame.faceWidth * 0.31));
    const points = [frame.point(172), frame.chin, frame.point(397), lowerRight, lowerLeft];
    return patchGeometry(points, midpoint(frame.chin, lowerCenter), frame.chin, lowerCenter, frame.faceWidth * 0.10);
}

function ribbonGeometry(item, frame) {
    let path = frame.points(item.controlPoints);
    const faceWidth = frame.faceWidth;
    let widths = { start: faceWidth * 0.008, middle: faceWidth * 0.018, end: faceWidth * 0.006 };
    if (item.geometryKey === 'corrugator') widths = { start: faceWidth * 0.008, middle: faceWidth * 0.020, end: faceWidth * 0.007 };
    if (item.geometryKey === 'depressor-supercilii') widths = { start: faceWidth * 0.006, middle: faceWidth * 0.013, end: faceWidth * 0.005 };
    if (item.geometryKey === 'procerus') widths = { start: faceWidth * 0.007, middle: faceWidth * 0.015, end: faceWidth * 0.006 };
    if (item.geometryKey === 'levator-alaeque') widths = { start: faceWidth * 0.006, middle: faceWidth * 0.014, end: faceWidth * 0.005 };
    if (item.geometryKey === 'levator-labii') widths = { start: faceWidth * 0.008, middle: faceWidth * 0.019, end: faceWidth * 0.006 };
    if (item.geometryKey === 'zygomaticus-minor') widths = { start: faceWidth * 0.007, middle: faceWidth * 0.016, end: faceWidth * 0.005 };
    if (item.geometryKey === 'zygomaticus-major') widths = { start: faceWidth * 0.009, middle: faceWidth * 0.024, end: faceWidth * 0.007 };
    if (item.geometryKey === 'risorius') widths = { start: faceWidth * 0.005, middle: faceWidth * 0.012, end: faceWidth * 0.005 };
    if (item.geometryKey === 'depressor-labii') widths = { start: faceWidth * 0.006, middle: faceWidth * 0.016, end: faceWidth * 0.007 };

    // A slight landmark-relative bow prevents paired muscles from reading as
    // straight debug lines while preserving their anatomical endpoints.
    if (path.length >= 3) {
        const first = path[0];
        const last = path[path.length - 1];
        const axis = normalize(subtract(last, first), frame.verticalAxis);
        const normal = { x: -axis.y, y: axis.x };
        const bowDirection = path[1].x < frame.center.x ? -1 : 1;
        path = [first, add(path[1], scaleVector(normal, faceWidth * 0.006 * bowDirection)), last];
    }
    return {
        path,
        widths,
        labelAnchor: path[Math.floor(path.length / 2)],
        fiberStart: path[0],
        fiberEnd: path[path.length - 1],
        hitRadius: Math.max(widths.middle * 1.8, frame.faceWidth * 0.025),
    };
}

function ringGeometry(item, frame, ring, outerX, outerY, innerX, innerY) {
    const center = average(ring);
    const outerPoints = scaleInBasis(ring, center, outerX, outerY, frame);
    const innerPoints = scaleInBasis(ring, center, innerX, innerY, frame);
    return {
        outerPoints,
        innerPoints,
        labelAnchor: item.side === 'center' ? center : add(center, scaleVector(frame.horizontalAxis, item.side === 'left' ? -frame.faceWidth * 0.025 : frame.faceWidth * 0.025)),
        fiberStart: outerPoints[0],
        fiberEnd: outerPoints[Math.floor(outerPoints.length / 2)],
        hitRadius: Math.max(...outerPoints.map(value => distance(value, center))),
    };
}

function patchGeometry(points, labelAnchor, fiberStart, fiberEnd, hitRadius) {
    return { points, labelAnchor, fiberStart, fiberEnd, hitRadius };
}

function scaleInBasis(points, center, scaleX, scaleY, frame) {
    return points.map(value => {
        const delta = subtract(value, center);
        const localX = dot(delta, frame.horizontalAxis);
        const localY = dot(delta, frame.verticalAxis);
        return add(center, add(
            scaleVector(frame.horizontalAxis, localX * scaleX),
            scaleVector(frame.verticalAxis, localY * scaleY),
        ));
    });
}

function average(points) {
    return {
        x: points.reduce((sum, value) => sum + value.x, 0) / points.length,
        y: points.reduce((sum, value) => sum + value.y, 0) / points.length,
    };
}

function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function mix(a, b, amount) {
    return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
}

function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

function scaleVector(vector, amount) {
    return { x: vector.x * amount, y: vector.y * amount };
}

function normalize(vector, fallback) {
    const length = Math.hypot(vector.x, vector.y);
    return length < 0.0001 ? fallback : { x: vector.x / length, y: vector.y / length };
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

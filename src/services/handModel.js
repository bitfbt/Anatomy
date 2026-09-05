import { HAND } from './handLandmarks.js';
import { CAMERA_CONFIG, HAND_BONE_DATA, TERMINOLOGY_MODES, getSideLabel } from './handAnatomyData.js';

export const ANATOMY_MODES = {
    SIMPLE: 'simple',
    GROUPED: 'grouped',
    DETAILED: 'detailed',
    QUIZ: 'quiz',
    DEBUG: 'debug',
};

const FINGER_JOINTS = {
    thumb: [HAND.THUMB_CMC, HAND.THUMB_MCP, HAND.THUMB_IP, HAND.THUMB_TIP],
    index: [HAND.INDEX_MCP, HAND.INDEX_PIP, HAND.INDEX_DIP, HAND.INDEX_TIP],
    middle: [HAND.MIDDLE_MCP, HAND.MIDDLE_PIP, HAND.MIDDLE_DIP, HAND.MIDDLE_TIP],
    ring: [HAND.RING_MCP, HAND.RING_PIP, HAND.RING_DIP, HAND.RING_TIP],
    pinky: [HAND.PINKY_MCP, HAND.PINKY_PIP, HAND.PINKY_DIP, HAND.PINKY_TIP],
};

const FINGER_LABELS = {
    thumb: 'Thumb',
    index: 'Index',
    middle: 'Middle',
    ring: 'Ring',
    pinky: 'Pinky',
};

const PHALANX_SEGMENTS = {
    proximal: [0, 1],
    middle: [1, 2],
    distal: [2, 3],
};

export function createHandSkeletonModel(landmarks, width, height, options = {}) {
    const terminologyMode = options.terminologyMode || TERMINOLOGY_MODES.BASIC;
    const isMirroredCamera = options.isMirroredCamera ?? CAMERA_CONFIG.isMirroredCamera;
    const points = landmarks.map((landmark, index) => ({
        index,
        x: landmark.x * width,
        y: landmark.y * height,
        z: landmark.z ?? 0,
        confidence: landmark.visibility ?? landmark.presence ?? options.score ?? 1,
    }));

    const wrist = points[HAND.WRIST];
    const middleMcp = points[HAND.MIDDLE_MCP];
    const indexMcp = points[HAND.INDEX_MCP];
    const pinkyMcp = points[HAND.PINKY_MCP];
    const thumbCmc = points[HAND.THUMB_CMC];
    const palmAxis = normalize(sub(middleMcp, wrist));
    const rawRadialAxis = normalize(sub(thumbCmc, pinkyMcp));
    const radialAxis = isMirroredCamera ? scaleVec(rawRadialAxis, -1) : rawRadialAxis;
    const ulnarAxis = scaleVec(radialAxis, -1);
    const forearmAxis = scaleVec(palmAxis, -1);
    const palmWidth = distance(indexMcp, pinkyMcp);
    const palmLength = distance(wrist, middleMcp);
    const handScale = Math.max(1, (palmWidth + palmLength) / 2);
    const widthScale = Math.max(0.55, Math.min(1.45, handScale / 120));
    const handedness = resolveHandedness(options.handedness, options.score, wrist, middleMcp, thumbCmc, pinkyMcp, isMirroredCamera);
    const confidence = getTrackingConfidence(points, width, height, options.score);
    const warnings = getTrackingWarnings(points, width, height, palmLength, palmWidth, palmAxis, confidence, handedness);

    // Normalized coordinates: wrist is origin; middle-MCP direction gives hand rotation;
    // radial/thumb-side axis gives left/right carpal mirroring; scale comes from MCP span
    // and wrist-to-MCP distance. This is an educational landmark model, not bone detection.
    const normalizedPoints = points.map(point => normalizePoint(point, wrist, palmAxis, radialAxis, handScale));
    const carpalCenter = add(wrist, scaleVec(palmAxis, palmLength * 0.12));

    const bones = [];
    const addBone = (bone) => bones.push({
        alpha: confidence.score,
        ...bone,
        info: makeInfo(bone, handedness.label, terminologyMode),
    });

    HAND_BONE_DATA.metacarpals.forEach(([finger, name, alias, location]) => {
        const joints = FINGER_JOINTS[finger];
        const to = points[finger === 'thumb' ? HAND.THUMB_MCP : joints[0]];
        addBone(segmentBone({
            id: `${finger}-metacarpal`,
            name,
            alias,
            group: 'metacarpals',
            side: finger === 'thumb' ? 'radial' : finger === 'pinky' ? 'ulnar' : 'central',
            from: carpalCenter,
            to,
            startWidth: 16 * widthScale,
            endWidth: 9 * widthScale,
            priority: 3,
            location,
            functionText: 'Transfers force from the wrist/carpal region into the finger ray.',
            connectedJoints: finger === 'thumb' ? 'Carpometacarpal and thumb MCP joints.' : 'Carpometacarpal and MCP joints.',
            memory: `${name.split(' ')[0]} lines up with the ${FINGER_LABELS[finger].toLowerCase()} ray.`,
        }));
    });

    // The thumb has CMC -> MCP -> IP -> tip landmarks but only two phalanges.
    // Map its proximal and distal bones explicitly so the distal segment never
    // indexes past the four-point thumb chain.
    const thumbPhalanxJoints = {
        proximal: [HAND.THUMB_MCP, HAND.THUMB_IP],
        distal: [HAND.THUMB_IP, HAND.THUMB_TIP],
    };
    HAND_BONE_DATA.thumbPhalanges.forEach(([segment, name, location]) => {
        const [fromJoint, toJoint] = thumbPhalanxJoints[segment];
        addBone(segmentBone({
            id: `thumb-${segment}`,
            name,
            group: 'thumb-phalanges',
            side: 'radial',
            from: points[fromJoint],
            to: points[toJoint],
            startWidth: (segment === 'proximal' ? 13 : 11) * widthScale,
            endWidth: (segment === 'proximal' ? 7 : 5) * widthScale,
            priority: 4,
            location,
            functionText: 'Supports thumb pinch and opposition.',
            connectedJoints: segment === 'proximal' ? 'Thumb MCP and IP joints.' : 'Thumb IP joint and fingertip soft tissue.',
            memory: segment === 'proximal' ? 'Proximal thumb bone is closer to the palm.' : 'Distal thumb bone is at the thumb tip.',
        }));
    });

    HAND_BONE_DATA.fingerPhalanges.forEach(([finger, segment, name, location]) => {
        const [fromIndex, toIndex] = PHALANX_SEGMENTS[segment];
        const joints = FINGER_JOINTS[finger];
        addBone(segmentBone({
            id: `${finger}-${segment}`,
            name,
            group: 'finger-phalanges',
            side: finger === 'pinky' ? 'ulnar' : finger === 'index' ? 'radial' : 'central',
            from: points[joints[fromIndex]],
            to: points[joints[toIndex]],
            startWidth: (segment === 'proximal' ? 13 : segment === 'middle' ? 11 : 9) * widthScale,
            endWidth: (segment === 'proximal' ? 7 : segment === 'middle' ? 6 : 4) * widthScale,
            priority: 5,
            location,
            functionText: 'Supports finger flexion, extension, and precise contact with objects.',
            connectedJoints: getPhalanxJoints(segment),
            memory: `${FINGER_LABELS[finger]} ${segment}: ${segment === 'distal' ? 'tip' : segment === 'middle' ? 'middle' : 'palm-side'} segment.`,
        }));
    });

    const carpalScale = Math.max(8, palmWidth * 0.14);
    HAND_BONE_DATA.carpals.forEach((carpal, index) => {
        const center = carpalAnchor(wrist, radialAxis, forearmAxis, carpal.layout, carpalScale);
        addBone({
            id: carpal.id,
            name: carpal.name,
            group: 'carpals',
            side: carpal.side,
            row: carpal.row,
            type: 'carpal',
            center,
            rx: carpalScale * (carpal.name === 'Capitate' ? 1.08 : carpal.name === 'Pisiform' ? 0.62 : 0.85),
            ry: carpalScale * (carpal.name === 'Pisiform' ? 0.62 : 0.76),
            angle: Math.atan2(radialAxis.y, radialAxis.x),
            priority: index < 4 ? 1 : 2,
            labelModes: [ANATOMY_MODES.DETAILED],
            location: carpal.location,
            functionText: carpal.function,
            connectedJoints: carpal.joints,
            memory: carpal.memory,
        });
    });

    const radiusCenter = add(add(wrist, scaleVec(forearmAxis, palmWidth * 0.36)), scaleVec(radialAxis, palmWidth * 0.22));
    const ulnaCenter = add(add(wrist, scaleVec(forearmAxis, palmWidth * 0.36)), scaleVec(ulnarAxis, palmWidth * 0.22));
    addBone(segmentBone({
        id: 'radius',
        name: 'Radius',
        group: 'forearm',
        side: 'radial',
        from: add(radiusCenter, scaleVec(forearmAxis, palmWidth * 0.22)),
        to: radiusCenter,
        startWidth: 13 * widthScale,
        endWidth: 8 * widthScale,
        priority: 3,
        location: 'Forearm bone at the thumb/radial side of the wrist.',
        functionText: 'Supports wrist alignment and forearm rotation.',
        connectedJoints: 'Radiocarpal and distal radioulnar joints.',
        memory: 'Radius is on the thumb side.',
    }));
    addBone(segmentBone({
        id: 'ulna',
        name: 'Ulna',
        group: 'forearm',
        side: 'ulnar',
        from: add(ulnaCenter, scaleVec(forearmAxis, palmWidth * 0.22)),
        to: ulnaCenter,
        startWidth: 13 * widthScale,
        endWidth: 8 * widthScale,
        priority: 3,
        location: 'Forearm bone at the pinky/ulnar side of the wrist.',
        functionText: 'Supports forearm rotation and ulnar-side wrist alignment.',
        connectedJoints: 'Distal radioulnar joint and wrist complex.',
        memory: 'Ulna is on the ulnar, pinky side.',
    }));

    const simpleLabels = [
        labelFromBones('Phalanges', 'phalanges', bones, 1),
        labelFromBones('Metacarpals', 'metacarpals', bones, 1),
        labelFromBones('Carpals', 'carpals', bones, 1),
    ];
    const groupedLabels = [
        labelFromBones('Thumb Phalanges', 'thumb-phalanges', bones, 1),
        ...['index', 'middle', 'ring', 'pinky'].map((finger, priority) => (
            labelFromBones(`${FINGER_LABELS[finger]} Phalanges`, `${finger}-phalanges`, bones, priority + 2)
        )),
        labelFromBones('Metacarpals', 'metacarpals', bones, 1),
        labelFromBones('Carpals', 'carpals', bones, 1),
    ].filter(label => label.point);

    return {
        landmarks: points,
        rawLandmarks: options.rawLandmarks?.map((landmark, index) => ({ index, x: landmark.x * width, y: landmark.y * height, z: landmark.z ?? 0 })) || points,
        normalizedPoints,
        bones,
        simpleLabels,
        groupedLabels,
        handedness,
        terminologyMode,
        isMirroredCamera,
        origin: wrist,
        axes: { palm: palmAxis, radial: radialAxis, ulnar: ulnarAxis, forearm: forearmAxis },
        scale: handScale,
        rotation: Math.atan2(palmAxis.y, palmAxis.x),
        confidence,
        warnings,
    };
}

export function getLabelsForMode(model, mode) {
    if (mode === ANATOMY_MODES.SIMPLE) return model.simpleLabels;
    if (mode === ANATOMY_MODES.GROUPED) return model.groupedLabels;
    if (mode === ANATOMY_MODES.DETAILED) return model.simpleLabels;
    if (mode === ANATOMY_MODES.QUIZ) return [];
    if (mode === ANATOMY_MODES.DEBUG) return model.groupedLabels;

    return model.simpleLabels;
}

export function findNearestBone(model, point) {
    let best = null;
    let bestDistance = Infinity;
    for (const bone of model.bones) {
        const d = bone.type === 'segment'
            ? distanceToSegment(point, bone.from, bone.to) - bone.startWidth
            : distance(point, bone.center) - (bone.radius || bone.rx || 10);
        if (d < bestDistance) {
            bestDistance = d;
            best = bone;
        }
    }
    return bestDistance <= 24 ? best : null;
}

export function getWristBones(model) {
    return model.bones.filter(bone => bone.group === 'carpals');
}

function segmentBone(config) {
    return {
        ...config,
        type: 'segment',
        center: midpoint(config.from, config.to),
        labelPoint: midpoint(config.from, config.to),
        labelModes: [ANATOMY_MODES.DETAILED],
    };
}

function labelFromBones(name, group, bones, priority) {
    const groupBones = group === 'phalanges'
        ? bones.filter(bone => bone.group === 'thumb-phalanges' || bone.group === 'finger-phalanges')
        : group === 'thumb-phalanges'
            ? bones.filter(bone => bone.group === 'thumb-phalanges')
        : group.endsWith('-phalanges')
            ? bones.filter(bone => bone.id.startsWith(group.replace('-phalanges', '-')))
            : bones.filter(bone => bone.group === group);
    if (groupBones.length === 0) return { id: `group-${group}`, text: name, point: null, target: null, priority };
    const points = groupBones.map(bone => bone.center || midpoint(bone.from, bone.to));
    const point = average(points);
    return { id: `group-${group}`, text: name, point, target: point, priority };
}

function makeInfo(bone, handednessLabel, terminologyMode) {
    const sideText = bone.side === 'central' ? 'central hand' : getSideLabel(bone.side, terminologyMode);
    return {
        name: bone.name,
        alias: bone.alias,
        group: getGroupName(bone.group),
        handSide: handednessLabel,
        anatomicalSide: sideText,
        location: addTerminology(bone.location, terminologyMode),
        function: bone.functionText,
        connectedJoints: bone.connectedJoints,
        memory: bone.memory,
        row: bone.row,
    };
}

function getGroupName(group) {
    if (group === 'carpals') return 'Carpal bone';
    if (group === 'metacarpals') return 'Metacarpal';
    if (group === 'thumb-phalanges') return 'Thumb phalanx';
    if (group === 'finger-phalanges') return 'Finger phalanx';
    if (group === 'forearm') return 'Forearm bone at wrist';
    return group;
}

function addTerminology(text, terminologyMode) {
    if (terminologyMode !== TERMINOLOGY_MODES.ADVANCED) return text;
    return text
        .replaceAll('thumb/radial side', 'thumb/radial side')
        .replaceAll('pinky/ulnar side', 'pinky/ulnar side');
}

function getPhalanxJoints(segment) {
    if (segment === 'proximal') return 'MCP and PIP joints.';
    if (segment === 'middle') return 'PIP and DIP joints.';
    return 'DIP joint and fingertip soft tissue.';
}

function carpalAnchor(wrist, radialAxis, forearmAxis, layout, scale) {
    return add(add(wrist, scaleVec(radialAxis, layout.side * scale)), scaleVec(forearmAxis, layout.along * scale));
}

function resolveHandedness(detectorLabel, detectorScore, wrist, middleMcp, thumbCmc, pinkyMcp, isMirroredCamera) {
    const inferred = estimateHandedness(wrist, middleMcp, thumbCmc, pinkyMcp, isMirroredCamera);
    const normalizedLabel = normalizeHandednessLabel(detectorLabel);
    const score = detectorScore ?? 0;
    if (!normalizedLabel || score < 0.55) {
        return { label: inferred, source: 'geometry', score, uncertain: true };
    }
    return { label: normalizedLabel, source: 'detector', score, uncertain: score < 0.72 };
}

function getTrackingConfidence(points, width, height, handednessScore = 1) {
    const inFrame = points.filter(p => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height).length / points.length;
    const landmarkConfidence = points.reduce((sum, p) => sum + Math.min(1, Math.max(0, p.confidence ?? 1)), 0) / points.length;
    const score = clamp01((handednessScore ?? 1) * 0.35 + inFrame * 0.35 + landmarkConfidence * 0.30);
    return {
        score,
        label: score > 0.78 ? 'stable' : score > 0.55 ? 'fair' : 'poor',
        inFrame,
        landmarkConfidence,
    };
}

function getTrackingWarnings(points, width, height, palmLength, palmWidth, palmAxis, confidence, handedness) {
    const warnings = [];
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    const handSize = Math.max(palmLength, palmWidth);
    const frameMin = Math.min(width, height);
    const angleFromVertical = Math.abs(Math.atan2(palmAxis.x, -palmAxis.y) * 180 / Math.PI);

    if (handedness.uncertain) warnings.push('Handedness uncertain');
    if (handSize < frameMin * 0.16) warnings.push('Move hand closer');
    if (minX < 8 || minY < 8 || maxX > width - 8 || maxY > height - 8) warnings.push('Keep whole hand in frame');
    if (angleFromVertical > 68) warnings.push('Rotate hand flatter to camera');
    if (confidence.score < 0.55) warnings.push('Tracking confidence is low');
    if (palmWidth < frameMin * 0.07) warnings.push('Spread fingers slightly');
    return warnings;
}

function normalizePoint(point, origin, palmAxis, radialAxis, scale) {
    const relative = sub(point, origin);
    return {
        x: dot(relative, radialAxis) / scale,
        y: dot(relative, palmAxis) / scale,
        z: point.z ?? 0,
    };
}

function estimateHandedness(wrist, middleMcp, thumbCmc, pinkyMcp, isMirroredCamera) {
    const palm = sub(middleMcp, wrist);
    const thumb = sub(thumbCmc, pinkyMcp);
    const label = cross(palm, thumb) > 0 ? 'Left Hand' : 'Right Hand';
    if (!isMirroredCamera) return label;
    return label === 'Left Hand' ? 'Right Hand' : 'Left Hand';
}

function normalizeHandednessLabel(label) {
    if (!label) return null;
    if (/left/i.test(label)) return 'Left Hand';
    if (/right/i.test(label)) return 'Right Hand';
    return null;
}

function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function scaleVec(v, scalar) { return { x: v.x * scalar, y: v.y * scalar }; }
function dot(a, b) { return a.x * b.x + a.y * b.y; }
function cross(a, b) { return a.x * b.y - a.y * b.x; }
function distance(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function average(points) {
    return {
        x: points.reduce((sum, p) => sum + p.x, 0) / Math.max(1, points.length),
        y: points.reduce((sum, p) => sum + p.y, 0) / Math.max(1, points.length),
    };
}
function normalize(v) {
    const len = Math.sqrt(v.x ** 2 + v.y ** 2) || 1;
    return { x: v.x / len, y: v.y / len };
}
function distanceToSegment(point, a, b) {
    const ab = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(point, a), ab) / (dot(ab, ab) || 1)));
    return distance(point, add(a, scaleVec(ab, t)));
}

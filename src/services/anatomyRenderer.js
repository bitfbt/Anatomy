import { drawRadiographicBone as drawRealisticBoneSegment } from './radiographicBone.js';
import { createCarpalLayout, drawCarpalAnatomyNode } from './carpalAnatomy.js';
import { drawCarpalLetters } from './carpalLabels.js';
import { muscleLabelTarget } from './muscleInfo.js';
import { FACE, HAND, POSE } from './handLandmarks.js';
import { ANATOMY_MODES, createHandSkeletonModel, getLabelsForMode } from './handModel.js';
import { createFaceMuscleModel } from './faceMuscleModel.js';
import { renderFaceSkeleton, drawAtlasLabels } from './faceSkeleton.js';

// ═══════════════════════════════════════
//   HAND ANATOMY RENDERERS
// ═══════════════════════════════════════

const MEDICAL_MUSCLE_COLORS = {
    thenarLight: '#e18f84',
    thenarMid: '#b14f4d',
    thenarDark: '#672e34',
    deepLight: '#d07b72',
    deepMid: '#98433f',
    deepDark: '#572831',
    hypothenarLight: '#ce7f78',
    hypothenarMid: '#964247',
    hypothenarDark: '#55262f',
    interossei: '#a24b49',
};

// Close-up tracking retains the identity and geometry of one measured digit.
// Render only that chain: an unseen palm cannot provide current wrist anatomy.
export function drawTrackedFingerAnatomy(ctx, finger, w, h, options = {}) {
    const names = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
    const isThumb = finger?.name === 'Thumb';
    const expectedPoints = isThumb ? 3 : 4;
    const bounds = options.visibleBounds || { left: 0, top: 0, right: w, bottom: h };
    const empty = { bones: [], tendons: [] };
    if (!names.includes(finger?.name) || finger.points?.length !== expectedPoints
        || !finger.points.every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))
        || !Number.isFinite(finger.width) || finger.width <= 0
        || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0
        || !['left', 'top', 'right', 'bottom'].every(key => Number.isFinite(bounds[key]))
        || bounds.right <= bounds.left || bounds.bottom <= bounds.top) return empty;

    const points = finger.points.map(point => ({ x: point.x * w, y: point.y * h }));
    const fingerWidth = finger.width * w;
    if (!Number.isFinite(fingerWidth)
        || !points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) return empty;
    const segments = isThumb ? ['proximal', 'distal'] : ['proximal', 'middle', 'distal'];
    const visibleSegments = segments.map((segment, index) => ({
        segment, index, from: points[index], to: points[index + 1],
        visible: clipFingerSegment(points[index], points[index + 1], bounds),
    })).filter(segment => segment.visible && dist(segment.from, segment.to) >= 4);
    if (visibleSegments.length === 0) return empty;

    const bones = [];
    const tendons = [];
    const labels = [];
    const hitTargets = [];
    const layer = options.layer || 'skeleton';
    const labelMode = options.labelMode || 'off';
    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    ctx.clip();
    ctx.globalCompositeOperation = 'source-over';

    if (layer === 'skeleton') {
        visibleSegments.forEach(({ segment, from, to, visible }) => {
            const widthFactor = segment === 'proximal' ? 0.25 : segment === 'middle' ? 0.21 : 0.18;
            const startWidth = Math.min(fingerWidth * widthFactor, dist(from, to) * 0.24);
            const endWidth = startWidth * (segment === 'distal' ? 0.72 : 0.83);
            drawRealisticBoneSegment(ctx, from, to, {
                startWidth,
                endWidth,
                midScale: 1.04,
                alpha: 0.82,
                boneType: getBoneRenderType(finger.name, `${segment} phalanx`, 'Phalanx'),
            });
            const labelPoint = mid(visible.from, visible.to);
            const bone = {
                id: `${finger.name.toLowerCase()}-${segment}-phalanx`,
                type: 'segment',
                name: `${finger.name}: ${segment} phalanx`,
                group: 'Phalanx',
                finger: finger.name,
                segment: `${segment} phalanx`,
                from, to, labelPoint,
                radius: startWidth,
                estimated: true,
            };
            bones.push(bone);
            labels.push({ text: bone.name, point: labelPoint });
        });
        if (labelMode !== 'detailed') {
            labels.splice(0, labels.length, {
                text: `${finger.name} phalanges`,
                point: mid(visibleSegments[0].visible.from, visibleSegments[0].visible.to),
            });
        }
    } else if (layer === 'muscles') {
        // Digital flexor/extensor tendons cross the phalanges; muscle bellies
        // belong to the hand/forearm and are deliberately absent from this view.
        const scale = fingerWidth / 30;
        const path = [...points];
        path[path.length - 1] = moveToward(points.at(-2), points.at(-1), 0.70);
        if (isThumb) path.splice(1, 0, mid(path[0], path[1]));
        const back = options.side === 'back';
        if (back) {
            drawExtensorTendonPath(ctx, path, scale, { thumb: isThumb, palmWidth: fingerWidth * 4 });
            if (!isThumb) drawExtensorHood(ctx, points[0], points[1], scale, 0.34);
        } else {
            drawBezierTendonPath(ctx, path, scale, { thumb: isThumb, palmWidth: fingerWidth * 4 });
        }
        const tendon = {
            name: `${finger.name} ${back ? 'extensor' : 'flexor'} tendon path`,
            finger: finger.name,
            points: path,
            estimated: true,
        };
        tendons.push(tendon);
        labels.push({
            text: tendon.name,
            point: mid(visibleSegments[0].visible.from, visibleSegments[0].visible.to),
        });
    }

    if (labelMode !== 'off') {
        ctx.font = '10px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        // Skip labels too wide for a narrow crop rather than letting the shared
        // label placer clamp a rectangle that cannot fit into its viewport.
        const fittingLabels = labels.filter(label => ctx.measureText(label.text).width + 28 <= bounds.right - bounds.left);
        if (bounds.bottom - bounds.top >= 35) {
            const layouts=drawSmartLabels(ctx, fittingLabels, bounds, { theme: 'medical', maxLabels: 3, keepLeadersShort: true });
            if(layer==='muscles')hitTargets.push(...layouts.map(label=>muscleLabelTarget(label.text,label.rect)).filter(Boolean));
        }
    }
    ctx.restore();
    return { bones, tendons, hitTargets };
}

function clipFingerSegment(from, to, bounds) {
    const dx = to.x - from.x, dy = to.y - from.y;
    let enter = 0, leave = 1;
    const edges = [
        [-dx, from.x - bounds.left], [dx, bounds.right - from.x],
        [-dy, from.y - bounds.top], [dy, bounds.bottom - from.y],
    ];
    for (const [direction, distance] of edges) {
        if (direction === 0) {
            if (distance < 0) return null;
            continue;
        }
        const fraction = distance / direction;
        if (direction < 0) enter = Math.max(enter, fraction);
        else leave = Math.min(leave, fraction);
        if (enter > leave) return null;
    }
    return {
        from: { x: from.x + dx * enter, y: from.y + dy * enter },
        to: { x: from.x + dx * leave, y: from.y + dy * leave },
    };
}

export function drawHandMuscles(ctx, landmarks, w, h, options = {}) {
    const p = (i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
    const wrist = p(HAND.WRIST);
    const thumbCmc = p(HAND.THUMB_CMC);
    const thumbMcp = p(HAND.THUMB_MCP);
    const thumbIp = p(HAND.THUMB_IP);
    const thumbTip = p(HAND.THUMB_TIP);
    const indexMcp = p(HAND.INDEX_MCP);
    const middleMcp = p(HAND.MIDDLE_MCP);
    const ringMcp = p(HAND.RING_MCP);
    const pinkyMcp = p(HAND.PINKY_MCP);
    const indexPip = p(HAND.INDEX_PIP);
    const middlePip = p(HAND.MIDDLE_PIP);
    const ringPip = p(HAND.RING_PIP);
    const pinkyPip = p(HAND.PINKY_PIP);
    const palmWidth = Math.max(24, dist(indexMcp, pinkyMcp));
    const palmLength = Math.max(32, dist(wrist, middleMcp));
    // Preserve tissue proportions as the hand approaches the camera.
    const scale = Math.max(0.65, (palmWidth + palmLength) / 210);
    const labelMode = options.labelMode || 'clean';
    const bounds = options.visibleBounds || {
        left: 18,
        top: 18,
        right: w - 18,
        bottom: h - 18,
    };
    const anatomy = {
        landmarks, width: w, height: h,
        wrist,
        thumbCmc,
        thumbMcp,
        thumbIp,
        thumbTip,
        indexMcp,
        middleMcp,
        ringMcp,
        pinkyMcp,
        fingerMcps: [indexMcp, middleMcp, ringMcp, pinkyMcp],
        fingerPips: [indexPip, middlePip, ringPip, pinkyPip],
        fingerDips: [p(HAND.INDEX_DIP), p(HAND.MIDDLE_DIP), p(HAND.RING_DIP), p(HAND.PINKY_DIP)],
        fingerTips: [p(HAND.INDEX_TIP), p(HAND.MIDDLE_TIP), p(HAND.RING_TIP), p(HAND.PINKY_TIP)],
        palmWidth,
        palmLength,
        scale,
        labelMode,
        bounds,
    };

    return options.side === 'back'
        ? drawBackSideMuscles(ctx, anatomy)
        : drawPalmSideMuscles(ctx, anatomy);
}

function drawPalmSideMuscles(ctx, anatomy) {
    const {
        wrist,
        thumbCmc,
        thumbMcp,
        thumbIp,
        thumbTip,
        fingerMcps,
        fingerPips,
        fingerDips,
        fingerTips,
        palmWidth,
        palmLength,
        scale,
        labelMode,
        bounds,
    } = anatomy;

    ctx.save();
    drawHandTissueCoverage(ctx, anatomy);
    const namedMuscles = drawAtlasIntrinsicMuscles(ctx, anatomy);
    const thenarLabel = averagePoints(namedMuscles.slice(0, 3).map(m => m.point));
    const hypothenarLabel = averagePoints(namedMuscles.slice(4).map(m => m.point));
    const interosseiLabel = drawSimplifiedPalmarInterossei(ctx, {
        wrist,
        fingerMcps,
        palmWidth,
        scale,
    });
    const lumbricalLabel = drawSimplifiedLumbricals(ctx, {
        wrist,
        thumbCmc,
        fingerMcps,
        fingerPips,
        palmWidth,
        scale,
    });
    const tendonLabels = drawCleanFlexorTendonLayer(ctx, {
        wrist,
        thumbCmc,
        thumbMcp,
        thumbIp,
        thumbTip,
        fingerMcps,
        fingerPips,
        fingerDips,
        fingerTips,
        palmWidth,
        palmLength,
        scale,
    });

    const labels = labelMode === 'detailed'
        ? [
            { text: 'Flexor tendon paths', point: tendonLabels.groupPoint, priority: 1 },
            ...namedMuscles.map((m, i) => ({ ...m, priority: i + 2 })),
            { text: 'Lumbricals', point: lumbricalLabel, priority: 4 },
            { text: 'Palmar interossei', point: interosseiLabel, priority: 5 },
            ...tendonLabels.detailed.map(label => ({ ...label, priority: label.priority + 20 })),
        ]
        : [
            { text: 'Flexor tendon paths', point: tendonLabels.groupPoint, priority: 1 },
            { text: 'Thenar muscles', point: thenarLabel, priority: 2, preferredSide: 1 },
            { text: 'Hypothenar muscles', point: hypothenarLabel, priority: 3, preferredSide: -1 },
            { text: 'Lumbricals', point: lumbricalLabel, priority: 4 },
            { text: 'Palmar interossei', point: interosseiLabel, priority: 5 },
        ];
    const hitTargets=drawMuscleLabels(ctx, labels, labelMode, bounds, createMuscleLabelAvoidRegion({
        wrist,
        thumbCmc,
        fingerMcps,
        fingerPips,
        palmWidth,
        bounds,
    }));
    ctx.restore();
    return { muscles: [], hitTargets };
}

function drawBackSideMuscles(ctx, anatomy) {
    const {
        wrist,
        thumbCmc,
        thumbMcp,
        thumbIp,
        thumbTip,
        fingerMcps,
        fingerPips,
        fingerDips,
        fingerTips,
        palmWidth,
        scale,
        labelMode,
        bounds,
    } = anatomy;
    const labels = [];

    ctx.save();
    drawHandTissueCoverage(ctx, anatomy, true);
    const palmCenter = averagePoints(fingerMcps);
    const palmAxis = normalizeVector({
        x: palmCenter.x - wrist.x,
        y: palmCenter.y - wrist.y,
    }, { x: 0, y: -1 });
    const lateralAxis = normalizeVector({
        x: fingerMcps[3].x-fingerMcps[0].x,
        y: fingerMcps[3].y-fingerMcps[0].y,
    }, perpendicularVector(palmAxis));
    const dorsalWrist = moveToward(wrist, palmCenter, 0.12);
    const tendonAnchors = [];
    const hoodAnchors = [];

    fingerMcps.forEach((mcp, index) => {
        const startOffset = ([-0.24, -0.08, 0.08, 0.24][index]) * palmWidth;
        const start = movePoint(dorsalWrist, lateralAxis, startOffset);
        const entry = movePoint(moveToward(dorsalWrist, mcp, 0.36), lateralAxis, startOffset * 0.24);
        const path = [
            start,
            entry,
            moveToward(entry, mcp, 0.64),
            mcp,
            moveToward(mcp, fingerPips[index], 0.44),
            moveToward(fingerPips[index], fingerDips[index], 0.68),
            moveToward(fingerDips[index], fingerTips[index], 0.58),
        ];
        drawExtensorTendonPath(ctx, path, scale, { palmWidth });
        drawExtensorHood(ctx, mcp, fingerPips[index], scale, 0.34);
        tendonAnchors.push(mid(mcp, fingerPips[index]));
        hoodAnchors.push(moveToward(mcp, fingerPips[index], 0.18));
    });

    // Four dorsal interossei occupy the spaces between the five metacarpal rays.
    // Each is rendered as a subdued bipennate slip so the dorsal view stays
    // visually distinct from the palmar interossei rather than reusing palm anatomy.
    const metacarpalBases = [
        moveToward(thumbCmc, thumbMcp, 0.48),
        moveToward(wrist, fingerMcps[0], 0.40),
        moveToward(wrist, fingerMcps[1], 0.40),
        moveToward(wrist, fingerMcps[2], 0.40),
        moveToward(wrist, fingerMcps[3], 0.40),
    ];
    const dorsalInsertions = [
        moveToward(fingerMcps[0], fingerPips[0], 0.18),
        moveToward(fingerMcps[1], fingerPips[1], 0.18),
        moveToward(fingerMcps[1], fingerPips[1], 0.18),
        moveToward(fingerMcps[2], fingerPips[2], 0.18),
    ];
    const dorsalAnchors = [];
    for (let i = 0; i < 4; i++) {
        const anchor = drawBipennateDorsalInterosseous(ctx, {
            baseA: metacarpalBases[i],
            baseB: metacarpalBases[i + 1],
            insertion: dorsalInsertions[i],
            scale,
            alpha: 0.66 - i * 0.015,
        });
        dorsalAnchors.push(anchor);
    }

    const thumbPath = [
        moveToward(wrist, thumbCmc, 0.16),
        moveToward(thumbCmc, thumbMcp, 0.10),
        thumbMcp,
        moveToward(thumbMcp, thumbIp, 0.54),
        moveToward(thumbIp, thumbTip, 0.66),
    ];
    drawExtensorTendonPath(ctx, thumbPath, scale, { thumb: true, palmWidth });

    labels.push(
        { text: 'Extensor tendon paths', point: averagePoints([...tendonAnchors, mid(thumbMcp, thumbIp)]), priority: 1 },
        { text: 'Dorsal interossei', point: averagePoints(dorsalAnchors), priority: 2 },
    );
    if (labelMode === 'detailed') {
        labels.push(
            { text: 'Extensor digitorum tendons', point: averagePoints(tendonAnchors), priority: 3, preferredSide: -1 },
            { text: 'Extensor pollicis tendon', point: mid(thumbMcp, thumbIp), priority: 4, preferredSide: 1 },
            { text: 'Extensor hood', point: averagePoints(hoodAnchors), priority: 5 },
        );
    }

    const hitTargets=drawMuscleLabels(ctx, labels, labelMode, bounds, createMuscleLabelAvoidRegion({
        wrist,
        thumbCmc,
        fingerMcps,
        fingerPips,
        palmWidth,
        bounds,
    }));
    ctx.restore();
    return { muscles: [], hitTargets };
}

// Continuous deep palm tissue beneath the separate superficial muscle sheets.
// Finger coverage represents fibrous sheaths, not muscle bellies in the digits.
function drawHandTissueCoverage(ctx, anatomy, dorsal = false) {
    const { wrist, thumbCmc, thumbMcp, thumbIp, thumbTip, fingerMcps, fingerPips,
        fingerDips, fingerTips, palmWidth, scale } = anatomy;
    const lateral = normalizeVector({ x: fingerMcps[3].x - fingerMcps[0].x,
        y: fingerMcps[3].y - fingerMcps[0].y }, { x: 1, y: 0 });
    const heel = moveToward(wrist, averagePoints(fingerMcps), -0.035);
    const outline = [movePoint(heel, lateral, -palmWidth * 0.38), thumbCmc,
        moveToward(thumbMcp, fingerMcps[0], 0.48), ...fingerMcps,
        movePoint(moveToward(wrist, fingerMcps[3], 0.55), lateral, palmWidth * 0.13),
        movePoint(heel, lateral, palmWidth * 0.40)];
    drawAnatomicalMuscleMass(ctx, outline, {
        light: dorsal ? '#e6cab0' : '#bf8074', mid: dorsal ? '#c4a38a' : '#a9635b', dark: dorsal ? '#a7836f' : '#77473f', alpha: 0.97,
        fiberA: heel, fiberB: averagePoints(fingerMcps), fiberSpread: palmWidth * 1.35,
        fiberCount: dorsal ? 0 : 65, scale, shadowAlpha: 0.10, strokeAlpha: 0.18,
    });
    if (!dorsal) {
    // Rounded hypothenar heel extends to the wrist on the little-finger side.
    // These anchors mirror with the actual index-to-pinky axis.
    const heelOuter = movePoint(heel, lateral, palmWidth * 0.40);
    const ulnarMid = movePoint(moveToward(wrist, fingerMcps[3], 0.43), lateral, palmWidth * 0.19);
    const heelInner = movePoint(moveToward(wrist, fingerMcps[3], 0.11), lateral, palmWidth * 0.04);
    drawAnatomicalMuscleMass(ctx, [heelInner, heelOuter,
        movePoint(ulnarMid, lateral, palmWidth * 0.035),
        movePoint(fingerMcps[3], lateral, palmWidth * 0.035),
        moveToward(wrist, fingerMcps[3], 0.70)], {
        light: '#cc8b7d', mid: '#ac635a', dark: '#824b43', alpha: 0.98,
        fiberA: mid(heelInner, heelOuter), fiberB: fingerMcps[3],
        fiberSpread: palmWidth * 0.60, fiberCount: 28, scale,
        shadowAlpha: 0.10, strokeAlpha: 0.18,
    });
    // Broad intermetacarpal sheets fill the spaces beneath the tendon fan.
    for (let i = 0; i < 3; i++) {
        const distal = mid(fingerMcps[i], fingerMcps[i + 1]);
        const proximal = movePoint(heel, lateral, (i - 1) * palmWidth * 0.17);
        const width = dist(fingerMcps[i], fingerMcps[i + 1]) * 1.12;
        const center = moveToward(proximal, distal, 0.62);
        drawAnatomicalMuscleMass(ctx, [proximal,
            movePoint(center, lateral, -width * 0.53),
            movePoint(distal, lateral, -width * 0.43),
            movePoint(distal, lateral, width * 0.43),
            movePoint(center, lateral, width * 0.53)], {
            light: '#cb8a7e', mid: '#b36d63', dark: '#884e47', alpha: 0.97,
            fiberA: proximal, fiberB: distal, fiberSpread: width * 1.7,
            fiberCount: 24, scale, shadowAlpha: 0.12, strokeAlpha: 0.22,
        });
    }
    }
    const digits = fingerMcps.map((mcp, i) => ({
        points: [mcp, fingerPips[i], fingerDips[i], fingerTips[i]],
        width: palmWidth * [0.175, 0.18, 0.165, 0.145][i],
    }));
    digits.push({ points: [thumbMcp, thumbIp, thumbTip], width: palmWidth * 0.19 });
    for (const { points, width } of digits) {
        const samples = sampleBezierSpline(points, 12);
        const widths = samples.map((_, i) => {
            const t = i / (samples.length - 1);
            return width * 1.32 * (1 - 0.30 * t) * (1 + 0.065 * Math.sin(t * Math.PI * 5));
        });
        ctx.save();
        drawTendonRibbon(ctx, samples, widths, { fill: '#bb7f76', stroke: '#a16d64', lineWidth: scale * 0.35 });
        drawTendonRibbon(ctx, samples, widths.map(w => w * 0.87), { fill: '#ce9489' });
        drawTendonRibbon(ctx, samples, widths.map(w => w * 0.68), { fill: '#dca79a' });
        // Exposed phalanges have broad rounded joint ends and a narrower shaft.
        // Each segment is anchored independently so the gaps follow bent joints.
        for (let segment = 0; segment < points.length - 1; segment++) {
            const start = moveToward(points[segment], points[segment + 1], 0.075);
            const end = moveToward(points[segment], points[segment + 1], segment === points.length - 2 ? 0.81 : 0.94);
            const axis = normalizeVector({ x: end.x - start.x, y: end.y - start.y }, { x: 0, y: 1 });
            const normal = perpendicularVector(axis);
            const radius = width * (0.41 - segment * 0.045);
            const center = mid(start, end);
            const shade = ctx.createLinearGradient(center.x - normal.x * radius, center.y - normal.y * radius,
                center.x + normal.x * radius, center.y + normal.y * radius);
            shade.addColorStop(0, '#a4916b'); shade.addColorStop(0.27, '#d5c6a4');
            shade.addColorStop(0.52, '#e5d9bc'); shade.addColorStop(0.80, '#cbbb97'); shade.addColorStop(1, '#aa9771');
            const contour = [
                movePoint(start, axis, -radius * 0.20),
                movePoint(start, normal, radius * 0.95),
                movePoint(moveToward(start, end, 0.20), normal, radius * 0.72),
                movePoint(moveToward(start, end, 0.70), normal, radius * 0.59),
                movePoint(end, normal, radius * 0.90),
                movePoint(end, axis, radius * 0.16),
                movePoint(end, normal, -radius * 0.90),
                movePoint(moveToward(start, end, 0.70), normal, -radius * 0.59),
                movePoint(moveToward(start, end, 0.20), normal, -radius * 0.72),
                movePoint(start, normal, -radius * 0.95),
            ];
            roundedClosedPath(ctx, contour); ctx.fillStyle = shade; ctx.fill();
            ctx.strokeStyle = 'rgba(123, 103, 72, 0.42)'; ctx.lineWidth = scale * 0.45; ctx.stroke();
        }
        // Superficialis slips flank the central profundus tendon on the fingers.
        if (!dorsal && points.length === 4) {
            const axis = normalizeVector({ x: points[2].x - points[1].x, y: points[2].y - points[1].y }, { x: 0, y: 1 });
            const normal = perpendicularVector(axis);
            for (const side of [-1, 1]) {
                const slip = sampleBezierSpline([
                    moveToward(points[0], points[1], 0.58),
                    movePoint(points[1], normal, side * width * 0.20),
                    movePoint(moveToward(points[1], points[2], 0.64), normal, side * width * 0.22),
                ], 10);
                drawTendonRibbon(ctx, slip, slip.map((_, i) => width * (0.105 - 0.025 * i / (slip.length - 1))),
                    { fill: '#f0ede3', stroke: '#c7c2b6', lineWidth: scale * 0.25 });
            }
        }
        ctx.restore();
    }
}

function drawAtlasIntrinsicMuscles(ctx, anatomy) {
    const { wrist, thumbCmc, thumbMcp, indexMcp, middleMcp, pinkyMcp, palmWidth, scale } = anatomy;
    const lateral = normalizeVector({ x: pinkyMcp.x - indexMcp.x, y: pinkyMcp.y - indexMcp.y }, { x: 1, y: 0 });
    const sheet = (text, a, b, width, bias = 0, deep = false) => {
        const axis = normalizeVector({ x: b.x - a.x, y: b.y - a.y }, { x: 0, y: -1 });
        const normal = perpendicularVector(axis);
        const center = movePoint(mid(a, b), lateral, bias * palmWidth);
        const points = [a,
            movePoint(moveToward(a, center, 0.65), normal, width * 0.38),
            movePoint(center, normal, width * 0.52),
            movePoint(moveToward(center, b, 0.65), normal, width * 0.26), b,
            movePoint(moveToward(center, b, 0.65), normal, -width * 0.26),
            movePoint(center, normal, -width * 0.52),
            movePoint(moveToward(a, center, 0.65), normal, -width * 0.38)];
        drawAnatomicalMuscleMass(ctx, points, {
            light: deep ? '#b77870' : '#d29387', mid: deep ? '#95534f' : '#af625b', dark: '#713d3c',
            alpha: 0.96, fiberA: a, fiberB: b, fiberSpread: width * 1.8,
            fiberCount: 30, scale, shadowAlpha: 0.20, strokeAlpha: 0.28,
        });
        return { text, point: center };
    };
    // Deep sheets are drawn first; the returned order groups labels by region.
    const opponens = sheet('Opponens pollicis', moveToward(wrist, thumbCmc, 0.35), thumbMcp, palmWidth * 0.38, 0, true);
    const adductor = sheet('Adductor pollicis', moveToward(wrist, middleMcp, 0.73), moveToward(thumbCmc, thumbMcp, 0.91), palmWidth * 0.40, 0, true);
    const flexor = sheet('Flexor pollicis brevis', moveToward(wrist, indexMcp, 0.20), moveToward(thumbCmc, thumbMcp, 0.91), palmWidth * 0.40, -0.025);
    const abductor = sheet('Abductor pollicis brevis', moveToward(wrist, thumbCmc, 0.38), movePoint(thumbMcp, lateral, -palmWidth * 0.035), palmWidth * 0.34, -0.13);
    const oppDigiti = sheet('Opponens digiti minimi', moveToward(wrist, pinkyMcp, 0.16), moveToward(wrist, pinkyMcp, 0.95), palmWidth * 0.38, 0.055, true);
    const flexDigiti = sheet('Flexor digiti minimi brevis', moveToward(wrist, pinkyMcp, 0.20), movePoint(pinkyMcp, lateral, -palmWidth * 0.05), palmWidth * 0.19, -0.035);
    const abdDigiti = sheet('Abductor digiti minimi', movePoint(moveToward(wrist, pinkyMcp, 0.15), lateral, palmWidth * 0.10), movePoint(pinkyMcp, lateral, palmWidth * 0.05), palmWidth * 0.28, 0.08);
    return [abductor, flexor, opponens, adductor, abdDigiti, flexDigiti, oppDigiti];
}

function drawSimplifiedLumbricals(ctx, anatomy) {
    const {
        wrist,
        thumbCmc,
        fingerMcps,
        fingerPips,
        palmWidth,
        scale,
    } = anatomy;
    const palmCenter = averagePoints(fingerMcps);
    const palmAxis = normalizeVector({
        x: palmCenter.x - wrist.x,
        y: palmCenter.y - wrist.y,
    }, { x: 0, y: -1 });
    const lateralAxis = perpendicularVector(palmAxis);
    // Lumbricals arise from FDP tendon territory and approach the radial/thumb
    // side of each extensor expansion. Using the visible thumb ray preserves
    // this relationship for either hand in mirrored display space.
    const radialAxis = normalizeVector({
        x: thumbCmc.x - palmCenter.x,
        y: thumbCmc.y - palmCenter.y,
    }, lateralAxis);
    const anchors = [];

    fingerMcps.forEach((mcp, index) => {
        const pip = fingerPips[index];
        const radialOffsets = [0.072, 0.058, 0.050, 0.044];
        const lateralBias = [-0.032, -0.010, 0.012, 0.030][index] * palmWidth;
        const distalPalm = moveToward(wrist, mcp, 0.54);
        const origin = movePoint(
            movePoint(distalPalm, radialAxis, palmWidth * radialOffsets[index]),
            lateralAxis,
            lateralBias
        );
        const insertion = movePoint(
            moveToward(mcp, pip, 0.28),
            radialAxis,
            palmWidth * radialOffsets[index] * 1.14
        );
        const control = movePoint(
            moveToward(origin, insertion, 0.52),
            lateralAxis,
            ([0.035, 0.016, -0.016, -0.035][index] * palmWidth)
        );
        const endWidth = Math.max(2.4, 3.0 * scale);
        const midWidth = Math.max(8.5, 11.5 * scale) * ([0.94, 1.0, 0.94, 0.88][index]);

        drawLumbricalMuscle(ctx, origin, control, insertion, endWidth, midWidth, 0.84);
        anchors.push(moveToward(origin, insertion, 0.52));
    });

    return averagePoints(anchors);
}

function drawSimplifiedPalmarInterossei(ctx, anatomy) {
    const {
        wrist,
        fingerMcps,
        palmWidth,
        scale,
    } = anatomy;
    const palmCenter = averagePoints(fingerMcps);
    const palmAxis = normalizeVector({
        x: palmCenter.x - wrist.x,
        y: palmCenter.y - wrist.y,
    }, { x: 0, y: -1 });
    const lateralAxis = perpendicularVector(palmAxis);
    const anchors = [];

    [
        { fingerIndex: 0, side: 1, bias: -0.040, width: 1.00 },
        { fingerIndex: 2, side: -1, bias: 0.030, width: 1.04 },
        { fingerIndex: 3, side: -1, bias: 0.056, width: 0.90 },
    ].forEach(({ fingerIndex, side, bias, width }) => {
        const mcp = fingerMcps[fingerIndex];
        const base = moveToward(wrist, mcp, fingerIndex === 0 ? 0.39 : 0.35);
        const distal = moveToward(wrist, mcp, 0.76);
        const offset = bias * palmWidth;
        const a = movePoint(base, lateralAxis, offset);
        const b = movePoint(distal, lateralAxis, offset + side * palmWidth * 0.026);
        const endWidth = Math.max(2.0, 2.4 * scale) * width;
        const midWidth = Math.max(6.5, 8.2 * scale) * width;

        drawInterosseousBand(ctx, a, b, endWidth, midWidth);
        anchors.push(moveToward(a, b, 0.55));
    });

    return averagePoints(anchors);
}

function drawCleanFlexorTendonLayer(ctx, anatomy) {
    const {
        wrist,
        thumbCmc,
        thumbMcp,
        thumbIp,
        thumbTip,
        fingerMcps,
        fingerPips,
        fingerDips,
        fingerTips,
        palmWidth,
        palmLength,
        scale,
    } = anatomy;
    const palmCenter = averagePoints(fingerMcps);
    const palmAxis = normalizeVector({
        x: palmCenter.x - wrist.x,
        y: palmCenter.y - wrist.y,
    }, { x: 0, y: -1 });
    // Derive the fan order from the actual fingers, including mirrored hands.
    const lateralAxis = normalizeVector({
        x: fingerMcps[3].x - fingerMcps[0].x,
        y: fingerMcps[3].y - fingerMcps[0].y,
    }, perpendicularVector(palmAxis));
    const baseCenter = moveToward(wrist, palmCenter, 0.10);
    const wristBundle = moveToward(wrist, palmCenter, 0.22);
    const labels = [];
    const groupAnchors = [];


    fingerMcps.forEach((mcp, index) => {
        const pip = fingerPips[index];
        const dip = fingerDips[index];
        const tip = fingerTips[index];
        const baseOffset = [-0.18, -0.06, 0.06, 0.18][index] * palmWidth;
        const start = movePoint(baseCenter, lateralAxis, baseOffset);
        const bundlePoint = movePoint(wristBundle, lateralAxis, baseOffset);
        const palmControl = moveToward(bundlePoint, mcp, 0.30);
        const palmFan = moveToward(bundlePoint, mcp, 0.62);
        const mcpControl = moveToward(bundlePoint, mcp, 0.86);
        const path = [
            start,
            bundlePoint,
            palmControl,
            palmFan,
            mcpControl,
            mcp,
            moveToward(mcp, pip, 0.46),
            moveToward(mcp, pip, 0.82),
            moveToward(pip, dip, 0.70),
            moveToward(dip, tip, 0.66),
        ];
        drawBezierTendonPath(ctx, path, scale, { fingerIndex: index, palmWidth });
        const labelPoint = mid(mcp, pip);
        labels.push({
            text: `${['Index', 'Middle', 'Ring', 'Pinky'][index]} flexor tendon path`,
            point: labelPoint,
            priority: index + 2,
            preferredSide: index < 2 ? 1 : -1,
        });
        groupAnchors.push(labelPoint);
    });

    const thumbVector = normalizeVector({
        x: thumbMcp.x - wrist.x,
        y: thumbMcp.y - wrist.y,
    }, palmAxis);
    const thumbStart = moveToward(wrist, thumbCmc, 0.18);
    const thumbBundle = moveToward(thumbStart, thumbCmc, 0.38);
    const thumbPath = [
        thumbStart,
        thumbBundle,
        moveToward(thumbBundle, thumbCmc, 0.62),
        moveToward(thumbCmc, thumbMcp, 0.48),
        thumbMcp,
        movePoint(moveToward(thumbMcp, thumbIp, 0.40), thumbVector, palmLength * 0.012),
        moveToward(thumbIp, thumbTip, 0.70),
    ];
    drawBezierTendonPath(ctx, thumbPath, scale, { thumb: true, palmWidth });
    const thumbLabelPoint = mid(thumbMcp, thumbIp);
    labels.unshift({
        text: 'Thumb flexor tendon path',
        point: thumbLabelPoint,
        priority: 1,
        preferredSide: 1,
    });
    groupAnchors.push(thumbLabelPoint);
    drawFlexorRetinaculumBand(ctx, wrist, palmCenter, lateralAxis, palmWidth, scale);

    return {
        detailed: labels,
        groupPoint: averagePoints(groupAnchors),
    };
}

function drawFlexorRetinaculumBand(ctx, wrist, palmCenter, lateralAxis, palmWidth, scale) {
    const center = moveToward(wrist, palmCenter, 0.09);
    const palmAxis = normalizeVector({
        x: palmCenter.x - wrist.x,
        y: palmCenter.y - wrist.y,
    }, { x: 0, y: -1 });
    const halfWidth = palmWidth * 0.36;
    const start = movePoint(center, lateralAxis, -halfWidth);
    const end = movePoint(center, lateralAxis, halfWidth);
    const palmBow = moveToward(center, palmCenter, 0.18);
    const bandWidth = Math.max(11.5, palmWidth * 0.075);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.globalAlpha *= 0.94;
    ctx.strokeStyle = 'rgba(78, 72, 64, 0.34)';
    ctx.lineWidth = bandWidth + 5.0 * scale;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(palmBow.x, palmBow.y, end.x, end.y);
    ctx.stroke();

    ctx.globalAlpha *= 0.82;
    ctx.strokeStyle = 'rgba(231, 222, 216, 0.98)';
    ctx.lineWidth = bandWidth;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(palmBow.x, palmBow.y, end.x, end.y);
    ctx.stroke();

    ctx.globalAlpha *= 0.88;
    ctx.strokeStyle = 'rgba(252, 246, 232, 0.60)';
    ctx.lineWidth = Math.max(1.4, bandWidth * 0.34);
    for (let i = -2; i <= 2; i++) {
        const offset = i * bandWidth * 0.23;
        const offsetStart = movePoint(start, palmAxis, offset);
        const offsetEnd = movePoint(end, palmAxis, offset);
        ctx.beginPath();
        ctx.moveTo(offsetStart.x, offsetStart.y);
        ctx.quadraticCurveTo(palmBow.x, palmBow.y, offsetEnd.x, offsetEnd.y);
        ctx.stroke();
    }
    ctx.globalAlpha *= 0.72;
    ctx.strokeStyle = 'rgba(255, 250, 238, 0.48)';
    ctx.lineWidth = Math.max(1.5, bandWidth * 0.34);
    [-0.34, -0.16, 0, 0.16, 0.34].forEach((spread) => {
        const entry = movePoint(moveToward(center, palmCenter, 0.48), lateralAxis, palmWidth * spread);
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        const control = movePoint(moveToward(center, entry, 0.55), lateralAxis, palmWidth * spread * 0.08);
        ctx.quadraticCurveTo(control.x, control.y, entry.x, entry.y);
        ctx.stroke();
    });
    ctx.restore();
}

function drawBezierTendonPath(ctx, points, scale, options = {}) {
    if (points.length < 4) return;
    const palmWidth = options.palmWidth ?? 120;
    const baseWidth = options.thumb
        ? clamp(palmWidth * 0.070, 7.0 * scale, 13.5 * scale)
        : clamp(palmWidth * 0.070, 7.0 * scale, 14.0 * scale);
    const samples = sampleBezierSpline(points, 11);
    const widthProfile = createTendonWidthProfile(samples.length, baseWidth, options.thumb);

    ctx.save();
    drawTendonRibbon(ctx, samples, widthProfile.map(width => width + 3.4 * scale), {
        fill: 'rgba(58, 54, 48, 0.13)',
        offset: { x: 0.9 * scale, y: 1.25 * scale },
    });
    drawTendonRibbon(ctx, samples, widthProfile, {
        fill: 'rgba(228, 221, 212, 0.96)',
        stroke: 'rgba(120, 110, 96, 0.17)',
        lineWidth: 0.5 * scale,
    });
    drawTendonRibbon(ctx, samples, widthProfile.map(width => Math.max(1.15 * scale, width * 0.40)), {
        fill: 'rgba(252, 246, 239, 0.55)',
    });
    // Parallel collagen strands follow the complete bending tendon path.
    for (const fraction of [-0.30, -0.12, 0.12, 0.30]) {
        const strand = samples.map((point, i) => {
            const before = samples[Math.max(0, i - 1)];
            const after = samples[Math.min(samples.length - 1, i + 1)];
            const normal = perpendicularVector(normalizeVector({ x: after.x - before.x, y: after.y - before.y }, { x: 0, y: -1 }));
            return movePoint(point, normal, widthProfile[i] * fraction);
        });
        drawTendonCenterHighlight(ctx, strand, Math.max(0.45, scale * 0.42), 'rgba(255, 252, 245, 0.66)');
    }
    drawTendonEdgeContour(ctx, samples, widthProfile, 'rgba(104, 94, 82, 0.25)', 0.34 * scale);
    drawTendonCenterHighlight(ctx, samples, Math.max(0.42, baseWidth * 0.045), 'rgba(255, 252, 242, 0.08)');
    ctx.restore();
}

function createTendonWidthProfile(count, baseWidth, isThumb = false) {
    const widths = [];
    for (let index = 0; index < count; index++) {
        const t = count <= 1 ? 0 : index / (count - 1);
        const palmBulge = Math.exp(-((t - 0.24) ** 2) / 0.024) * 0.30;
        const mcpWaist = Math.exp(-((t - 0.58) ** 2) / 0.012) * 0.12;
        const jointSoftening = Math.exp(-((t - 0.78) ** 2) / 0.018) * 0.08;
        const distalTaper = isThumb
            ? 1 - t * 0.40
            : 1 - t * 0.54;
        const width = baseWidth * (distalTaper + palmBulge - mcpWaist + jointSoftening);
        widths.push(Math.max(baseWidth * 0.28, width));
    }
    return widths;
}

function sampleBezierSpline(points, stepsPerSegment = 8) {
    const samples = [];
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        const cp1 = {
            x: p1.x + (p2.x - p0.x) / 6,
            y: p1.y + (p2.y - p0.y) / 6,
        };
        const cp2 = {
            x: p2.x - (p3.x - p1.x) / 6,
            y: p2.y - (p3.y - p1.y) / 6,
        };
        for (let step = 0; step < stepsPerSegment; step++) {
            if (i > 0 || step > 0) {
                const t = step / stepsPerSegment;
                samples.push(cubicBezierPoint(p1, cp1, cp2, p2, t));
            } else {
                samples.push(p1);
            }
        }
    }
    samples.push(points[points.length - 1]);
    return samples;
}

function cubicBezierPoint(a, b, c, d, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    return {
        x: a.x * mt2 * mt + b.x * 3 * mt2 * t + c.x * 3 * mt * t2 + d.x * t2 * t,
        y: a.y * mt2 * mt + b.y * 3 * mt2 * t + c.y * 3 * mt * t2 + d.y * t2 * t,
    };
}

function drawTendonRibbon(ctx, samples, widths, style) {
    if (samples.length < 2) return;
    const offset = style.offset || { x: 0, y: 0 };
    const left = [];
    const right = [];

    samples.forEach((point, index) => {
        const prev = samples[Math.max(0, index - 1)];
        const next = samples[Math.min(samples.length - 1, index + 1)];
        const tangent = normalizeVector({ x: next.x - prev.x, y: next.y - prev.y }, { x: 0, y: -1 });
        const normal = perpendicularVector(tangent);
        const width = Array.isArray(widths) ? widths[index] : widths;
        const half = width / 2;
        const x = point.x + offset.x;
        const y = point.y + offset.y;
        left.push({ x: x + normal.x * half, y: y + normal.y * half });
        right.push({ x: x - normal.x * half, y: y - normal.y * half });
    });

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fillStyle = style.fill;
    ctx.fill();
    if (style.stroke) {
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.lineWidth ?? 1;
        ctx.stroke();
    }

    const start = samples[0];
    const end = samples[samples.length - 1];
    const startWidth = Array.isArray(widths) ? widths[0] : widths;
    const endWidth = Array.isArray(widths) ? widths[widths.length - 1] : widths;
    ctx.fillStyle = style.fill;
    ctx.beginPath();
    ctx.arc(start.x + offset.x, start.y + offset.y, startWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(end.x + offset.x, end.y + offset.y, endWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawTendonEdgeContour(ctx, samples, widths, color, lineWidth) {
    if (samples.length < 2) return;
    const left = [];
    const right = [];
    samples.forEach((point, index) => {
        const prev = samples[Math.max(0, index - 1)];
        const next = samples[Math.min(samples.length - 1, index + 1)];
        const tangent = normalizeVector({ x: next.x - prev.x, y: next.y - prev.y }, { x: 0, y: -1 });
        const normal = perpendicularVector(tangent);
        const half = widths[index] * 0.46;
        left.push({ x: point.x + normal.x * half, y: point.y + normal.y * half });
        right.push({ x: point.x - normal.x * half, y: point.y - normal.y * half });
    });
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.35, lineWidth);
    [left, right].forEach((edge) => {
        ctx.beginPath();
        ctx.moveTo(edge[0].x, edge[0].y);
        for (let i = 1; i < edge.length; i++) ctx.lineTo(edge[i].x, edge[i].y);
        ctx.stroke();
    });
    ctx.restore();
}

function drawTendonCenterHighlight(ctx, samples, width, color) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(samples[0].x, samples[0].y);
    for (let i = 1; i < samples.length; i++) ctx.lineTo(samples[i].x, samples[i].y);
    ctx.stroke();
    ctx.restore();
}

// Temporarily disabled while Muscles View is rebuilt one layer at a time.
// eslint-disable-next-line no-unused-vars
function taperedMusclePoints(a, b, startWidth, midWidth, endWidth, bow = 0) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 2) return [a, b];
    const nx = -dy / len;
    const ny = dx / len;
    const center = {
        x: (a.x + b.x) / 2 + nx * bow,
        y: (a.y + b.y) / 2 + ny * bow,
    };
    return [
        { x: a.x + nx * startWidth, y: a.y + ny * startWidth },
        { x: center.x + nx * midWidth, y: center.y + ny * midWidth },
        { x: b.x + nx * endWidth, y: b.y + ny * endWidth },
        { x: b.x - nx * endWidth, y: b.y - ny * endWidth },
        { x: center.x - nx * midWidth, y: center.y - ny * midWidth },
        { x: a.x - nx * startWidth, y: a.y - ny * startWidth },
    ];
}

// eslint-disable-next-line no-unused-vars
function organicMusclePadPoints(center, axis, longRadius, shortRadius, skew = 0) {
    const ux = axis.x;
    const uy = axis.y;
    const nx = -uy;
    const ny = ux;
    const factors = [0.78, 0.96, 1.08, 1.0, 0.88, 1.05, 0.94, 0.82, 0.90, 1.02, 0.95, 0.84];
    return factors.map((factor, index) => {
        const t = (index / factors.length) * Math.PI * 2;
        const long = Math.cos(t) * longRadius * factor;
        const short = Math.sin(t) * shortRadius * (1 + Math.sin(t * 2.0) * 0.08);
        const taper = Math.sin(t) * longRadius * skew;
        return {
            x: center.x + ux * (long + taper) + nx * short,
            y: center.y + uy * (long + taper) + ny * short,
        };
    });
}

function drawAnatomicalMuscleMass(ctx, points, options) {
    if (!points.length) return;
    const center = averagePoints(points);
    const radius = Math.max(...points.map(point => dist(point, center)), 1);
    const fiberCount = options.fiberCount ?? 7;
    const fiberSpread = options.fiberSpread ?? radius * 0.55;

    ctx.save();
    ctx.globalAlpha *= options.alpha ?? 0.74;
    if (options.feather) {
        ctx.save();
        ctx.globalAlpha *= options.featherAlpha ?? 0.34;
        ctx.shadowColor = 'rgba(38, 12, 14, 0.28)';
        ctx.shadowBlur = 10 * (options.scale ?? 1);
        roundedClosedPath(ctx, expandPolygon(points, center, options.featherScale ?? 1.035));
        ctx.fillStyle = options.featherColor || 'rgba(112, 46, 48, 0.34)';
        ctx.fill();
        ctx.restore();
    }
    const grad = ctx.createRadialGradient(
        center.x - radius * 0.28,
        center.y - radius * 0.24,
        radius * 0.08,
        center.x,
        center.y,
        radius * 1.15
    );
    grad.addColorStop(0, options.light);
    grad.addColorStop(0.42, options.mid);
    grad.addColorStop(1, options.dark);
    roundedClosedPath(ctx, points);
    ctx.fillStyle = grad;
    ctx.shadowColor = `rgba(44, 18, 16, ${options.shadowAlpha ?? 0.34})`;
    ctx.shadowBlur = 7 * (options.scale ?? 1);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(86, 34, 36, ${options.strokeAlpha ?? 0.48})`;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.save();
    roundedClosedPath(ctx, points);
    ctx.clip();
    const sideShade = ctx.createLinearGradient(center.x - radius, center.y - radius * 0.25, center.x + radius, center.y + radius * 0.25);
    sideShade.addColorStop(0, 'rgba(64, 24, 24, 0.28)');
    sideShade.addColorStop(0.38, 'rgba(255, 206, 186, 0.18)');
    sideShade.addColorStop(0.62, 'rgba(255, 228, 208, 0.10)');
    sideShade.addColorStop(1, 'rgba(62, 23, 25, 0.24)');
    ctx.fillStyle = sideShade;
    ctx.fillRect(center.x - radius * 1.2, center.y - radius * 1.2, radius * 2.4, radius * 2.4);
    ctx.restore();

    if (options.fiberA && options.fiberB) {
        ctx.save();
        roundedClosedPath(ctx, points);
        ctx.clip();
        drawMuscleFibers(ctx, options.fiberA, options.fiberB, fiberSpread, fiberCount, options.scale ?? 1);
        ctx.restore();
    }
    ctx.restore();
}

function roundedClosedPath(ctx, points) {
    ctx.beginPath();
    points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        const midPoint = mid(point, next);
        if (index === 0) ctx.moveTo(midPoint.x, midPoint.y);
        else ctx.quadraticCurveTo(point.x, point.y, midPoint.x, midPoint.y);
    });
    ctx.closePath();
}

function expandPolygon(points, center, amount) {
    return points.map(point => ({
        x: center.x + (point.x - center.x) * amount,
        y: center.y + (point.y - center.y) * amount,
    }));
}

function drawMuscleFibers(ctx, a, b, spread, count, scale) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 2) return;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -dy / len;
    const ny = dx / len;
    const seed = 0.73; // Stable texture while the tracked hand moves.
    ctx.save();
    ctx.globalAlpha *= 0.70;
    ctx.strokeStyle = 'rgba(246, 184, 168, 0.62)';
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1);
        const offset = (t - 0.5) * spread;
        const startAdvance = 0.025 + ((i * 0.37 + seed) % 1) * 0.070;
        const endRetreat = 0.040 + ((i * 0.23 + seed * 0.5) % 1) * 0.095;
        const start = {
            x: a.x + ux * len * startAdvance + nx * offset,
            y: a.y + uy * len * startAdvance + ny * offset,
        };
        const end = {
            x: b.x - ux * len * endRetreat + nx * offset * (0.48 + Math.sin(seed + i) * 0.05),
            y: b.y - uy * len * endRetreat + ny * offset * (0.48 + Math.sin(seed + i) * 0.05),
        };
        const control = {
            x: mid(start, end).x + nx * Math.sin(seed + i * 1.9) * scale * 1.6,
            y: mid(start, end).y + ny * Math.sin(seed + i * 1.9) * scale * 1.6,
        };
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(88, 37, 36, 0.42)' : 'rgba(246, 193, 178, 0.65)';
        ctx.lineWidth = Math.max(0.42, (0.48 + (i % 3) * 0.07) * scale);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
        ctx.stroke();
    }
    ctx.restore();
}

function drawInterosseousBand(ctx, a, b, endWidth, midWidth) {
    const axis = normalizeVector({ x: b.x - a.x, y: b.y - a.y }, { x: 0, y: -1 });
    const normal = perpendicularVector(axis);
    const control = movePoint(mid(a, b), normal, Math.sin(a.x * 0.013 + b.y * 0.017) * midWidth * 0.18);
    drawIntrinsicMuscleRibbon(ctx, [a, control, b], {
        startWidth: Math.max(1.1, endWidth * 0.82),
        midWidth,
        endWidth: Math.max(1.2, endWidth),
        alpha: 0.86,
        tone: 'deep',
    });
}

function drawLumbricalMuscle(ctx, a, control, b, endWidth, midWidth, alpha) {
    drawIntrinsicMuscleRibbon(ctx, [a, control, b], {
        startWidth: Math.max(1.25, endWidth * 0.76),
        midWidth,
        endWidth,
        alpha,
        tone: 'lumbrical',
    });
}

function drawIntrinsicMuscleRibbon(ctx, points, options = {}) {
    if (points.length < 2) return;
    const samples = sampleBezierSpline(points, 10);
    const widthProfile = createMuscleWidthProfile(
        samples.length,
        options.startWidth ?? 2,
        options.midWidth ?? 5,
        options.endWidth ?? 2
    );
    const palette = options.tone === 'deep'
        ? {
            shadow: 'rgba(58, 24, 28, 0.26)',
            fill: 'rgba(128, 54, 58, 0.92)',
            highlight: 'rgba(211, 116, 105, 0.28)',
            edge: 'rgba(82, 34, 38, 0.30)',
        }
        : {
            shadow: 'rgba(66, 26, 30, 0.26)',
            fill: 'rgba(173, 67, 67, 0.94)',
            highlight: 'rgba(233, 142, 126, 0.31)',
            edge: 'rgba(97, 37, 41, 0.32)',
        };

    ctx.save();
    ctx.globalAlpha *= options.alpha ?? 0.72;
    drawTendonRibbon(ctx, samples, widthProfile.map(width => width + 2.2), {
        fill: palette.shadow,
        offset: { x: 0.65, y: 0.95 },
    });
    const bellyCenter = samples[Math.floor(samples.length / 2)];
    const bellyRadius = Math.max(...widthProfile);
    const volume = ctx.createRadialGradient(
        bellyCenter.x - bellyRadius * 0.25, bellyCenter.y - bellyRadius * 0.25, 0,
        bellyCenter.x, bellyCenter.y, Math.max(dist(points[0], points[points.length - 1]) * 0.65, bellyRadius)
    );
    volume.addColorStop(0, options.tone === 'deep' ? '#c47c70' : '#dc9180');
    volume.addColorStop(0.45, palette.fill);
    volume.addColorStop(1, '#642f36');
    drawTendonRibbon(ctx, samples, widthProfile, {
        fill: volume,
        stroke: palette.edge,
        lineWidth: 0.45,
    });
    drawTendonRibbon(ctx, samples, widthProfile.map(width => Math.max(0.72, width * 0.55)), {
        fill: palette.highlight,
    });
    drawTendonEdgeContour(ctx, samples, widthProfile, palette.edge, 0.38);
    drawTendonCenterHighlight(ctx, samples, Math.max(0.36, Math.max(...widthProfile) * 0.04), 'rgba(250, 188, 172, 0.12)');
    ctx.restore();
}

function createMuscleWidthProfile(count, startWidth, midWidth, endWidth) {
    const widths = [];
    for (let index = 0; index < count; index++) {
        const t = count <= 1 ? 0 : index / (count - 1);
        const linear = startWidth + (endWidth - startWidth) * t;
        const belly = Math.sin(Math.PI * t) ** 0.82;
        widths.push(linear + (midWidth - linear) * belly);
    }
    return widths;
}

// eslint-disable-next-line no-unused-vars
function drawFlexorTendonPath(ctx, points, scale, options = {}) {
    if (points.length < 2) return;
    const width = options.thumb
        ? (options.referenceStyle ? 2.85 : 3.15) * scale
        : options.deep
            ? (options.referenceStyle ? 1.65 : 1.9) * scale
            : (options.referenceStyle ? 2.45 : 2.75) * scale;
    const coreWidth = Math.max(0.95, width * 0.50);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha *= options.deep ? 0.72 : 0.88;
    ctx.strokeStyle = options.deep
        ? 'rgba(218, 209, 193, 0.52)'
        : 'rgba(232, 219, 200, 0.70)';
    ctx.lineWidth = width;
    if (options.taper) drawTaperedSmoothPath(ctx, points, width, width * 0.45);
    else {
        drawSmoothPolyline(ctx, points);
        ctx.stroke();
    }

    ctx.globalAlpha *= options.deep ? 0.88 : 0.96;
    ctx.strokeStyle = options.deep
        ? 'rgba(244, 235, 220, 0.78)'
        : 'rgba(252, 244, 228, 0.94)';
    ctx.lineWidth = coreWidth;
    if (options.taper) drawTaperedSmoothPath(ctx, points, coreWidth, Math.max(0.65, coreWidth * 0.52));
    else {
        drawSmoothPolyline(ctx, points);
        ctx.stroke();
    }

    if (!options.deep && points.length >= 4) {
        const split = points[points.length - 3];
        const end = points[points.length - 2];
        const dx = end.x - split.x;
        const dy = end.y - split.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / len;
        const ny = dx / len;
        ctx.globalAlpha *= 0.70;
        ctx.lineWidth = Math.max(0.55, coreWidth * 0.58);
        [-1, 1].forEach((side) => {
            ctx.beginPath();
            ctx.moveTo(split.x, split.y);
            ctx.quadraticCurveTo(
                mid(split, end).x + nx * side * 2.4 * scale,
                mid(split, end).y + ny * side * 2.4 * scale,
                end.x + nx * side * 2.2 * scale,
                end.y + ny * side * 2.2 * scale
            );
            ctx.stroke();
        });
    }
    ctx.restore();
}

// eslint-disable-next-line no-unused-vars
function drawCentralFlexorBundle(ctx, origin, fingerMcps, scale, alpha) {
    const palmCenter = averagePoints(fingerMcps);
    const centerPath = [
        moveToward(origin, palmCenter, -0.28),
        origin,
        moveToward(origin, palmCenter, 0.38),
    ];
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(226, 211, 193, 0.56)';
    ctx.lineWidth = 8.2 * scale;
    drawSmoothPolyline(ctx, centerPath);
    ctx.stroke();

    ctx.globalAlpha *= 0.88;
    ctx.strokeStyle = 'rgba(252, 244, 228, 0.82)';
    ctx.lineWidth = 2.6 * scale;
    fingerMcps.forEach((mcp, index) => {
        const laneOffset = (index - 1.5) * 0.55 * scale;
        drawSmoothPolyline(ctx, [
            { x: centerPath[0].x + laneOffset, y: centerPath[0].y },
            { x: origin.x + laneOffset, y: origin.y },
            moveToward(origin, mcp, 0.34),
        ]);
        ctx.stroke();
    });
    ctx.restore();
}

function drawTaperedSmoothPath(ctx, points, startWidth, endWidth) {
    if (points.length < 2) return;
    const originalWidth = ctx.lineWidth;
    for (let i = 0; i < points.length - 1; i++) {
        const t = points.length === 2 ? 0 : i / (points.length - 2);
        ctx.lineWidth = startWidth + (endWidth - startWidth) * t;
        const a = points[i];
        const b = points[i + 1];
        const control = i < points.length - 2 ? points[i + 1] : mid(a, b);
        const end = i < points.length - 2 ? mid(points[i + 1], points[i + 2]) : b;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
        ctx.stroke();
    }
    ctx.lineWidth = originalWidth;
}

// eslint-disable-next-line no-unused-vars
function drawTransverseCarpalLigament(ctx, radialPoint, ulnarPoint, palmPoint, scale, alpha) {
    const center = mid(radialPoint, ulnarPoint);
    const dx = ulnarPoint.x - radialPoint.x;
    const dy = ulnarPoint.y - radialPoint.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const curveTowardPalm = {
        x: center.x + (palmPoint.x - center.x) * 0.30,
        y: center.y + (palmPoint.y - center.y) * 0.30,
    };
    const width = 5.4 * scale;

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(224, 208, 190, 0.64)';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(radialPoint.x, radialPoint.y);
    ctx.quadraticCurveTo(curveTowardPalm.x, curveTowardPalm.y, ulnarPoint.x, ulnarPoint.y);
    ctx.stroke();

    ctx.globalAlpha *= 0.70;
    ctx.strokeStyle = 'rgba(252, 244, 228, 0.78)';
    ctx.lineWidth = Math.max(0.8, width * 0.22);
    for (let i = -2; i <= 2; i++) {
        const offset = i * width * 0.16;
        ctx.beginPath();
        ctx.moveTo(radialPoint.x + nx * offset, radialPoint.y + ny * offset);
        ctx.quadraticCurveTo(
            curveTowardPalm.x + nx * offset,
            curveTowardPalm.y + ny * offset,
            ulnarPoint.x + nx * offset,
            ulnarPoint.y + ny * offset
        );
        ctx.stroke();
    }
    ctx.restore();
}

// eslint-disable-next-line no-unused-vars
function drawBackHandAnatomy(ctx, anatomy) {
    const {
        wrist,
        thumbCmc,
        thumbMcp,
        thumbIp,
        thumbTip,
        fingerMcps,
        fingerPips,
        fingerDips,
        fingerTips,
        scale,
        lowConfidence,
        labels,
    } = anatomy;
    const centralDorsalWrist = moveToward(wrist, averagePoints(fingerMcps), 0.16);
    const dorsalPalm = moveToward(wrist, averagePoints(fingerMcps), 0.48);
    const tendonLabelAnchors = [];
    const hoodAnchors = [];

    fingerMcps.forEach((mcp, index) => {
        const entry = moveToward(centralDorsalWrist, mcp, 0.42);
        const path = [
            centralDorsalWrist,
            entry,
            mcp,
            fingerPips[index],
            fingerDips[index],
            fingerTips[index],
        ];
        drawExtensorTendonPath(ctx, path, scale, { alpha: lowConfidence ? 0.46 : 0.66 });
        drawExtensorHood(ctx, mcp, fingerPips[index], scale, lowConfidence ? 0.34 : 0.54);
        tendonLabelAnchors.push(mid(mcp, fingerPips[index]));
        hoodAnchors.push(moveToward(mcp, fingerPips[index], 0.22));
    });

    for (let i = 0; i < fingerMcps.length - 1; i++) {
        const gap = mid(fingerMcps[i], fingerMcps[i + 1]);
        const target = moveToward(gap, mid(fingerPips[i], fingerPips[i + 1]), 0.22);
        drawBipennateDorsalInterosseous(ctx, {
            baseA: estimateMetacarpalBase(wrist, fingerMcps[i], 0.40),
            baseB: estimateMetacarpalBase(wrist, fingerMcps[i + 1], 0.40),
            insertion: target,
            scale,
            alpha: lowConfidence ? 0.30 : 0.50,
        });
    }

    drawExtensorTendonPath(ctx, [
        moveToward(wrist, thumbCmc, 0.18),
        moveToward(thumbCmc, thumbMcp, 0.10),
        thumbMcp,
        thumbIp,
        thumbTip,
    ], scale, { thumb: true, alpha: lowConfidence ? 0.44 : 0.64 });
    drawExtensorTendonPath(ctx, [
        moveToward(wrist, thumbCmc, 0.10),
        thumbCmc,
        thumbMcp,
    ], scale, { thumb: true, alpha: lowConfidence ? 0.38 : 0.56 });
    drawExtensorTendonPath(ctx, [
        moveToward(wrist, thumbCmc, 0.02),
        moveToward(wrist, thumbCmc, 0.30),
        thumbCmc,
    ], scale, { thumb: true, alpha: lowConfidence ? 0.34 : 0.48 });

    labels.push(
        { text: 'Extensor digitorum tendons', point: averagePoints(tendonLabelAnchors), priority: 1, preferredSide: -1 },
        { text: 'Dorsal interossei', point: dorsalPalm, priority: 2 },
        { text: 'Extensor expansion / extensor hood', point: averagePoints(hoodAnchors), priority: 3 },
        { text: 'Extensor pollicis longus tendon', point: mid(thumbMcp, thumbIp), priority: 4, preferredSide: 1 },
        { text: 'Extensor pollicis brevis tendon', point: mid(thumbCmc, thumbMcp), priority: 5, preferredSide: 1 },
        { text: 'Abductor pollicis longus tendon', point: moveToward(wrist, thumbCmc, 0.35), priority: 6, preferredSide: 1 },
    );
    if (lowConfidence) {
        labels.push({ text: 'Low confidence - simplified overlay', point: dorsalPalm, priority: 0 });
    }
}

function drawExtensorTendonPath(ctx, points, scale, options = {}) {
    if (points.length < 2) return;
    const palmWidth = options.palmWidth ?? 120;
    const baseWidth = options.thumb
        ? clamp(palmWidth * 0.038, 4.1 * scale, 7.4 * scale)
        : clamp(palmWidth * 0.031, 3.4 * scale, 6.2 * scale);
    const samples = sampleBezierSpline(points, 9);
    const widthProfile = createDorsalTendonWidthProfile(samples.length, baseWidth, options.thumb);

    ctx.save();
    ctx.globalAlpha *= options.alpha ?? 0.94;
    drawTendonRibbon(ctx, samples, widthProfile.map(width => width + 1.9 * scale), {
        fill: 'rgba(48, 52, 52, 0.14)',
        offset: { x: 0.45 * scale, y: 0.7 * scale },
    });
    drawTendonRibbon(ctx, samples, widthProfile, {
        fill: 'rgba(232, 228, 217, 0.96)',
        stroke: 'rgba(126, 136, 132, 0.18)',
        lineWidth: 0.38 * scale,
    });
    drawTendonRibbon(ctx, samples, widthProfile.map(width => Math.max(0.85 * scale, width * 0.34)), {
        fill: 'rgba(255, 252, 242, 0.55)',
    });
    drawTendonEdgeContour(ctx, samples, widthProfile, 'rgba(76, 84, 84, 0.12)', 0.28 * scale);
    drawTendonCenterHighlight(ctx, samples, Math.max(0.34, baseWidth * 0.035), 'rgba(255, 255, 248, 0.10)');
    ctx.restore();
}

function createDorsalTendonWidthProfile(count, baseWidth, isThumb = false) {
    const widths = [];
    for (let index = 0; index < count; index++) {
        const t = count <= 1 ? 0 : index / (count - 1);
        const wristTaper = Math.min(1, t / 0.16) * 0.18;
        const mcpFan = Math.exp(-((t - 0.54) ** 2) / 0.030) * 0.16;
        const distalTaper = isThumb ? 1 - t * 0.34 : 1 - t * 0.46;
        widths.push(Math.max(baseWidth * 0.24, baseWidth * (distalTaper + wristTaper + mcpFan)));
    }
    return widths;
}

function drawExtensorHood(ctx, mcp, pip, scale, alpha) {
    const center = moveToward(mcp, pip, 0.22);
    const dx = pip.x - mcp.x;
    const dy = pip.y - mcp.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const hoodLength = 12 * scale;
    const hoodWidth = 5.8 * scale;

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = 'rgba(246, 242, 236, 0.34)';
    ctx.strokeStyle = 'rgba(255, 255, 250, 0.56)';
    ctx.lineWidth = Math.max(0.65, 0.75 * scale);
    ctx.beginPath();
    ctx.moveTo(center.x - ux * hoodLength * 0.50, center.y - uy * hoodLength * 0.50);
    ctx.quadraticCurveTo(
        center.x + nx * hoodWidth,
        center.y + ny * hoodWidth,
        center.x + ux * hoodLength * 0.35,
        center.y + uy * hoodLength * 0.35
    );
    ctx.quadraticCurveTo(
        center.x - nx * hoodWidth,
        center.y - ny * hoodWidth,
        center.x - ux * hoodLength * 0.50,
        center.y - uy * hoodLength * 0.50
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Three fine fascicle marks make the expansion read as a dorsal hood rather
    // than a single opaque leaf, while remaining subtle enough for live video.
    ctx.globalAlpha *= 0.56;
    ctx.strokeStyle = 'rgba(224, 229, 220, 0.52)';
    ctx.lineWidth = Math.max(0.34, 0.42 * scale);
    [-0.46, 0, 0.46].forEach((spread) => {
        ctx.beginPath();
        ctx.moveTo(
            center.x - ux * hoodLength * 0.36,
            center.y - uy * hoodLength * 0.36
        );
        ctx.quadraticCurveTo(
            center.x + nx * hoodWidth * spread,
            center.y + ny * hoodWidth * spread,
            center.x + ux * hoodLength * 0.30 + nx * hoodWidth * spread * 0.32,
            center.y + uy * hoodLength * 0.30 + ny * hoodWidth * spread * 0.32
        );
        ctx.stroke();
    });
    ctx.restore();
}

function drawBipennateDorsalInterosseous(ctx, { baseA, baseB, insertion, scale, alpha }) {
    const sharedBelly = moveToward(mid(baseA, baseB), insertion, 0.48);
    const axis = normalizeVector({
        x: insertion.x - sharedBelly.x,
        y: insertion.y - sharedBelly.y,
    }, { x: 0, y: -1 });
    const normal = perpendicularVector(axis);
    const halfGap = Math.min(10 * scale, dist(baseA, baseB) * 0.22);
    const headAControl = movePoint(moveToward(baseA, sharedBelly, 0.58), normal, halfGap * 0.58);
    const headBControl = movePoint(moveToward(baseB, sharedBelly, 0.58), normal, -halfGap * 0.58);
    const convergence = moveToward(sharedBelly, insertion, 0.18);

    ctx.save();
    ctx.globalAlpha *= alpha;
    drawIntrinsicMuscleRibbon(ctx, [baseA, headAControl, convergence], {
        startWidth: Math.max(1.4, 2.2 * scale),
        midWidth: Math.max(4.7, 6.3 * scale),
        endWidth: Math.max(1.25, 1.8 * scale),
        alpha: 0.92,
        tone: 'deep',
    });
    drawIntrinsicMuscleRibbon(ctx, [baseB, headBControl, convergence], {
        startWidth: Math.max(1.4, 2.2 * scale),
        midWidth: Math.max(4.7, 6.3 * scale),
        endWidth: Math.max(1.25, 1.8 * scale),
        alpha: 0.82,
        tone: 'deep',
    });
    ctx.globalAlpha *= 0.70;
    ctx.strokeStyle = 'rgba(242, 167, 150, 0.32)';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.45, 0.65 * scale);
    ctx.beginPath();
    ctx.moveTo(sharedBelly.x, sharedBelly.y);
    ctx.quadraticCurveTo(
        moveToward(sharedBelly, insertion, 0.52).x,
        moveToward(sharedBelly, insertion, 0.52).y,
        insertion.x,
        insertion.y
    );
    ctx.stroke();
    ctx.restore();
    return sharedBelly;
}

function drawSmoothPolyline(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
        const control = points[i];
        const next = mid(points[i], points[i + 1]);
        ctx.quadraticCurveTo(control.x, control.y, next.x, next.y);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
}

function drawMuscleLabels(ctx, labels, labelMode, bounds, anatomyAvoidRegion = null) {
    if (labelMode === 'off') return [];
    const groupedPriority = new Map([
        ['Flexor tendon paths', 1],
        ['Extensor tendon paths', 1],
        ['Thenar muscles', 2],
        ['Hypothenar muscles', 3],
        ['Lumbricals', 4],
        ['Palmar interossei', 5],
        ['Dorsal interossei', 5],
        ['Extensor digitorum tendons', 6],
        ['Extensor pollicis tendon', 7],
        ['Extensor hood', 8],
        ['Extensor expansion / extensor hood', 8],
        ['Low confidence - simplified overlay', 1],
    ]);
    const groupedLabels = labels
        .filter(label => groupedPriority.has(label.text))
        .map(label => ({ ...label, priority: groupedPriority.get(label.text) ?? label.priority }));
    const detailLabels = labels
        .filter(label => !groupedPriority.has(label.text))
        .map(label => ({ ...label, priority: (label.priority ?? 9) + 30 }));
    const visibleLabels = labelMode === 'detailed'
        ? [...groupedLabels, ...detailLabels]
        : groupedLabels;
    const labelPoints = visibleLabels.map(label => label.point).filter(Boolean);
    const avoidRegion = anatomyAvoidRegion || getLabelAvoidRegion(labelPoints, bounds);
    const layouts=drawSmartLabels(ctx, visibleLabels.filter(label => label.point), bounds, {
        maxLabels: labelMode === 'detailed' ? 12 : 5,
        theme: 'medical',
        keepLeadersShort: true,
        outwardFromCenter: true,
        avoidRegion,
    });
    return layouts.map(label=>muscleLabelTarget(label.text,label.rect)).filter(Boolean);
}

function createMuscleLabelAvoidRegion({ wrist, thumbCmc, fingerMcps, fingerPips, palmWidth, bounds }) {
    const points = [
        wrist,
        thumbCmc,
        ...fingerMcps,
        ...fingerPips.map((pip, index) => moveToward(fingerMcps[index], pip, 0.34)),
    ];
    const padX = Math.max(42, palmWidth * 0.24);
    const padY = Math.max(30, palmWidth * 0.18);
    const left = clamp(Math.min(...points.map(point => point.x)) - padX, bounds.left, bounds.right);
    const right = clamp(Math.max(...points.map(point => point.x)) + padX, bounds.left, bounds.right);
    const top = clamp(Math.min(...points.map(point => point.y)) - padY, bounds.top, bounds.bottom);
    const bottom = clamp(Math.max(...points.map(point => point.y)) + padY, bounds.top, bounds.bottom);
    return {
        left,
        right,
        top,
        bottom,
        centerX: (left + right) / 2,
    };
}

function getLabelAvoidRegion(points, bounds) {
    if (!points.length) return null;
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const padX = 54;
    const padY = 38;
    return {
        left: clamp(Math.min(...xs) - padX, bounds.left, bounds.right),
        right: clamp(Math.max(...xs) + padX, bounds.left, bounds.right),
        top: clamp(Math.min(...ys) - padY, bounds.top, bounds.bottom),
        bottom: clamp(Math.max(...ys) + padY, bounds.top, bounds.bottom),
        centerX: xs.reduce((sum, x) => sum + x, 0) / xs.length,
    };
}

export function drawStylizedHandBones(ctx, landmarks, w, h, options = {}) {
    const p = (i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
    const wrist = p(HAND.WRIST);
    const thumbCmc = p(HAND.THUMB_CMC);
    const thumbMcp = p(HAND.THUMB_MCP);
    const thumbIp = p(HAND.THUMB_IP);
    const thumbTip = p(HAND.THUMB_TIP);
    const indexMcp = p(HAND.INDEX_MCP);
    const middleMcp = p(HAND.MIDDLE_MCP);
    const ringMcp = p(HAND.RING_MCP);
    const pinkyMcp = p(HAND.PINKY_MCP);
    const palmWidth = Math.max(24, dist(indexMcp, pinkyMcp));
    const palmLength = Math.max(32, dist(wrist, middleMcp));
    const scale = Math.max(0.62, (palmWidth + palmLength) / 210);
    const bones = [];
    const labelAnchors = {};
    const labelMode = options.labelMode || 'off';
    const effectiveLabelMode = options.isUncertain && labelMode === 'detailed' ? 'clean' : labelMode;
    const wristMode = options.wristMode || 'simple';
    const bounds = options.visibleBounds || {
        left: 18,
        top: 18,
        right: w - 18,
        bottom: h - 18,
    };

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // Educational wrist model:
    // - Uses visible wrist/thumb/pinky/MCP landmarks to estimate radial (thumb)
    //   and ulnar (pinky) sides, so left/right hands mirror naturally.
    // - The webcam image may be visually mirrored, but these coordinates are
    //   already in displayed video space; carpal placement follows the visible
    //   thumb side rather than the handedness text.
    // - These are approximate teaching anchors, not actual X-ray bone detection.
    const carpalInfo = createCarpalLayout({
        wrist,
        thumbCmc,
        indexMcp,
        middleMcp,
        ringMcp,
        pinkyMcp,
        scale,
    });
    const metacarpalBases = createMetacarpalBaseAnchors(carpalInfo, {
        thumbCmc,
        thumbMcp,
        indexMcp,
        middleMcp,
        ringMcp,
        pinkyMcp,
    });
    // The source video has clear articular material between the individual bones.
    // These are visual teaching surfaces inferred from landmark connections, not
    // cartilage detected through skin. Drawing them first lets the bone ends frame
    // the joint space instead of turning the skeleton into a bead-and-line rig.
    const articulations = createHandArticulations({
        carpalInfo,
        metacarpalBases,
        thumbMcp,
        thumbIp,
        thumbTip,
        indexChain: [indexMcp, p(HAND.INDEX_PIP), p(HAND.INDEX_DIP), p(HAND.INDEX_TIP)],
        middleChain: [middleMcp, p(HAND.MIDDLE_PIP), p(HAND.MIDDLE_DIP), p(HAND.MIDDLE_TIP)],
        ringChain: [ringMcp, p(HAND.RING_PIP), p(HAND.RING_DIP), p(HAND.RING_TIP)],
        pinkyChain: [pinkyMcp, p(HAND.PINKY_PIP), p(HAND.PINKY_DIP), p(HAND.PINKY_TIP)],
        scale,
    });
    carpalInfo.bones.forEach((carpal) => {
        drawCarpalAnatomyNode(ctx, carpal);
        bones.push({
            type: 'node',
            id: `carpal-${carpal.id}`,
            name: `${carpal.letter} · ${carpal.name}`,
            label: carpal.name,
            letter: carpal.letter,
            group: 'Carpal bone',
            finger: 'Wrist',
            segment: 'carpal bone',
            center: carpal.center,
            radius: Math.max(carpal.rx, carpal.ry) + 9,
            labelPoint: carpal.labelPoint || carpal.center,
            location: carpal.location,
            explanation: `${carpal.name} is shown in an approximate educational wrist position based on visible hand landmarks.`,
        });
    });
    // Educational landmark-to-bone mapping:
    // - Thumb metacarpal uses landmark 1 -> 2 (CMC/base to MCP).
    // - Thumb has only proximal and distal phalanges, so no middle phalanx is drawn.
    // - Each metacarpal leaves a matching distal-row carpal instead of fanning from
    //   one wrist point: trapezium -> thumb, trapezoid -> index, capitate -> middle,
    //   and hamate -> ring/pinky. The visible landmarks still determine the final
    //   alignment; this only improves the educational palm-base silhouette.
    // - Carpals are a simple cluster, not an X-ray-accurate diagnosis.
    addBone({
        id: 'thumb-metacarpal',
        name: 'Thumb metacarpal / 1st metacarpal',
        label: 'Thumb: 1st metacarpal',
        group: 'Metacarpal',
        finger: 'Thumb',
        segment: 'metacarpal',
        from: metacarpalBases.thumb,
        to: thumbMcp,
        start: 10.1,
        end: 12.8,
        midScale: 1.04,
        alpha: 0.78,
    });
    [
        ['index-metacarpal', 'Index metacarpal / 2nd metacarpal', 'Index: 2nd metacarpal', 'Index', metacarpalBases.index, indexMcp, 10.0, 13.0],
        ['middle-metacarpal', 'Middle metacarpal / 3rd metacarpal', 'Middle: 3rd metacarpal', 'Middle', metacarpalBases.middle, middleMcp, 10.8, 14.2],
        ['ring-metacarpal', 'Ring metacarpal / 4th metacarpal', 'Ring: 4th metacarpal', 'Ring', metacarpalBases.ring, ringMcp, 10.1, 13.1],
        ['pinky-metacarpal', 'Pinky metacarpal / 5th metacarpal', 'Pinky: 5th metacarpal', 'Pinky', metacarpalBases.pinky, pinkyMcp, 9.2, 11.8],
    ].forEach(([id, name, label, finger, from, to, start, end]) => addBone({
        id,
        name,
        label,
        group: 'Metacarpal',
        finger,
        segment: 'metacarpal',
        from,
        to,
        start,
        end,
        midScale: 1.04,
        alpha: 0.78,
    }));
    labelAnchors.metacarpals = mid(indexMcp, ringMcp);

    addBone({
        id: 'thumb-proximal-phalanx',
        name: 'Thumb: proximal phalanx',
        label: 'Thumb: proximal phalanx',
        group: 'Phalanx',
        finger: 'Thumb',
        segment: 'proximal phalanx',
        from: thumbMcp,
        to: thumbIp,
        start: 9.6,
        end: 8.0,
        midScale: 1.04,
    });
    addBone({
        id: 'thumb-distal-phalanx',
        name: 'Thumb: distal phalanx',
        label: 'Thumb: distal phalanx',
        group: 'Phalanx',
        finger: 'Thumb',
        segment: 'distal phalanx',
        from: thumbIp,
        to: thumbTip,
        start: 7.7,
        end: 6.0,
        midScale: 1.02,
    });
    labelAnchors.thumbMetacarpal = mid(thumbCmc, thumbMcp);
    labelAnchors.thumbProximal = mid(thumbMcp, thumbIp);
    labelAnchors.thumbDistal = mid(thumbIp, thumbTip);

    drawFingerBones('index', 'Index', [HAND.INDEX_MCP, HAND.INDEX_PIP, HAND.INDEX_DIP, HAND.INDEX_TIP], 1);
    drawFingerBones('middle', 'Middle', [HAND.MIDDLE_MCP, HAND.MIDDLE_PIP, HAND.MIDDLE_DIP, HAND.MIDDLE_TIP], 1);
    drawFingerBones('ring', 'Ring', [HAND.RING_MCP, HAND.RING_PIP, HAND.RING_DIP, HAND.RING_TIP], 1);
    drawFingerBones('pinky', 'Pinky', [HAND.PINKY_MCP, HAND.PINKY_PIP, HAND.PINKY_DIP, HAND.PINKY_TIP], 0.9);
    labelAnchors.proximal = mid(p(HAND.MIDDLE_MCP), p(HAND.MIDDLE_PIP));
    labelAnchors.middle = mid(p(HAND.INDEX_PIP), p(HAND.INDEX_DIP));
    labelAnchors.distal = mid(p(HAND.RING_DIP), p(HAND.RING_TIP));

    // The expanded articular ends of adjacent bone silhouettes define the joints.
    // No generic glowing nodes are added here: they made the hand look like a rig
    // rather than an anatomical skeleton and obscured the natural joint spaces.

    drawBoneLabels(ctx, bones, labelAnchors, effectiveLabelMode, bounds);
    if (wristMode !== 'off') bones.push(...drawCarpalLetters(ctx, bones, bounds));

    ctx.restore();
    return { bones, articulations };

    function drawFingerBones(idPrefix, finger, chain, widthFactor = 1) {
        const widths = [[9.2, 7.8], [7.5, 6.3], [6.1, 5.1]];
        const segments = ['proximal phalanx', 'middle phalanx', 'distal phalanx'];
        for (let i = 0; i < chain.length - 1; i++) {
            const [start, end] = widths[i] || widths[widths.length - 1];
            addBone({
                id: `${idPrefix}-${segments[i].replaceAll(' ', '-')}`,
                name: `${finger}: ${segments[i]}`,
                label: `${finger}: ${segments[i]}`,
                group: 'Phalanx',
                finger,
                segment: segments[i],
                from: p(chain[i]),
                to: p(chain[i + 1]),
                start: start * widthFactor,
                end: end * widthFactor,
                midScale: i === 0 ? 1.04 : 1.02,
            });
        }
    }

    function addBone({ id, name, label, group, finger, segment, from, to, start, end, midScale = 1.12, alpha = 0.82 }) {
        const startWidth = start * scale;
        const endWidth = end * scale;
        drawRealisticBoneSegment(ctx, from, to, {
            startWidth,
            endWidth,
            midScale,
            alpha,
            boneType: getBoneRenderType(finger, segment, group),
        });
        const labelPoint = mid(from, to);
        labelAnchors[id] = labelPoint;
        bones.push({
            type: 'segment',
            id,
            name,
            label: label || name,
            group,
            finger,
            segment,
            from,
            to,
            labelPoint,
            radius: Math.max(startWidth, endWidth) * Math.max(midScale, 1) + 10,
            location: describeBoneLocation(finger, segment, id),
            explanation: describeBone(finger, segment, group),
        });
    }
}

function estimateMetacarpalBase(wrist, mcp, amount) {
    return {
        x: wrist.x + (mcp.x - wrist.x) * amount,
        y: wrist.y + (mcp.y - wrist.y) * amount,
    };
}

function createMetacarpalBaseAnchors(carpalInfo, landmarks) {
    const carpalsById = new Map(carpalInfo.bones.map((carpal) => [carpal.id, carpal]));

    // The detector cannot see a carpal-metacarpal joint through the palm. These
    // anchors therefore use the visible MCP rays to leave the appropriate distal
    // carpal, keeping the palm structured without pretending to be an X-ray.
    function leaveCarpal(carpalId, mcp) {
        const carpal = carpalsById.get(carpalId);
        if (!carpal) return mcp;
        const dx = mcp.x - carpal.center.x;
        const dy = mcp.y - carpal.center.y;
        const length = Math.hypot(dx, dy);
        if (length < 0.001) return carpal.center;
        const outerRadius = Math.max(carpal.rx, carpal.ry);
        const exitDistance = Math.min(length * 0.24, outerRadius * 0.92 + length * 0.065);
        return {
            x: carpal.center.x + dx / length * exitDistance,
            y: carpal.center.y + dy / length * exitDistance,
        };
    }

    const thumbCarpalExit = leaveCarpal('trapezium', landmarks.thumbMcp);
    return {
        // The thumb CMC landmark remains part of the anchor to keep the first
        // metacarpal locked to the tracked thumb while visually joining trapezium.
        thumb: moveToward(landmarks.thumbCmc, thumbCarpalExit, 0.48),
        index: leaveCarpal('trapezoid', landmarks.indexMcp),
        middle: leaveCarpal('capitate', landmarks.middleMcp),
        ring: leaveCarpal('hamate', landmarks.ringMcp),
        pinky: leaveCarpal('hamate', landmarks.pinkyMcp),
    };
}

function createHandArticulations({
    carpalInfo,
    metacarpalBases,
    thumbMcp,
    thumbIp,
    thumbTip,
    indexChain,
    middleChain,
    ringChain,
    pinkyChain,
    scale,
}) {
    const carpalById = new Map(carpalInfo.bones.map((carpal) => [carpal.id, carpal]));
    const articulations = [];

    function addArticulation(id, parent, joint, child, type, size = 1) {
        if (!parent || !joint || !child) return;
        const outgoing = normalizeVector({ x: child.x - joint.x, y: child.y - joint.y }, { x: 0, y: -1 });
        const incoming = normalizeVector({ x: joint.x - parent.x, y: joint.y - parent.y }, outgoing);
        const axis = normalizeVector({ x: incoming.x + outgoing.x, y: incoming.y + outgoing.y }, outgoing);
        const dimensions = getArticulationDimensions(type, scale, size);
        articulations.push({
            id,
            center: joint,
            axis,
            type,
            ...dimensions,
        });
    }

    function addFingerArticulations(prefix, carpalId, base, chain) {
        const [mcp, pip, dip, tip] = chain;
        const carpal = carpalById.get(carpalId);
        addArticulation(`${prefix}-cmc`, carpal?.center, base, mcp, 'cmc', prefix === 'pinky' ? 0.86 : 1);
        addArticulation(`${prefix}-mcp`, base, mcp, pip, 'mcp', prefix === 'pinky' ? 0.88 : 1);
        addArticulation(`${prefix}-pip`, mcp, pip, dip, 'pip', prefix === 'pinky' ? 0.86 : 1);
        addArticulation(`${prefix}-dip`, pip, dip, tip, 'dip', prefix === 'pinky' ? 0.84 : 1);
    }

    const trapezium = carpalById.get('trapezium');
    addArticulation('thumb-cmc', trapezium?.center, metacarpalBases.thumb, thumbMcp, 'thumb-cmc', 1);
    addArticulation('thumb-mcp', metacarpalBases.thumb, thumbMcp, thumbIp, 'thumb-mcp', 1);
    addArticulation('thumb-ip', thumbMcp, thumbIp, thumbTip, 'thumb-ip', 1);
    addFingerArticulations('index', 'trapezoid', metacarpalBases.index, indexChain);
    addFingerArticulations('middle', 'capitate', metacarpalBases.middle, middleChain);
    addFingerArticulations('ring', 'hamate', metacarpalBases.ring, ringChain);
    addFingerArticulations('pinky', 'hamate', metacarpalBases.pinky, pinkyChain);
    return articulations;
}

function getArticulationDimensions(type, scale, size) {
    const dimensions = {
        cmc: { across: 8.2, along: 2.8 },
        mcp: { across: 8.9, along: 2.9 },
        pip: { across: 6.7, along: 2.25 },
        dip: { across: 5.3, along: 1.85 },
        'thumb-cmc': { across: 9.3, along: 3.2 },
        'thumb-mcp': { across: 8.3, along: 2.8 },
        'thumb-ip': { across: 6.5, along: 2.15 },
    };
    const preset = dimensions[type] || dimensions.pip;
    return {
        across: preset.across * scale * size,
        along: preset.along * scale * size,
    };
}

function getBoneRenderType(finger, segment, group) {
    if (finger === 'Thumb') return segment === 'metacarpal' ? 'thumb-metacarpal'
        : segment === 'distal phalanx' ? 'distal' : 'thumb-phalanx';
    if (group === 'Metacarpal') return 'metacarpal';
    if (segment === 'proximal phalanx') return 'proximal';
    if (segment === 'middle phalanx') return 'middle';
    if (segment === 'distal phalanx') return 'distal';
    return 'phalanx';
}

function describeBone(finger, segment, group) {
    if (finger === 'Pinky' && segment === 'metacarpal') {
        return 'Palm bone leading to the little finger.';
    }
    if (finger === 'Pinky' && segment === 'proximal phalanx') {
        return 'First finger bone after the pinky knuckle.';
    }
    if (finger === 'Pinky' && segment === 'middle phalanx') {
        return 'Middle segment of the little finger.';
    }
    if (finger === 'Pinky' && segment === 'distal phalanx') {
        return 'Fingertip bone of the little finger.';
    }
    if (group === 'Metacarpal') {
        return `${finger} palm bone connecting the wrist area to the base knuckle.`;
    }
    if (finger === 'Thumb') {
        return `${finger} ${segment}; the thumb has proximal and distal phalanges only.`;
    }
    return `${finger} ${segment}; part of the visible finger chain estimated from hand landmarks.`;
}

function describeBoneLocation(finger, segment, id) {
    if (id === 'pinky-metacarpal') return 'palm bone leading to the little finger';
    if (finger === 'Pinky' && segment === 'proximal phalanx') return 'first finger bone after the knuckle';
    if (finger === 'Pinky' && segment === 'middle phalanx') return 'middle segment of the little finger';
    if (finger === 'Pinky' && segment === 'distal phalanx') return 'fingertip bone of the little finger';
    if (segment === 'metacarpal') return `${finger.toLowerCase()} side of the palm`;
    if (segment === 'proximal phalanx') return 'closest finger segment to the knuckle';
    if (segment === 'middle phalanx') return 'middle finger segment';
    if (segment === 'distal phalanx') return 'fingertip segment';
    return 'estimated from visible hand landmarks';
}

function drawBoneLabels(ctx, bones, anchors, labelMode, bounds) {
    if (labelMode === 'off') return;

    const cleanLabels = [
        { text: 'Distal phalanx', point: anchors.distal, priority: 1 },
        { text: 'Middle phalanx', point: anchors.middle, priority: 2 },
        { text: 'Proximal phalanx', point: anchors.proximal, priority: 3 },
        { text: 'Metacarpals', point: anchors.metacarpals, priority: 4 },
    ];

    const detailedIds = new Set([
        'thumb-metacarpal',
        'thumb-proximal-phalanx',
        'thumb-distal-phalanx',
        'index-metacarpal',
        'index-proximal-phalanx',
        'index-middle-phalanx',
        'index-distal-phalanx',
        'middle-metacarpal',
        'middle-proximal-phalanx',
        'middle-middle-phalanx',
        'middle-distal-phalanx',
        'ring-metacarpal',
        'ring-proximal-phalanx',
        'ring-middle-phalanx',
        'ring-distal-phalanx',
        'pinky-metacarpal',
        'pinky-proximal-phalanx',
        'pinky-middle-phalanx',
        'pinky-distal-phalanx',
    ]);

    const labels = labelMode === 'detailed'
        ? bones
            .filter(bone => detailedIds.has(bone.id))
            .map((bone) => ({
                text: bone.label || bone.name,
                point: bone.labelPoint,
                priority: getDetailedLabelPriority(bone),
            }))
        : cleanLabels;

    drawSmartLabels(ctx, labels.filter(label => label.point), bounds);
}

function getDetailedLabelPriority(bone) {
    if (bone.finger === 'Pinky') return 1;
    if (bone.finger === 'Thumb') return 2;
    if (bone.segment === 'metacarpal') return 3;
    return 5;
}

export function drawHandSkeleton(ctx, landmarks, w, h, options = {}) {
    const model = createHandSkeletonModel(landmarks, w, h, options);
    const mode = options.mode || ANATOMY_MODES.GROUPED;
    const quizTargetId = options.quizTargetId;

    ctx.globalAlpha = Math.max(0.35, model.confidence.score);
    model.bones.forEach((bone) => {
        const isQuizTarget = mode === ANATOMY_MODES.QUIZ && bone.id === quizTargetId;
        if (bone.type === 'segment') {
            drawTaperedCapsule(ctx, bone.from, bone.to, bone.startWidth, bone.endWidth, isQuizTarget);
        } else if (bone.type === 'carpal') {
            drawCarpalBone(ctx, bone.center, bone.rx, bone.ry, bone.angle, isQuizTarget);
        } else {
            drawKnuckle(ctx, bone.center, bone.radius || 7);
        }
    });
    ctx.globalAlpha = 1;

    if (options.showLabels !== false && mode !== ANATOMY_MODES.QUIZ) {
        drawSmartLabels(ctx, getLabelsForMode(model, mode), options.visibleBounds);
    }
    if (mode === ANATOMY_MODES.DEBUG) {
        drawDebugLandmarks(ctx, model);
    }
    return model;
}

function averagePoints(points) {
    return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
}

function normalizeVector(vector, fallback) {
    const length = Math.hypot(vector.x, vector.y);
    if (length < 0.0001) return fallback;
    return { x: vector.x / length, y: vector.y / length };
}

function perpendicularVector(vector) {
    return { x: -vector.y, y: vector.x };
}

function movePoint(point, axis, amount) {
    return {
        x: point.x + axis.x * amount,
        y: point.y + axis.y * amount,
    };
}

function moveToward(a, b, amount) {
    return {
        x: a.x + (b.x - a.x) * amount,
        y: a.y + (b.y - a.y) * amount,
    };
}

// ── Flat-fronted anatomical bone: trapezoidal profile with flat anterior surface ──
function drawRealBone(ctx, a, b, endWidth, midWidth) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const nx = -dy / len, ny = dx / len;
    const ux = dx / len, uy = dy / len;

    const capR = endWidth;
    const shaftR = Math.max(midWidth, capR * 0.65);

    const FLARE = 0.18;
    function widthAt(t) {
        if (t <= FLARE) {
            const lt = t / FLARE;
            return capR + (shaftR - capR) * (0.5 - 0.5 * Math.cos(lt * Math.PI));
        }
        if (t >= 1 - FLARE) {
            const lt = (t - (1 - FLARE)) / FLARE;
            return shaftR + (capR - shaftR) * (0.5 - 0.5 * Math.cos(lt * Math.PI));
        }
        return shaftR;
    }

    const NUM_SAMPLES = 24;
    const cornerR = capR * 0.35;

    function bonePath() {
        ctx.beginPath();
        const startA = { x: a.x + ux * cornerR + nx * capR, y: a.y + uy * cornerR + ny * capR };
        ctx.moveTo(startA.x, startA.y);
        for (let i = 1; i <= NUM_SAMPLES; i++) {
            const t = i / NUM_SAMPLES;
            const w = widthAt(t);
            ctx.lineTo(a.x + dx * t + nx * w, a.y + dy * t + ny * w);
        }
        ctx.arcTo(
            b.x + ux * cornerR + nx * capR, b.y + uy * cornerR + ny * capR,
            b.x + ux * cornerR - nx * capR, b.y + uy * cornerR - ny * capR,
            cornerR
        );
        ctx.arcTo(
            b.x + ux * cornerR - nx * capR, b.y + uy * cornerR - ny * capR,
            a.x + dx - nx * capR, a.y + dy - ny * capR,
            cornerR
        );
        for (let i = NUM_SAMPLES; i >= 0; i--) {
            const t = i / NUM_SAMPLES;
            const w = widthAt(t);
            ctx.lineTo(a.x + dx * t - nx * w, a.y + dy * t - ny * w);
        }
        ctx.arcTo(
            a.x - ux * cornerR - nx * capR, a.y - uy * cornerR - ny * capR,
            a.x - ux * cornerR + nx * capR, a.y - uy * cornerR + ny * capR,
            cornerR
        );
        ctx.arcTo(
            a.x - ux * cornerR + nx * capR, a.y - uy * cornerR + ny * capR,
            startA.x, startA.y,
            cornerR
        );
        ctx.closePath();
    }

    const midPt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(12, 8, 4, 0.55)';
    ctx.shadowBlur = capR * 0.9;
    ctx.shadowOffsetX = capR * 0.18;
    ctx.shadowOffsetY = capR * 0.25;
    bonePath();
    ctx.fillStyle = '#9a9080';
    ctx.fill();
    ctx.restore();

    // Base ivory fill
    bonePath();
    ctx.fillStyle = '#e2daca';
    ctx.fill();

    // Flat face shading
    ctx.save();
    bonePath();
    ctx.clip();

    const centerGrad = ctx.createLinearGradient(
        midPt.x + nx * capR, midPt.y + ny * capR,
        midPt.x - nx * capR, midPt.y - ny * capR
    );
    centerGrad.addColorStop(0,    'rgba(120, 108, 85, 0.7)');
    centerGrad.addColorStop(0.12, 'rgba(180, 168, 145, 0.4)');
    centerGrad.addColorStop(0.25, 'rgba(245, 238, 222, 0.15)');
    centerGrad.addColorStop(0.50, 'rgba(255, 250, 238, 0.0)');
    centerGrad.addColorStop(0.75, 'rgba(245, 238, 222, 0.15)');
    centerGrad.addColorStop(0.88, 'rgba(160, 145, 120, 0.5)');
    centerGrad.addColorStop(1,    'rgba(90, 78, 58, 0.75)');
    bonePath();
    ctx.fillStyle = centerGrad;
    ctx.fill();

    const axialGrad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    axialGrad.addColorStop(0,   'rgba(200, 185, 158, 0.18)');
    axialGrad.addColorStop(0.3, 'rgba(200, 185, 158, 0.0)');
    axialGrad.addColorStop(0.7, 'rgba(200, 185, 158, 0.0)');
    axialGrad.addColorStop(1,   'rgba(190, 175, 148, 0.15)');
    bonePath();
    ctx.fillStyle = axialGrad;
    ctx.fill();
    ctx.restore();

    // Lateral edge ridges
    ctx.save();
    ctx.strokeStyle = 'rgba(140, 125, 100, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= NUM_SAMPLES; i++) {
        const t = i / NUM_SAMPLES;
        const w = widthAt(t) * 0.88;
        const px = a.x + dx * t + nx * w;
        const py = a.y + dy * t + ny * w;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= NUM_SAMPLES; i++) {
        const t = i / NUM_SAMPLES;
        const w = widthAt(t) * 0.88;
        const px = a.x + dx * t - nx * w;
        const py = a.y + dy * t - ny * w;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // Outline
    bonePath();
    ctx.strokeStyle = 'rgba(95, 82, 60, 0.55)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Condyle shading
    ctx.save();
    bonePath();
    ctx.clip();
    const pGrad = ctx.createRadialGradient(a.x, a.y, capR * 0.3, a.x, a.y, capR * 1.2);
    pGrad.addColorStop(0, 'rgba(170, 155, 130, 0.2)');
    pGrad.addColorStop(1, 'rgba(170, 155, 130, 0.0)');
    ctx.fillStyle = pGrad;
    ctx.fillRect(a.x - capR * 1.5, a.y - capR * 1.5, capR * 3, capR * 3);
    const dGrad = ctx.createRadialGradient(b.x, b.y, capR * 0.3, b.x, b.y, capR * 1.2);
    dGrad.addColorStop(0, 'rgba(170, 155, 130, 0.2)');
    dGrad.addColorStop(1, 'rgba(170, 155, 130, 0.0)');
    ctx.fillStyle = dGrad;
    ctx.fillRect(b.x - capR * 1.5, b.y - capR * 1.5, capR * 3, capR * 3);
    ctx.restore();
}

function drawTaperedCapsule(ctx, a, b, startWidth, endWidth, highlighted = false) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const nx = -dy / len, ny = dx / len;
    const ux = dx / len, uy = dy / len;
    const start = startWidth * (highlighted ? 1.18 : 1);
    const end = endWidth * (highlighted ? 1.18 : 1);

    ctx.save();
    ctx.shadowColor = highlighted ? 'rgba(0,255,136,0.65)' : 'rgba(12, 8, 4, 0.55)';
    ctx.shadowBlur = highlighted ? 16 : start * 0.75;
    ctx.shadowOffsetX = highlighted ? 0 : start * 0.12;
    ctx.shadowOffsetY = highlighted ? 0 : start * 0.18;

    ctx.beginPath();
    ctx.moveTo(a.x + nx * start, a.y + ny * start);
    ctx.lineTo(b.x + nx * end, b.y + ny * end);
    ctx.quadraticCurveTo(b.x + ux * end, b.y + uy * end, b.x - nx * end, b.y - ny * end);
    ctx.lineTo(a.x - nx * start, a.y - ny * start);
    ctx.quadraticCurveTo(a.x - ux * start, a.y - uy * start, a.x + nx * start, a.y + ny * start);
    ctx.closePath();

    const grad = ctx.createLinearGradient(a.x + nx * start, a.y + ny * start, a.x - nx * start, a.y - ny * start);
    grad.addColorStop(0, highlighted ? '#fff7d0' : '#f7f1df');
    grad.addColorStop(0.5, highlighted ? '#d9f8cf' : '#d8cfbc');
    grad.addColorStop(1, highlighted ? '#a9d28a' : '#8f836d');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = highlighted ? '#00ff88' : 'rgba(95, 82, 60, 0.55)';
    ctx.lineWidth = highlighted ? 2 : 0.9;
    ctx.stroke();
    ctx.restore();
}

function drawCarpalBone(ctx, center, rx, ry, angle, highlighted = false) {
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);
    ctx.shadowColor = highlighted ? 'rgba(0,255,136,0.65)' : 'rgba(12, 8, 4, 0.55)';
    ctx.shadowBlur = highlighted ? 16 : rx * 0.7;
    ctx.fillStyle = highlighted ? '#d9f8cf' : '#d8d0c0';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(-rx * 0.35, -ry * 0.35, 1, rx * 0.12, ry * 0.12, rx * 1.25);
    grad.addColorStop(0, 'rgba(255, 254, 248, 0.96)');
    grad.addColorStop(0.5, 'rgba(196, 186, 166, 0.62)');
    grad.addColorStop(1, 'rgba(78, 66, 48, 0.85)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = highlighted ? '#00ff88' : 'rgba(95, 82, 60, 0.70)';
    ctx.lineWidth = highlighted ? 2 : 1;
    ctx.stroke();
    ctx.restore();
}

function drawSmartLabels(ctx, labels, visibleBounds, options = {}) {
    const placed = [];
    const layouts = [];
    const bounds = visibleBounds || { left: 16, top: 16, right: window.innerWidth - 16, bottom: window.innerHeight - 16 };
    const sorted = [...labels].sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9));
    const maxLabels = options.maxLabels ?? (labels.length > 22 ? 22 : labels.length);
    const isMedical = options.theme === 'medical';
    const fontSize = options.fontSize ?? (isMedical ? 10 : 9);
    const centerX = options.avoidRegion?.centerX ?? (bounds.left + bounds.right) / 2;

    sorted.forEach((label, index) => {
        if (placed.length >= maxLabels) return;
        const text = label.text;
        ctx.font = isMedical
            ? `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`
            : `${fontSize}px "Share Tech Mono", monospace`;
        const pad = isMedical ? 6 : 3;
        const w = ctx.measureText(text).width + pad * 2;
        const h = fontSize + 9;
        const side = label.preferredSide || (
            options.outwardFromCenter
                ? (label.point.x < centerX ? -1 : 1)
                : (label.point.x < (bounds.left + bounds.right) / 2 ? 1 : -1)
        );
        const rect = placeLabelRect({
            target: label.point,
            w,
            h,
            side,
            index,
            placed,
            bounds,
            isMedical,
            keepLeadersShort: options.keepLeadersShort,
            avoidRegion: options.avoidRegion,
            preferRegionEdge: options.preferRegionEdge,
        });
        if (!rect) return;
        placed.push(rect);
        layouts.push({...label,rect});
        drawLabelRect(ctx, text, label.target || label.point, rect, isMedical ? 'rgba(238, 246, 236, 0.98)' : '#00ff88', {
            medical: isMedical,
            pad,
            fontSize,
        });
    });
    return layouts;
}

function placeLabelRect({ target, w, h, side, index, placed, bounds, isMedical, keepLeadersShort, avoidRegion, preferRegionEdge }) {
    const margin = 8;
    const xOffsets = isMedical
        ? [66, 84, 106, 48].map(value => value * side)
        : [30, 44, 18].map(value => value * side);
    const yOffsets = isMedical
        ? [0, -28, 28, -54, 54, -82, 82]
        : [0, -18, 18, -36, 36];
    const candidates = [];

    const addCandidate = (rawX, rawY, xIndex, yIndex, dy, regionEdge = false) => {
        const candidate = {
            x: clamp(rawX, bounds.left + margin, bounds.right - w - margin),
            y: clamp(rawY, bounds.top + margin, bounds.bottom - h - margin),
            w,
            h,
        };
        const anchor = getLabelAnchor(candidate, target);
        const leaderLength = dist(target, anchor);
        const overlapPenalty = placed.some(other => rectsOverlap(candidate, other)) ? 10000 : 0;
        const anatomyPenalty = avoidRegion && rectOverlapsRegion(candidate, avoidRegion) ? 70 : 0;
        const edgePenalty = candidate.x === bounds.left + margin || candidate.x === bounds.right - w - margin ? 14 : 0;
        const longLeaderPenalty = keepLeadersShort && leaderLength > 150 ? 120 : 0;
        candidates.push({
            rect: candidate,
            score: overlapPenalty + anatomyPenalty + leaderLength + Math.abs(dy) * 0.42 + xIndex * 5 + yIndex * 0.8 + edgePenalty + longLeaderPenalty - (regionEdge ? 18 : 0),
        });
    };

    if (preferRegionEdge && avoidRegion) {
        [12, 26, 40].forEach((gap, gapIndex) => {
            yOffsets.forEach((dy, yIndex) => {
                const rawX = side > 0 ? avoidRegion.right + gap : avoidRegion.left - gap - w;
                const rawY = target.y - h / 2 + dy + ((index % 2) * 3);
                addCandidate(rawX, rawY, gapIndex, yIndex, dy, true);
            });
        });
    }

    xOffsets.forEach((dx, xIndex) => {
        yOffsets.forEach((dy, yIndex) => {
            const rawX = dx > 0 ? target.x + dx : target.x + dx - w;
            const rawY = target.y - h / 2 + dy + ((index % 2) * 3);
            addCandidate(rawX, rawY, xIndex, yIndex, dy);
        });
    });

    const best = candidates
        .filter(candidate => !placed.some(other => rectsOverlap(candidate.rect, other)))
        .filter(candidate => !avoidRegion || !rectOverlapsRegion(candidate.rect, avoidRegion) || placed.length < 2)
        .sort((a, b) => a.score - b.score)[0];

    if (best) return best.rect;
    if (placed.length > 4) return null;

    const fallback = candidates.sort((a, b) => a.score - b.score)[0];
    if (!fallback) return null;
    for (let nudge = 0; nudge <= 80; nudge += 20) {
        const candidate = {
            ...fallback.rect,
            y: clamp(fallback.rect.y + (index % 2 === 0 ? -nudge : nudge), bounds.top + margin, bounds.bottom - h - margin),
        };
        if (!placed.some(other => rectsOverlap(candidate, other))) return candidate;
    }
    return null;
}

function rectOverlapsRegion(rect, region) {
    return !(
        rect.x + rect.w < region.left ||
        rect.x > region.right ||
        rect.y + rect.h < region.top ||
        rect.y > region.bottom
    );
}

function drawLabelRect(ctx, text, target, rect, color, options = {}) {
    ctx.save();
    const isMedical = options.medical;
    ctx.fillStyle = isMedical ? 'rgba(16, 22, 20, 0.76)' : '#000000b8';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = isMedical ? 'rgba(130, 178, 154, 0.58)' : color;
    ctx.lineWidth = isMedical ? 0.85 : 1;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = color;
    ctx.fillText(text, rect.x + (options.pad ?? 3), rect.y + (isMedical ? (options.fontSize ?? 10) + 4.5 : 12));

    const anchor = getLabelAnchor(rect, target);
    ctx.globalAlpha *= isMedical ? 0.58 : 0.52;
    ctx.strokeStyle = isMedical ? 'rgba(162, 204, 182, 0.62)' : color;
    ctx.lineWidth = isMedical ? 0.75 : 1;
    ctx.beginPath();
    ctx.moveTo(target.x, target.y);
    ctx.lineTo(anchor.x, anchor.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(target.x, target.y, isMedical ? 1.25 : 1.8, 0, Math.PI * 2);
    ctx.fillStyle = isMedical ? 'rgba(196, 230, 208, 0.76)' : color;
    ctx.fill();
    ctx.restore();
}

function getLabelAnchor(rect, target) {
    return {
        x: target.x < rect.x ? rect.x : rect.x + rect.w,
        y: clamp(target.y, rect.y + 4, rect.y + rect.h - 4),
    };
}

function drawDebugLandmarks(ctx, model) {
    ctx.save();
    ctx.font = '8px "Share Tech Mono", monospace';
    model.rawLandmarks.forEach((raw, index) => {
        const smooth = model.landmarks[index];
        ctx.strokeStyle = '#ffaa00aa';
        ctx.beginPath();
        ctx.arc(raw.x, raw.y, 2.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(smooth.x, smooth.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(String(index), smooth.x + 5, smooth.y - 5);
        ctx.strokeStyle = '#ffaa0055';
        ctx.beginPath();
        ctx.moveTo(raw.x, raw.y);
        ctx.lineTo(smooth.x, smooth.y);
        ctx.stroke();
    });

    model.bones.forEach((bone) => {
        const anchor = bone.center || bone.labelPoint;
        if (!anchor) return;
        ctx.strokeStyle = bone.group === 'carpals' ? '#e0e8ffaa' : '#00ff8855';
        ctx.beginPath();
        ctx.rect(anchor.x - 3, anchor.y - 3, 6, 6);
        ctx.stroke();
    });

    ctx.fillStyle = '#00ff88';
    ctx.fillText(
        `CONF ${(model.confidence.score * 100).toFixed(0)}% ${model.handedness.label} ${model.handedness.uncertain ? 'UNCERTAIN' : model.handedness.source}`,
        model.origin.x + 18,
        model.origin.y + 28
    );
    ctx.restore();
}

// ── Distal phalanx: tapers from wide base to smooth narrow rounded tip ──
// Real distal phalanges narrow smoothly toward the fingertip, ending in a
// gentle rounded point — NOT a wide paddle shape.
// eslint-disable-next-line no-unused-vars
function drawDistalPhalanx(ctx, a, b, endWidth, midWidth) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const nx = -dy / len, ny = dx / len;
    const ux = dx / len, uy = dy / len;
    const theta = Math.atan2(dy, dx);

    const baseW = endWidth;          // wide at proximal end (DIP joint)
    const tipW = endWidth * 0.55;    // wider, blunter tip

    // Width profile: wide base → smooth taper → narrow rounded tip
    function widthAt(t) {
        if (t < 0.12) {
            // Base condyle stays wide
            return baseW;
        }
        // Smooth cosine taper from base to tip
        const lt = (t - 0.12) / 0.88;
        return baseW + (tipW - baseW) * (0.5 - 0.5 * Math.cos(lt * Math.PI));
    }

    const NUM_SAMPLES = 22;

    function bonePath() {
        ctx.beginPath();
        // Proximal end — squared with slight rounding
        const cornerR = baseW * 0.3;
        const startPt = { x: a.x + nx * baseW, y: a.y + ny * baseW };
        ctx.moveTo(startPt.x, startPt.y);

        // Side A: proximal → distal (tapering)
        for (let i = 1; i <= NUM_SAMPLES; i++) {
            const t = i / NUM_SAMPLES;
            const w = widthAt(t);
            ctx.lineTo(a.x + dx * t + nx * w, a.y + dy * t + ny * w);
        }
        // Tip: smooth wide rounded arc
        ctx.arc(b.x, b.y, tipW * 1.1, theta + Math.PI / 2, theta - Math.PI / 2, true);
        // Side B: distal → proximal
        for (let i = NUM_SAMPLES; i >= 0; i--) {
            const t = i / NUM_SAMPLES;
            const w = widthAt(t);
            ctx.lineTo(a.x + dx * t - nx * w, a.y + dy * t - ny * w);
        }
        // Close proximal end
        ctx.arcTo(
            a.x - ux * cornerR - nx * baseW, a.y - uy * cornerR - ny * baseW,
            a.x - ux * cornerR + nx * baseW, a.y - uy * cornerR + ny * baseW,
            cornerR
        );
        ctx.closePath();
    }

    const midPt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(12, 8, 4, 0.50)';
    ctx.shadowBlur = baseW * 0.8;
    ctx.shadowOffsetX = baseW * 0.15;
    ctx.shadowOffsetY = baseW * 0.2;
    bonePath();
    ctx.fillStyle = '#9a9080';
    ctx.fill();
    ctx.restore();

    // Base ivory fill
    bonePath();
    ctx.fillStyle = '#e2daca';
    ctx.fill();

    // Flat face shading
    ctx.save();
    bonePath();
    ctx.clip();
    const centerGrad = ctx.createLinearGradient(
        midPt.x + nx * baseW, midPt.y + ny * baseW,
        midPt.x - nx * baseW, midPt.y - ny * baseW
    );
    centerGrad.addColorStop(0,    'rgba(120, 108, 85, 0.65)');
    centerGrad.addColorStop(0.15, 'rgba(180, 168, 145, 0.35)');
    centerGrad.addColorStop(0.30, 'rgba(245, 238, 222, 0.1)');
    centerGrad.addColorStop(0.50, 'rgba(255, 250, 238, 0.0)');
    centerGrad.addColorStop(0.70, 'rgba(245, 238, 222, 0.1)');
    centerGrad.addColorStop(0.85, 'rgba(160, 145, 120, 0.45)');
    centerGrad.addColorStop(1,    'rgba(90, 78, 58, 0.7)');
    bonePath();
    ctx.fillStyle = centerGrad;
    ctx.fill();
    ctx.restore();

    // Outline
    bonePath();
    ctx.strokeStyle = 'rgba(95, 82, 60, 0.50)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
}

// ── Joint condyle: organic knobby shape like a small carpal bone ──
// Draws a bulbous bone-end knob at each joint, matching the carpal style.
function drawKnuckle(ctx, point, radius) {
    const r = radius * 1.1;
    const N = 20; // outline samples

    // Perturbed ellipse for organic shape (deterministic from position)
    const seed = (point.x * 7.3 + point.y * 3.1) % 10;
    const pts = [];
    for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2;
        const rx = r * (0.9 + Math.sin(seed + t * 3) * 0.08);
        const ry = r * (0.82 + Math.sin(seed * 1.7 + t * 4) * 0.07);
        pts.push({
            x: point.x + Math.cos(t) * rx,
            y: point.y + Math.sin(t) * ry
        });
    }

    function knobPath() {
        ctx.beginPath();
        const last = pts[N - 1], first = pts[0];
        ctx.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
        for (let i = 0; i < N; i++) {
            const cur = pts[i];
            const next = pts[(i + 1) % N];
            ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2);
        }
        ctx.closePath();
    }

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(12, 8, 4, 0.45)';
    ctx.shadowBlur = r * 0.7;
    ctx.shadowOffsetX = r * 0.15;
    ctx.shadowOffsetY = r * 0.2;
    knobPath();
    ctx.fillStyle = '#9a9080';
    ctx.fill();
    ctx.restore();

    // Base ivory fill
    knobPath();
    ctx.fillStyle = '#ddd6c4';
    ctx.fill();

    // 3D spherical shading — light from upper-left
    const grad = ctx.createRadialGradient(
        point.x - r * 0.35, point.y - r * 0.35, r * 0.05,
        point.x + r * 0.1, point.y + r * 0.1, r * 1.2
    );
    grad.addColorStop(0,   'rgba(255, 252, 240, 0.95)');
    grad.addColorStop(0.3, 'rgba(238, 230, 212, 0.7)');
    grad.addColorStop(0.6, 'rgba(200, 188, 164, 0.5)');
    grad.addColorStop(1,   'rgba(110, 95, 72, 0.75)');
    knobPath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Crisp outline
    knobPath();
    ctx.strokeStyle = 'rgba(95, 82, 60, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
}


// ── Carpal cluster: 8 irregular cobblestone-shaped bones tightly packed ──
// Each bone is an organic blob (perturbed ellipse via sum of sines) with 3D shading.
// eslint-disable-next-line no-unused-vars
function drawCarpalCluster(ctx, wrist, landmarks, w, h) {
    const idxMcp = { x: landmarks[HAND.INDEX_MCP].x * w, y: landmarks[HAND.INDEX_MCP].y * h };
    const pinkyMcp = { x: landmarks[HAND.PINKY_MCP].x * w, y: landmarks[HAND.PINKY_MCP].y * h };
    const palmWidth = dist(idxMcp, pinkyMcp);
    const scale = palmWidth * 0.14;

    // Each carpal: position, ellipse shape, and a 5-tuple "signature" for irregular bumps:
    //   [phase, freqA, ampA, freqB, ampB] — deterministic per-bone perturbation
    const carpals = [
        // Distal row (closer to metacarpals)
        { dx: -1.65, dy: -0.20, rx: 0.95, ry: 0.82, ang:  0.18, sig: [0.7, 3, 0.10, 5, 0.05] }, // Trapezium
        { dx: -0.55, dy: -0.35, rx: 0.75, ry: 0.70, ang: -0.10, sig: [1.4, 4, 0.09, 7, 0.04] }, // Trapezoid
        { dx:  0.55, dy: -0.35, rx: 1.05, ry: 0.88, ang:  0.05, sig: [2.1, 3, 0.11, 5, 0.06] }, // Capitate (largest)
        { dx:  1.55, dy: -0.20, rx: 0.85, ry: 0.78, ang: -0.18, sig: [2.8, 4, 0.10, 6, 0.05] }, // Hamate
        // Proximal row (closer to forearm)
        { dx: -1.85, dy: 0.95,  rx: 0.92, ry: 0.78, ang:  0.22, sig: [3.5, 3, 0.11, 7, 0.04] }, // Scaphoid
        { dx: -0.60, dy: 1.10,  rx: 0.85, ry: 0.74, ang:  0.02, sig: [4.2, 4, 0.09, 5, 0.06] }, // Lunate
        { dx:  0.60, dy: 1.10,  rx: 0.82, ry: 0.76, ang: -0.08, sig: [4.9, 3, 0.10, 6, 0.05] }, // Triquetrum
        { dx:  1.65, dy: 0.85,  rx: 0.62, ry: 0.62, ang:  0.30, sig: [5.6, 5, 0.08, 7, 0.04] }, // Pisiform
    ];

    const N = 28; // outline samples per bone
    carpals.forEach(({ dx, dy, rx, ry, ang, sig }) => {
        const cx = wrist.x + dx * scale;
        const cy = wrist.y + dy * scale;
        const r = scale * 0.85;
        const [phase, fA, aA, fB, aB] = sig;
        const cosA = Math.cos(ang), sinA = Math.sin(ang);

        // Sample N points around an ellipse, perturbed by sum of sines for organic shape
        const pts = [];
        for (let i = 0; i < N; i++) {
            const t = (i / N) * Math.PI * 2;
            // Base ellipse point (in local frame, pre-rotation)
            const lx = r * rx * Math.cos(t);
            const ly = r * ry * Math.sin(t);
            // Deterministic radial perturbation (sine bumps for cobblestone irregularity)
            const perturb = 1
                + Math.sin(t * fA + phase) * aA
                + Math.sin(t * fB + phase * 1.7) * aB;
            // Rotate by ang and translate to (cx, cy)
            const px = cx + (lx * cosA - ly * sinA) * perturb;
            const py = cy + (lx * sinA + ly * cosA) * perturb;
            pts.push({ x: px, y: py });
        }

        // Smooth closed curve through pts using midpoint quadratic-bezier trick
        function carpalPath() {
            ctx.beginPath();
            const last = pts[N - 1], first = pts[0];
            ctx.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
            for (let i = 0; i < N; i++) {
                const cur = pts[i];
                const next = pts[(i + 1) % N];
                ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2);
            }
            ctx.closePath();
        }

        // Drop shadow
        ctx.save();
        ctx.shadowColor = 'rgba(12, 8, 4, 0.55)';
        ctx.shadowBlur = r * 0.85;
        ctx.shadowOffsetX = r * 0.22;
        ctx.shadowOffsetY = r * 0.30;
        carpalPath();
        ctx.fillStyle = '#a09888';
        ctx.fill();
        ctx.restore();

        // Base ivory fill
        carpalPath();
        ctx.fillStyle = '#d8d0c0';
        ctx.fill();

        // 3D spherical shading — light from upper-left
        const grad = ctx.createRadialGradient(
            cx - r * rx * 0.42, cy - r * ry * 0.42, r * 0.05,
            cx + r * rx * 0.10, cy + r * ry * 0.10, r * Math.max(rx, ry) * 1.30
        );
        grad.addColorStop(0,    'rgba(255, 254, 248, 0.96)');
        grad.addColorStop(0.20, 'rgba(242, 236, 220, 0.85)');
        grad.addColorStop(0.52, 'rgba(196, 186, 166, 0.65)');
        grad.addColorStop(0.78, 'rgba(140, 128, 108, 0.85)');
        grad.addColorStop(1,    'rgba(78, 66, 48, 0.94)');
        carpalPath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Crisp outline (the dark grooves between bones)
        carpalPath();
        ctx.strokeStyle = 'rgba(95, 82, 60, 0.70)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
    });
}

// ═══════════════════════════════════════
//   BODY ANATOMY RENDERERS
// ═══════════════════════════════════════

export function drawBodyMuscles(ctx, landmarks, w, h) {
    const p = (i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
    const P = POSE;
    ctx.globalAlpha = 0.45;

    // Torso
    drawShape(ctx, [p(P.LEFT_SHOULDER), p(P.RIGHT_SHOULDER),
    mid(p(P.RIGHT_SHOULDER), p(P.RIGHT_HIP)), mid(p(P.LEFT_SHOULDER), p(P.LEFT_HIP))], '#cc2233');
    drawShape(ctx, [mid(p(P.LEFT_SHOULDER), p(P.LEFT_HIP)), mid(p(P.RIGHT_SHOULDER), p(P.RIGHT_HIP)),
    p(P.RIGHT_HIP), p(P.LEFT_HIP)], '#aa2244');

    ctx.globalAlpha = 0.5;
    // Arms
    drawMuscleStrip(ctx, p(P.LEFT_SHOULDER), p(P.LEFT_ELBOW), '#cc3344', 12);
    drawMuscleStrip(ctx, p(P.LEFT_ELBOW), p(P.LEFT_WRIST), '#bb2233', 10);
    drawMuscleStrip(ctx, p(P.RIGHT_SHOULDER), p(P.RIGHT_ELBOW), '#cc3344', 12);
    drawMuscleStrip(ctx, p(P.RIGHT_ELBOW), p(P.RIGHT_WRIST), '#bb2233', 10);
    // Legs
    drawMuscleStrip(ctx, p(P.LEFT_HIP), p(P.LEFT_KNEE), '#cc2244', 14);
    drawMuscleStrip(ctx, p(P.LEFT_KNEE), p(P.LEFT_ANKLE), '#bb2244', 10);
    drawMuscleStrip(ctx, p(P.RIGHT_HIP), p(P.RIGHT_KNEE), '#cc2244', 14);
    drawMuscleStrip(ctx, p(P.RIGHT_KNEE), p(P.RIGHT_ANKLE), '#bb2244', 10);

    ctx.globalAlpha = 1;
    drawLabel(ctx, 'Pectorals', mid(p(P.LEFT_SHOULDER), p(P.RIGHT_SHOULDER)), '#ff4466');
    drawLabel(ctx, 'Abdominals', mid(p(P.LEFT_HIP), p(P.RIGHT_HIP)), '#ff4466');
    drawLabel(ctx, 'Bicep', mid(p(P.LEFT_SHOULDER), p(P.LEFT_ELBOW)), '#ff4466');
    drawLabel(ctx, 'Quadriceps', mid(p(P.LEFT_HIP), p(P.LEFT_KNEE)), '#ff4466');
    if (landmarks[P.NOSE]) drawLabel(ctx, 'Facial Muscles', p(P.NOSE), '#ff4466');
}

export function drawBodySkeleton(ctx, landmarks, w, h) {
    const p = (i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
    const P = POSE;

    const bones = [
        [P.LEFT_SHOULDER, P.RIGHT_SHOULDER],
        [P.LEFT_HIP, P.RIGHT_HIP],
        [P.LEFT_SHOULDER, P.LEFT_HIP], [P.RIGHT_SHOULDER, P.RIGHT_HIP],
        [P.LEFT_SHOULDER, P.LEFT_ELBOW], [P.LEFT_ELBOW, P.LEFT_WRIST],
        [P.RIGHT_SHOULDER, P.RIGHT_ELBOW], [P.RIGHT_ELBOW, P.RIGHT_WRIST],
        [P.LEFT_HIP, P.LEFT_KNEE], [P.LEFT_KNEE, P.LEFT_ANKLE],
        [P.RIGHT_HIP, P.RIGHT_KNEE], [P.RIGHT_KNEE, P.RIGHT_ANKLE],
        [P.LEFT_ANKLE, P.LEFT_HEEL], [P.RIGHT_ANKLE, P.RIGHT_HEEL],
    ];

    // Skull — 3D spherical shading matching the rest of the model
    if (landmarks[P.NOSE]) {
        const nose = p(P.NOSE);
        const earDist = dist(p(P.LEFT_EAR), p(P.RIGHT_EAR));
        const sr = earDist * 0.7;
        const skullCx = nose.x, skullCy = nose.y - sr * 0.3;

        // Drop shadow
        ctx.save();
        ctx.shadowColor = 'rgba(15, 10, 5, 0.55)';
        ctx.shadowBlur = sr * 0.5;
        ctx.shadowOffsetX = sr * 0.12;
        ctx.shadowOffsetY = sr * 0.18;
        ctx.fillStyle = '#b0a898';
        ctx.beginPath();
        ctx.ellipse(skullCx, skullCy, sr * 0.5, sr * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Base ivory
        ctx.fillStyle = '#d0c8b8';
        ctx.beginPath();
        ctx.ellipse(skullCx, skullCy, sr * 0.5, sr * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3D spherical shading
        const skullGrad = ctx.createRadialGradient(
            skullCx - sr * 0.18, skullCy - sr * 0.22, sr * 0.04,
            skullCx + sr * 0.08, skullCy + sr * 0.08, sr * 0.75
        );
        skullGrad.addColorStop(0,    'rgba(255, 254, 248, 0.95)');
        skullGrad.addColorStop(0.22, 'rgba(240, 234, 218, 0.80)');
        skullGrad.addColorStop(0.52, 'rgba(192, 182, 162, 0.65)');
        skullGrad.addColorStop(0.78, 'rgba(140, 128, 108, 0.85)');
        skullGrad.addColorStop(1,    'rgba(80, 68, 50, 0.92)');
        ctx.fillStyle = skullGrad;
        ctx.beginPath();
        ctx.ellipse(skullCx, skullCy, sr * 0.5, sr * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 88, 68, 0.60)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Eye sockets — dark recesses
        [p(P.LEFT_EYE), p(P.RIGHT_EYE)].forEach(eye => {
            const sg = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, sr * 0.15);
            sg.addColorStop(0,   'rgba(10, 8, 4, 0.92)');
            sg.addColorStop(0.6, 'rgba(20, 16, 8, 0.75)');
            sg.addColorStop(1,   'rgba(50, 42, 30, 0.0)');
            ctx.fillStyle = sg;
            ctx.beginPath();
            ctx.ellipse(eye.x, eye.y, sr * 0.13, sr * 0.11, 0, 0, Math.PI * 2);
            ctx.fill();
        });

        // Jaw bones
        drawRealBone(ctx, p(P.LEFT_EAR), { x: nose.x, y: nose.y + sr * 0.4 }, 6.6, 4.4);
        drawRealBone(ctx, p(P.RIGHT_EAR), { x: nose.x, y: nose.y + sr * 0.4 }, 6.6, 4.4);
    }

    // Spine
    ctx.globalAlpha = 1;
    const topSpine = mid(p(P.LEFT_SHOULDER), p(P.RIGHT_SHOULDER));
    const bottomSpine = mid(p(P.LEFT_HIP), p(P.RIGHT_HIP));
    drawSpine(ctx, topSpine, bottomSpine);

    // Major bones — fully opaque for solid 3D model look
    bones.forEach(([a, b]) => drawRealBone(ctx, p(a), p(b), 15.4, 9.9));

    // Joints on top
    [P.LEFT_SHOULDER, P.RIGHT_SHOULDER, P.LEFT_ELBOW, P.RIGHT_ELBOW,
    P.LEFT_WRIST, P.RIGHT_WRIST, P.LEFT_HIP, P.RIGHT_HIP,
    P.LEFT_KNEE, P.RIGHT_KNEE, P.LEFT_ANKLE, P.RIGHT_ANKLE].forEach(i => drawKnuckle(ctx, p(i), 12.1));

    drawLabel(ctx, 'Skull', landmarks[P.NOSE] ? { x: p(P.NOSE).x, y: p(P.NOSE).y - 30 } : topSpine, '#00ff88');
    drawLabel(ctx, 'Clavicle', topSpine, '#00ff88');
    drawLabel(ctx, 'Humerus', mid(p(P.LEFT_SHOULDER), p(P.LEFT_ELBOW)), '#00ff88');
    drawLabel(ctx, 'Spine', mid(topSpine, bottomSpine), '#00ff88');
    drawLabel(ctx, 'Pelvis', mid(p(P.LEFT_HIP), p(P.RIGHT_HIP)), '#00ff88');
    drawLabel(ctx, 'Femur', mid(p(P.RIGHT_HIP), p(P.RIGHT_KNEE)), '#00ff88');
}

// ── Spine (series of vertebrae with 3D model shading) ──
function drawSpine(ctx, top, bottom) {
    const segments = 12;
    const dx = (bottom.x - top.x) / segments;
    const dy = (bottom.y - top.y) / segments;

    for (let i = 0; i < segments; i++) {
        const a = { x: top.x + dx * i, y: top.y + dy * i };
        const b = { x: top.x + dx * (i + 0.82), y: top.y + dy * (i + 0.82) };
        drawRealBone(ctx, a, b, 8.8, 7.7);
        // Intervertebral joint disc (slightly smaller than the bone)
        drawKnuckle(ctx, b, 4.95);
    }
}

// ═══════════════════════════════════════
//   DRAWING PRIMITIVES
// ═══════════════════════════════════════

// ── Body muscle strip with fibers (for arms, legs) ──
function drawMuscleStrip(ctx, a, b, color, width) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = -dy / len * width, ny = dx / len * width;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;

    // Gradient muscle fill
    const grad = ctx.createLinearGradient(mx + nx * 1.5, my + ny * 1.5, mx - nx * 1.5, my - ny * 1.5);
    grad.addColorStop(0, color + '30');
    grad.addColorStop(0.2, color);
    grad.addColorStop(0.5, color + 'aa');
    grad.addColorStop(0.8, color);
    grad.addColorStop(1, color + '30');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * 0.5, a.y + ny * 0.5);
    ctx.quadraticCurveTo(mx + nx * 1.3, my + ny * 1.3, b.x + nx * 0.4, b.y + ny * 0.4);
    ctx.lineTo(b.x - nx * 0.4, b.y - ny * 0.4);
    ctx.quadraticCurveTo(mx - nx * 1.3, my - ny * 1.3, a.x - nx * 0.5, a.y - ny * 0.5);
    ctx.closePath();
    ctx.fill();

    // Fiber lines
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha *= 0.3;
    for (let f = -2; f <= 2; f++) {
        const fo = f * width * 0.2;
        ctx.beginPath();
        ctx.moveTo(a.x + nx * fo * 0.5, a.y + ny * fo * 0.5);
        ctx.quadraticCurveTo(mx + nx * fo * 1.2, my + ny * fo * 1.2,
            b.x + nx * fo * 0.4, b.y + ny * fo * 0.4);
        ctx.stroke();
    }
    ctx.globalAlpha /= 0.3;

    // Outline
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha *= 0.5;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * 0.5, a.y + ny * 0.5);
    ctx.quadraticCurveTo(mx + nx * 1.3, my + ny * 1.3, b.x + nx * 0.4, b.y + ny * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x - nx * 0.5, a.y - ny * 0.5);
    ctx.quadraticCurveTo(mx - nx * 1.3, my - ny * 1.3, b.x - nx * 0.4, b.y - ny * 0.4);
    ctx.stroke();
    ctx.globalAlpha /= 0.5;
}

// ── Flat polygon shape (for torso regions) ──
function drawShape(ctx, points, color) {
    if (points.length < 3) return;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawLabel(ctx, text, point, color) {
    drawLabelAt(ctx, text, point, color, 15, -5);
}

function drawLabelAt(ctx, text, point, color, dx, dy) {
    ctx.font = '10px "Share Tech Mono", monospace';
    const metrics = ctx.measureText(text.toUpperCase());
    const pad = 4;
    const lx = point.x + dx, ly = point.y + dy;

    ctx.fillStyle = '#000000aa';
    ctx.fillRect(lx - pad, ly - 10 - pad, metrics.width + pad * 2, 14 + pad * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(lx - pad, ly - 10 - pad, metrics.width + pad * 2, 14 + pad * 2);
    ctx.fillStyle = color;
    ctx.fillText(text.toUpperCase(), lx, ly);

    ctx.beginPath();
    ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(lx - pad, ly - 3);
    ctx.stroke();
    ctx.globalAlpha = 1;
}

function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ═══════════════════════════════════════
//   FACE / SKULL ANATOMY RENDERERS
//   Real-time canvas drawn (no images)
// ═══════════════════════════════════════

// Face mesh contour landmark indices
const FACE_CONTOUR = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
    234, 127, 162, 21, 54, 103, 67, 109];
const LEFT_EYE_RING = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const RIGHT_EYE_RING = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
const FACE_MUSCLE_PALETTES = {
    superficial: {
        light: 'rgba(236, 132, 121, 0.96)',
        mid: 'rgba(184, 72, 78, 0.96)',
        dark: 'rgba(92, 34, 43, 0.94)',
        shadow: 'rgba(50, 16, 22, 0.30)',
        edge: 'rgba(91, 32, 40, 0.48)',
        highlight: 'rgba(249, 181, 165, 0.24)',
        fiber: 'rgba(244, 166, 151, 0.31)',
    },
    deep: {
        light: 'rgba(203, 105, 101, 0.90)',
        mid: 'rgba(139, 55, 65, 0.92)',
        dark: 'rgba(72, 29, 39, 0.92)',
        shadow: 'rgba(42, 14, 20, 0.28)',
        edge: 'rgba(72, 26, 35, 0.44)',
        highlight: 'rgba(229, 148, 139, 0.20)',
        fiber: 'rgba(224, 137, 132, 0.25)',
    },
    mastication: {
        light: 'rgba(218, 116, 105, 0.94)',
        mid: 'rgba(156, 60, 66, 0.95)',
        dark: 'rgba(73, 28, 35, 0.94)',
        shadow: 'rgba(42, 14, 18, 0.31)',
        edge: 'rgba(72, 27, 32, 0.49)',
        highlight: 'rgba(239, 159, 145, 0.22)',
        fiber: 'rgba(232, 146, 137, 0.28)',
    },
};

export function drawFaceSkull(ctx, landmarks, w, h, options = {}) {
    if (!Array.isArray(landmarks) || landmarks.length < 468
        || landmarks.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))
        || !(w > 0 && h > 0)) return { hitTargets: [] };
    ctx.save();
    try {
        const result = renderFaceSkeleton(ctx, landmarks, w, h, options);
        drawAtlasLabels(ctx, result.labels, options.visibleBounds || { left: 18, top: 18, right: w - 18, bottom: h - 18 }, result.model);
        return result;
    } finally {
        ctx.restore();
    }
}


// Educational projection of superficial facial anatomy. The face mesh tracks
// skin landmarks, not the muscles themselves, so deep structures are omitted
// and every muscle position remains an anatomy-based estimate.
export function drawFaceMuscles(ctx, landmarks, w, h, options = {}) {
    const labelMode = options.labelMode || 'off';
    const model = createFaceMuscleModel(landmarks, w, h, {
        mode: labelMode,
        confidence: options.confidence,
        isUncertain: options.isUncertain,
        visibleBounds: options.visibleBounds,
    });
    if (!model.frame || !model.muscles.length) return { muscles: [] };

    const neckMuscles = model.muscles.filter(muscle => muscle.clipRegion === 'neck');
    const facialMuscles = model.muscles.filter(muscle => muscle.clipRegion !== 'neck');
    neckMuscles.forEach(muscle => drawFaceMuscleGeometry(ctx, muscle, model.frame));

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    // Keep the estimated structures on the tracked facial surface. This avoids
    // forehead spill into hair and masseter spill beyond the jaw silhouette.
    roundedClosedPath(ctx, model.frame.faceContour);
    ctx.clip();
    facialMuscles.forEach(muscle => drawFaceMuscleGeometry(ctx, muscle, model.frame));
    ctx.restore();

    drawFaceMuscleLabels(ctx, model.labels, model.mode, model.frame.bounds, {
        left: Math.min(model.frame.point(234).x, model.frame.point(454).x),
        right: Math.max(model.frame.point(234).x, model.frame.point(454).x),
        top: model.frame.foreheadTop.y,
        bottom: model.frame.chin.y,
        centerX: model.frame.center.x,
    });

    const hitTargets = model.muscles.map(muscle => ({
        type: 'node',
        center: muscle.labelAnchor,
        radius: muscle.hitRadius,
        name: muscle.displayName,
        group: 'Facial muscle',
        side: muscle.side,
        segment: muscle.muscleType,
        explanation: muscle.explanation,
    }));
    return { muscles: model.muscles, hitTargets };
}

function drawFaceMuscleGeometry(ctx, muscle, frame) {
    const tone = faceMuscleTone(muscle);
    if (muscle.muscleType === 'ring') {
        drawFaceMuscleRing(ctx, muscle, tone, frame.scale);
        return;
    }
    if (muscle.muscleType === 'ribbon') {
        drawFacialMuscleRibbon(ctx, muscle.path, {
            tone,
            startWidth: muscle.widths.start,
            midWidth: muscle.widths.middle,
            endWidth: muscle.widths.end,
            alpha: muscle.opacity,
            fiberCount: muscle.displayName.length > 24 ? 3 : 4,
        });
        return;
    }
    drawFaceMusclePatch(ctx, muscle.points, {
        tone,
        alpha: muscle.opacity,
        scale: frame.scale,
        fiberA: muscle.fiberStart,
        fiberB: muscle.fiberEnd,
        fiberCount: muscle.fiberDirection === 'fan' ? 10 : 7,
    });
    if (muscle.fiberDirection === 'fan') {
        drawFaceFanFibers(ctx, muscle, frame.scale);
    }
}

function faceMuscleTone(muscle) {
    if (muscle.group === 'jaw' || muscle.displayName === 'Temporalis') return 'mastication';
    if (['forehead', 'nose'].includes(muscle.group)
        && !muscle.displayName.startsWith('Frontalis')) return 'deep';
    if (muscle.displayName.startsWith('Depressor') || muscle.displayName === 'Mentalis') return 'deep';
    return 'superficial';
}

function drawFaceMuscleRing(ctx, muscle, tone, scale) {
    const palette = FACE_MUSCLE_PALETTES[tone] || FACE_MUSCLE_PALETTES.superficial;
    const center = averagePoints(muscle.outerPoints);
    const extent = Math.max(...muscle.outerPoints.map(point => dist(point, center)));
    const gradient = ctx.createRadialGradient(
        center.x - extent * 0.18, center.y - extent * 0.16, extent * 0.06,
        center.x, center.y, extent,
    );
    gradient.addColorStop(0, palette.light);
    gradient.addColorStop(0.58, palette.mid);
    gradient.addColorStop(1, palette.dark);

    ctx.save();
    ctx.globalAlpha *= muscle.opacity;
    appendAnnularPath(ctx, muscle.outerPoints, muscle.innerPoints);
    ctx.fillStyle = palette.shadow;
    ctx.fill('evenodd');
    appendAnnularPath(ctx, muscle.outerPoints, muscle.innerPoints);
    ctx.fillStyle = gradient;
    ctx.fill('evenodd');
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(0.55, 0.72 * scale);
    traceSmoothLoop(ctx, muscle.outerPoints);
    ctx.stroke();

    const fiberLoop = muscle.outerPoints.map(point => moveToward(point, center, 0.12));
    ctx.globalAlpha *= 0.42;
    ctx.strokeStyle = palette.fiber;
    ctx.lineWidth = Math.max(0.36, 0.48 * scale);
    traceSmoothLoop(ctx, fiberLoop);
    ctx.stroke();
    ctx.restore();
}

function drawFaceFanFibers(ctx, muscle, scale) {
    if (!muscle.points || muscle.points.length < 4) return;
    const palette = FACE_MUSCLE_PALETTES[faceMuscleTone(muscle)];
    const insertion = muscle.fiberEnd;
    const edge = muscle.points.slice(0, Math.max(3, Math.floor(muscle.points.length * 0.58)));
    ctx.save();
    ctx.globalAlpha *= muscle.opacity * 0.30;
    ctx.strokeStyle = palette.fiber;
    ctx.lineWidth = Math.max(0.35, 0.5 * scale);
    edge.forEach((point, index) => {
        if (index % 2 !== 0 && edge.length > 5) return;
        const control = mid(point, insertion);
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.quadraticCurveTo(control.x, control.y, insertion.x, insertion.y);
        ctx.stroke();
    });
    ctx.restore();
}

function drawFaceMusclePatch(ctx, points, options = {}) {
    if (!points || points.length < 3) return;
    const palette = FACE_MUSCLE_PALETTES[options.tone] || FACE_MUSCLE_PALETTES.superficial;
    drawAnatomicalMuscleMass(ctx, points, {
        light: palette.light,
        mid: palette.mid,
        dark: palette.dark,
        alpha: options.alpha ?? 0.72,
        scale: options.scale ?? 1,
        shadowAlpha: 0.30,
        strokeAlpha: 0.42,
        feather: true,
        featherAlpha: 0.24,
        featherScale: 1.045,
        featherColor: palette.shadow,
        fiberA: options.fiberA,
        fiberB: options.fiberB,
        fiberCount: options.fiberCount ?? 7,
        fiberSpread: Math.max(5, Math.max(...points.map(point => dist(point, averagePoints(points)))) * 0.58),
    });
}

function drawFacialMuscleRibbon(ctx, points, options = {}) {
    if (!points || points.length < 2) return;
    const samples = sampleBezierSpline(points, 10);
    const widths = createMuscleWidthProfile(
        samples.length,
        Math.max(1.2, options.startWidth ?? 3),
        Math.max(2.1, options.midWidth ?? 7),
        Math.max(1.1, options.endWidth ?? 2)
    );
    const palette = FACE_MUSCLE_PALETTES[options.tone] || FACE_MUSCLE_PALETTES.superficial;
    const middleIndex = Math.floor(samples.length / 2);
    const middle = samples[middleIndex];
    const before = samples[Math.max(0, middleIndex - 1)];
    const after = samples[Math.min(samples.length - 1, middleIndex + 1)];
    const tangent = normalizeVector({ x: after.x - before.x, y: after.y - before.y }, { x: 0, y: -1 });
    const normal = perpendicularVector(tangent);
    const maxWidth = Math.max(...widths);
    const crossShade = ctx.createLinearGradient(
        middle.x + normal.x * maxWidth * 0.56,
        middle.y + normal.y * maxWidth * 0.56,
        middle.x - normal.x * maxWidth * 0.56,
        middle.y - normal.y * maxWidth * 0.56,
    );
    crossShade.addColorStop(0, palette.dark);
    crossShade.addColorStop(0.26, palette.mid);
    crossShade.addColorStop(0.52, palette.light);
    crossShade.addColorStop(0.76, palette.mid);
    crossShade.addColorStop(1, palette.dark);

    ctx.save();
    ctx.globalAlpha *= options.alpha ?? 0.74;
    drawTendonRibbon(ctx, samples, widths.map(width => width + 1.6), {
        fill: palette.shadow,
        offset: { x: 0.55, y: 0.85 },
    });
    drawTendonRibbon(ctx, samples, widths, {
        fill: crossShade,
        stroke: palette.edge,
        lineWidth: 0.48,
    });
    drawTendonRibbon(ctx, samples, widths.map(width => Math.max(0.6, width * 0.13)), {
        fill: palette.highlight,
    });
    drawTendonEdgeContour(ctx, samples, widths, palette.edge, 0.36);

    const fiberCount = clamp(options.fiberCount ?? 4, 2, 7);
    for (let index = 0; index < fiberCount; index++) {
        const fraction = fiberCount === 1 ? 0 : (index / (fiberCount - 1) - 0.5) * 0.58;
        const fiberSamples = offsetRibbonSamples(samples, widths, fraction);
        drawTendonCenterHighlight(
            ctx,
            fiberSamples,
            Math.max(0.28, maxWidth * 0.028),
            palette.fiber,
        );
    }
    ctx.restore();
}

function offsetRibbonSamples(samples, widths, fraction) {
    return samples.map((point, index) => {
        const before = samples[Math.max(0, index - 1)];
        const after = samples[Math.min(samples.length - 1, index + 1)];
        const tangent = normalizeVector({ x: after.x - before.x, y: after.y - before.y }, { x: 0, y: -1 });
        const normal = perpendicularVector(tangent);
        return {
            x: point.x + normal.x * widths[index] * fraction,
            y: point.y + normal.y * widths[index] * fraction,
        };
    });
}

function appendAnnularPath(ctx, outer, inner) {
    ctx.beginPath();
    appendSmoothLoop(ctx, outer);
    appendSmoothLoop(ctx, [...inner].reverse());
}

function traceSmoothLoop(ctx, points) {
    ctx.beginPath();
    appendSmoothLoop(ctx, points);
}

function appendSmoothLoop(ctx, points) {
    const firstMid = mid(points[points.length - 1], points[0]);
    ctx.moveTo(firstMid.x, firstMid.y);
    points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        const nextMid = mid(point, next);
        ctx.quadraticCurveTo(point.x, point.y, nextMid.x, nextMid.y);
    });
    ctx.closePath();
}

function drawFaceMuscleLabels(ctx, labels, labelMode, bounds, faceRegion) {
    if (labelMode === 'off') return;
    drawSmartLabels(ctx, labels, bounds, {
        maxLabels: labelMode === 'simple' ? 6 : (faceRegion.right - faceRegion.left > 380 ? 14 : 11),
        theme: 'medical',
        fontSize: labelMode === 'simple' ? 11 : 10,
        keepLeadersShort: true,
        outwardFromCenter: true,
        preferRegionEdge: true,
        avoidRegion: {
            left: faceRegion.left - (faceRegion.right - faceRegion.left) * 0.08,
            right: faceRegion.right + (faceRegion.right - faceRegion.left) * 0.08,
            top: faceRegion.top,
            bottom: faceRegion.bottom,
            centerX: faceRegion.centerX,
        },
    });
}

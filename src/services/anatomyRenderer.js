import { HAND, POSE, FACE } from '../services/handTracker';

// ═══════════════════════════════════════
//   HAND ANATOMY RENDERERS
// ═══════════════════════════════════════

export function drawHandMuscles(ctx, landmarks, w, h) {
    const p = (i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });

    // ── Thenar eminence (large muscle pad at thumb base) ──
    ctx.globalAlpha = 0.7;
    drawMuscleBelly(ctx, p(HAND.WRIST), p(HAND.THUMB_MCP),
        [p(HAND.THUMB_CMC), p(HAND.INDEX_MCP)], '#c42030', '#8b1520', 18);

    // ── Hypothenar (pinky-side muscle pad) ──
    drawMuscleBelly(ctx, p(HAND.WRIST), p(HAND.PINKY_MCP),
        [mid(p(HAND.WRIST), p(HAND.RING_MCP))], '#b82838', '#7a1a25', 14);

    // ── Interosseous muscles (4 between metacarpals) ──
    ctx.globalAlpha = 0.65;
    const mcps = [HAND.INDEX_MCP, HAND.MIDDLE_MCP, HAND.RING_MCP, HAND.PINKY_MCP];
    for (let i = 0; i < mcps.length - 1; i++) {
        const a = mid(p(HAND.WRIST), p(mcps[i]));
        const b = mid(p(mcps[i]), p(mcps[i + 1]));
        drawMuscleBundle(ctx, a, b, '#a52535', 8, 5);
    }

    // ── Finger flexor muscles (along each finger) ──
    ctx.globalAlpha = 0.6;
    const fingers = [
        [HAND.INDEX_MCP, HAND.INDEX_PIP, HAND.INDEX_DIP],
        [HAND.MIDDLE_MCP, HAND.MIDDLE_PIP, HAND.MIDDLE_DIP],
        [HAND.RING_MCP, HAND.RING_PIP, HAND.RING_DIP],
        [HAND.PINKY_MCP, HAND.PINKY_PIP, HAND.PINKY_DIP],
    ];
    fingers.forEach(seg => {
        drawMuscleBundle(ctx, p(seg[0]), p(seg[1]), '#c03040', 6, 4);
        drawMuscleBundle(ctx, p(seg[1]), p(seg[2]), '#b82838', 5, 3);
    });
    // Thumb muscles
    drawMuscleBundle(ctx, p(HAND.THUMB_CMC), p(HAND.THUMB_MCP), '#c03040', 7, 5);
    drawMuscleBundle(ctx, p(HAND.THUMB_MCP), p(HAND.THUMB_IP), '#b82838', 6, 4);

    // ── Tendons (white/pink lines running to fingertips) ──
    ctx.globalAlpha = 0.7;
    [[HAND.INDEX_MCP, HAND.INDEX_PIP, HAND.INDEX_DIP, HAND.INDEX_TIP],
    [HAND.MIDDLE_MCP, HAND.MIDDLE_PIP, HAND.MIDDLE_DIP, HAND.MIDDLE_TIP],
    [HAND.RING_MCP, HAND.RING_PIP, HAND.RING_DIP, HAND.RING_TIP],
    [HAND.PINKY_MCP, HAND.PINKY_PIP, HAND.PINKY_DIP, HAND.PINKY_TIP],
    [HAND.THUMB_CMC, HAND.THUMB_MCP, HAND.THUMB_IP, HAND.THUMB_TIP],
    ].forEach(f => drawTendonLine(ctx, f.map(i => p(i))));

    // ── Flexor retinaculum (wrist band) ──
    ctx.globalAlpha = 0.5;
    const wl = p(HAND.WRIST);
    const wristWidth = dist(p(HAND.INDEX_MCP), p(HAND.PINKY_MCP)) * 0.5;
    drawMuscleBand(ctx, wl, wristWidth);

    ctx.globalAlpha = 1;
    drawLabel(ctx, 'Thenar Eminence', mid(p(HAND.THUMB_CMC), p(HAND.INDEX_MCP)), '#ff6680');
    drawLabel(ctx, 'Hypothenar', mid(p(HAND.WRIST), p(HAND.PINKY_MCP)), '#ff6680');
    drawLabel(ctx, 'Dorsal Interossei', mid(p(HAND.MIDDLE_MCP), mid(p(HAND.RING_MCP), p(HAND.WRIST))), '#ff6680');
    drawLabel(ctx, 'Flexor Tendons', mid(p(HAND.MIDDLE_PIP), p(HAND.MIDDLE_DIP)), '#ff6680');
    drawLabel(ctx, 'Retinaculum', wl, '#ff6680');
}

export function drawHandSkeleton(ctx, landmarks, w, h) {
    const p = (i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });

    // ── Draw phalanges (finger bones) ──
    // Each finger segment is a proper bone shape
    // Separate bone lists so we can size each row differently
    const proximalBones = [
        [HAND.INDEX_MCP,  HAND.INDEX_PIP],
        [HAND.MIDDLE_MCP, HAND.MIDDLE_PIP],
        [HAND.RING_MCP,   HAND.RING_PIP],
        [HAND.PINKY_MCP,  HAND.PINKY_PIP],
        [HAND.THUMB_MCP,  HAND.THUMB_IP],
    ];
    const middleBones = [
        [HAND.INDEX_PIP,  HAND.INDEX_DIP],
        [HAND.MIDDLE_PIP, HAND.MIDDLE_DIP],
        [HAND.RING_PIP,   HAND.RING_DIP],
        [HAND.PINKY_PIP,  HAND.PINKY_DIP],
    ];
    const distalBones = [
        [HAND.INDEX_DIP,  HAND.INDEX_TIP],
        [HAND.MIDDLE_DIP, HAND.MIDDLE_TIP],
        [HAND.RING_DIP,   HAND.RING_TIP],
        [HAND.PINKY_DIP,  HAND.PINKY_TIP],
        [HAND.THUMB_IP,   HAND.THUMB_TIP],
    ];

    const metacarpals = [
        [HAND.WRIST, HAND.INDEX_MCP],
        [HAND.WRIST, HAND.MIDDLE_MCP],
        [HAND.WRIST, HAND.RING_MCP],
        [HAND.WRIST, HAND.PINKY_MCP],
        [HAND.WRIST, HAND.THUMB_CMC],
        [HAND.THUMB_CMC, HAND.THUMB_MCP],
    ];

    ctx.globalAlpha = 1;

    // Metacarpals — thick bones filling the palm
    metacarpals.forEach(([a, b]) => drawRealBone(ctx, p(a), p(b), 24, 14));

    // Proximal phalanges — wide with prominent condyle ends
    proximalBones.forEach(([a, b]) => drawRealBone(ctx, p(a), p(b), 22, 13));

    // Middle phalanges
    middleBones.forEach(([a, b]) => drawRealBone(ctx, p(a), p(b), 20, 12));

    // Distal phalanges — special paddle/tuft shape at fingertips
    distalBones.forEach(([a, b]) => drawDistalPhalanx(ctx, p(a), p(b), 16, 12));

    // ── Carpal bones (wrist cluster) — already great, keep as-is ──
    drawCarpalCluster(ctx, p(HAND.WRIST), landmarks, w, h);

    // Joints are formed naturally by the wider condyle ends of adjacent bones

    drawLabel(ctx, 'Distal Phalanx', p(HAND.MIDDLE_TIP), '#00ff88');
    drawLabel(ctx, 'Middle Phalanx', mid(p(HAND.INDEX_PIP), p(HAND.INDEX_DIP)), '#00ff88');
    drawLabel(ctx, 'Proximal Phalanx', mid(p(HAND.RING_MCP), p(HAND.RING_PIP)), '#00ff88');
    drawLabel(ctx, 'Metacarpals', mid(p(HAND.MIDDLE_MCP), p(HAND.WRIST)), '#00ff88');
    drawLabel(ctx, 'Carpals', p(HAND.WRIST), '#00ff88');
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

// ── Distal phalanx: tapers from wide base to smooth narrow rounded tip ──
// Real distal phalanges narrow smoothly toward the fingertip, ending in a
// gentle rounded point — NOT a wide paddle shape.
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

// ── Muscle belly: large muscle mass with gradient + fiber lines ──
function drawMuscleBelly(ctx, origin, insertion, controlPts, colorLight, colorDark, width) {
    const dx = insertion.x - origin.x, dy = insertion.y - origin.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const nx = -dy / len, ny = dx / len;

    // Gradient for muscle tissue
    const grad = ctx.createLinearGradient(
        origin.x + nx * width, origin.y + ny * width,
        origin.x - nx * width, origin.y - ny * width
    );
    grad.addColorStop(0, colorDark);
    grad.addColorStop(0.2, colorLight);
    grad.addColorStop(0.5, colorDark);
    grad.addColorStop(0.8, colorLight);
    grad.addColorStop(1, colorDark);

    ctx.fillStyle = grad;
    ctx.strokeStyle = colorDark;
    ctx.lineWidth = 1.5;

    // Build muscle shape with control points
    const allPts = [origin, ...controlPts, insertion];
    ctx.beginPath();
    ctx.moveTo(allPts[0].x + nx * width * 0.3, allPts[0].y + ny * width * 0.3);
    for (let i = 1; i < allPts.length; i++) {
        const buldge = (i === Math.floor(allPts.length / 2)) ? 1.3 : 0.9;
        ctx.lineTo(allPts[i].x + nx * width * buldge, allPts[i].y + ny * width * buldge);
    }
    for (let i = allPts.length - 1; i >= 0; i--) {
        const buldge = (i === Math.floor(allPts.length / 2)) ? 1.3 : 0.9;
        ctx.lineTo(allPts[i].x - nx * width * buldge, allPts[i].y - ny * width * buldge);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fiber lines (parallel striations)
    ctx.strokeStyle = colorLight;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha *= 0.4;
    for (let f = -3; f <= 3; f++) {
        const offset = f * width * 0.15;
        ctx.beginPath();
        ctx.moveTo(origin.x + nx * offset, origin.y + ny * offset);
        for (let i = 1; i < allPts.length; i++) {
            ctx.lineTo(allPts[i].x + nx * offset, allPts[i].y + ny * offset);
        }
        ctx.stroke();
    }
    ctx.globalAlpha /= 0.4;
}

// ── Muscle bundle: individual spindle-shaped muscle with fibers ──
function drawMuscleBundle(ctx, a, b, color, endWidth, midWidth) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const nx = -dy / len, ny = dx / len;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;

    // Spindle shape with bulging middle
    const grad = ctx.createLinearGradient(
        mx + nx * midWidth * 1.5, my + ny * midWidth * 1.5,
        mx - nx * midWidth * 1.5, my - ny * midWidth * 1.5
    );
    grad.addColorStop(0, color + '40');
    grad.addColorStop(0.3, color);
    grad.addColorStop(0.5, color + 'cc');
    grad.addColorStop(0.7, color);
    grad.addColorStop(1, color + '40');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * endWidth * 0.3, a.y + ny * endWidth * 0.3);
    ctx.quadraticCurveTo(mx + nx * midWidth * 1.4, my + ny * midWidth * 1.4,
        b.x + nx * endWidth * 0.3, b.y + ny * endWidth * 0.3);
    ctx.lineTo(b.x - nx * endWidth * 0.3, b.y - ny * endWidth * 0.3);
    ctx.quadraticCurveTo(mx - nx * midWidth * 1.4, my - ny * midWidth * 1.4,
        a.x - nx * endWidth * 0.3, a.y - ny * endWidth * 0.3);
    ctx.closePath();
    ctx.fill();

    // Fiber striations
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.6;
    ctx.globalAlpha *= 0.35;
    for (let f = -2; f <= 2; f++) {
        const fo = f * midWidth * 0.2;
        ctx.beginPath();
        ctx.moveTo(a.x + nx * fo * 0.4, a.y + ny * fo * 0.4);
        ctx.quadraticCurveTo(mx + nx * fo * 1.3, my + ny * fo * 1.3,
            b.x + nx * fo * 0.4, b.y + ny * fo * 0.4);
        ctx.stroke();
    }
    ctx.globalAlpha /= 0.35;

    // Muscle border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha *= 0.7;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * endWidth * 0.3, a.y + ny * endWidth * 0.3);
    ctx.quadraticCurveTo(mx + nx * midWidth * 1.4, my + ny * midWidth * 1.4,
        b.x + nx * endWidth * 0.3, b.y + ny * endWidth * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x - nx * endWidth * 0.3, a.y - ny * endWidth * 0.3);
    ctx.quadraticCurveTo(mx - nx * midWidth * 1.4, my - ny * midWidth * 1.4,
        b.x - nx * endWidth * 0.3, b.y - ny * endWidth * 0.3);
    ctx.stroke();
    ctx.globalAlpha /= 0.7;
}

// ── Tendon line: white/pink cord connecting muscle to bone ──
function drawTendonLine(ctx, points) {
    if (points.length < 2) return;
    // Outer glow
    ctx.strokeStyle = '#ffbbbb';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha *= 0.3;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.stroke();
    ctx.globalAlpha /= 0.3;

    // Core tendon
    ctx.strokeStyle = '#f0d0d0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.stroke();
}

// ── Muscle band (retinaculum): horizontal band across wrist ──
function drawMuscleBand(ctx, center, width) {
    const grad = ctx.createLinearGradient(center.x - width, center.y, center.x + width, center.y);
    grad.addColorStop(0, '#99222240');
    grad.addColorStop(0.5, '#bb3344aa');
    grad.addColorStop(1, '#99222240');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#aa3344';
    ctx.lineWidth = 1;
    ctx.fillRect(center.x - width, center.y - 5, width * 2, 10);
    ctx.strokeRect(center.x - width, center.y - 5, width * 2, 10);

    // Horizontal fibers
    ctx.strokeStyle = '#cc445566';
    ctx.lineWidth = 0.5;
    for (let y = -3; y <= 3; y += 2) {
        ctx.beginPath();
        ctx.moveTo(center.x - width * 0.9, center.y + y);
        ctx.lineTo(center.x + width * 0.9, center.y + y);
        ctx.stroke();
    }
}

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
    ctx.font = '10px "Share Tech Mono", monospace';
    const metrics = ctx.measureText(text.toUpperCase());
    const pad = 4;
    const lx = point.x + 15, ly = point.y - 5;

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const UPPER_LIP_LINE = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LOWER_LIP_LINE = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];

export function drawFaceSkull(ctx, landmarks, w, h) {
    const p = (i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
    const F = FACE;

    const foreheadTop = p(F.FOREHEAD_TOP);
    const chin = p(F.CHIN);
    const leftTemple = p(F.LEFT_TEMPLE);
    const rightTemple = p(F.RIGHT_TEMPLE);
    const nose = p(F.NOSE_TIP);
    const faceHeight = dist(foreheadTop, chin);
    const faceWidth = dist(leftTemple, rightTemple);
    const centerX = (leftTemple.x + rightTemple.x) / 2;
    const crownY = foreheadTop.y - faceHeight * 0.12;

    // ═══ 1. CRANIUM — full skull following face contour ═══
    ctx.save();
    ctx.globalAlpha = 0.9;

    const cranGrad = ctx.createRadialGradient(
        centerX, foreheadTop.y - faceHeight * 0.05, faceWidth * 0.05,
        centerX, foreheadTop.y, faceWidth * 0.8
    );
    cranGrad.addColorStop(0, '#f8f4ee');
    cranGrad.addColorStop(0.2, '#ede5d8');
    cranGrad.addColorStop(0.45, '#ddd5c5');
    cranGrad.addColorStop(0.7, '#c8c0b0');
    cranGrad.addColorStop(0.9, '#a8a090');
    cranGrad.addColorStop(1, '#908878');

    ctx.fillStyle = cranGrad;
    ctx.strokeStyle = '#706050';
    ctx.lineWidth = 2.5;

    const contourPts = FACE_CONTOUR.map(i => p(i));
    ctx.beginPath();
    ctx.moveTo(contourPts[0].x, contourPts[0].y);
    ctx.quadraticCurveTo(
        contourPts[0].x + faceWidth * 0.15, crownY - faceHeight * 0.04,
        centerX, crownY
    );
    ctx.quadraticCurveTo(
        contourPts[contourPts.length - 1].x - faceWidth * 0.15, crownY - faceHeight * 0.04,
        contourPts[contourPts.length - 1].x, contourPts[contourPts.length - 1].y
    );
    for (let i = contourPts.length - 1; i >= 0; i--) {
        ctx.lineTo(contourPts[i].x, contourPts[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Thick inner edge shadow for 3D depth
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#30201580';
    ctx.lineWidth = faceWidth * 0.1;
    ctx.stroke();
    ctx.restore();

    // ═══ 2. SUTURE LINES (subtle, just coronal + temporal) ═══
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#605040';
    ctx.lineWidth = 1.5;
    // Coronal suture only (horizontal across top of skull)
    drawSutureLine(ctx,
        { x: leftTemple.x - faceWidth * 0.03, y: leftTemple.y - faceHeight * 0.06 },
        { x: rightTemple.x + faceWidth * 0.03, y: rightTemple.y - faceHeight * 0.06 },
        faceWidth * 0.015
    );
    // Temporal sutures (sides)
    drawSutureLine(ctx, leftTemple, p(F.LEFT_CHEEK), faceWidth * 0.01);
    drawSutureLine(ctx, rightTemple, p(F.RIGHT_CHEEK), faceWidth * 0.01);

    // ═══ 3. ORBITAL CAVITIES (deep, large sockets) ═══
    ctx.globalAlpha = 0.92;
    [LEFT_EYE_RING, RIGHT_EYE_RING].forEach(ring => {
        const eyePts = ring.map(i => p(i));
        const cx = eyePts.reduce((s, pt) => s + pt.x, 0) / eyePts.length;
        const cy = eyePts.reduce((s, pt) => s + pt.y, 0) / eyePts.length;

        // Scale 2x — sockets are much bigger than eyes
        const scaled = eyePts.map(pt => ({
            x: cx + (pt.x - cx) * 2.0,
            y: cy + (pt.y - cy) * 1.8 - faceHeight * 0.01
        }));

        const maxR = Math.max(...scaled.map(pt => dist(pt, { x: cx, y: cy })));

        // Very dark socket interior
        const sg = ctx.createRadialGradient(cx, cy, maxR * 0.05, cx, cy, maxR);
        sg.addColorStop(0, '#050510d0');
        sg.addColorStop(0.3, '#0a0a18c0');
        sg.addColorStop(0.6, '#181828b0');
        sg.addColorStop(0.85, '#303040a0');
        sg.addColorStop(1, '#50504060');

        ctx.fillStyle = sg;
        ctx.strokeStyle = '#706050';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(scaled[0].x, scaled[0].y);
        for (let i = 1; i < scaled.length; i++) {
            const prev = scaled[i - 1], cur = scaled[i];
            ctx.quadraticCurveTo((prev.x + cur.x) / 2, (prev.y + cur.y) / 2, cur.x, cur.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner bone ridge (inside socket rim)
        ctx.strokeStyle = '#b0a898';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.3;
        const innerRim = eyePts.map(pt => ({
            x: cx + (pt.x - cx) * 1.7,
            y: cy + (pt.y - cy) * 1.5 - faceHeight * 0.01
        }));
        ctx.beginPath();
        ctx.moveTo(innerRim[0].x, innerRim[0].y);
        innerRim.forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.closePath();
        ctx.stroke();

        // Thick supraorbital brow ridge
        ctx.strokeStyle = '#e0d8c8';
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        const brow = scaled.slice(0, Math.floor(scaled.length / 2));
        ctx.moveTo(brow[0].x, brow[0].y - 3);
        brow.forEach(pt => ctx.lineTo(pt.x, pt.y - 3));
        ctx.stroke();

        // Brow ridge shadow below
        ctx.strokeStyle = '#50403080';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(brow[0].x, brow[0].y + 1);
        brow.forEach(pt => ctx.lineTo(pt.x, pt.y + 1));
        ctx.stroke();
        ctx.globalAlpha = 0.92;
    });

    // ═══ 4. NASAL APERTURE ═══
    const noseTop = p(F.NOSE_BRIDGE);
    const noseBottom = p(F.NOSE_BOTTOM);

    // Nasal bone outline only (thin line, not filled trapezoid)
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#806850';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(noseTop.x - faceWidth * 0.03, noseTop.y + faceHeight * 0.01);
    ctx.lineTo(noseTop.x + faceWidth * 0.03, noseTop.y + faceHeight * 0.01);
    ctx.stroke();

    // Piriform aperture (large, deep nasal hole)
    ctx.globalAlpha = 0.9;
    const noseCenter = { x: nose.x, y: (nose.y + noseBottom.y) / 2 };
    const ng = ctx.createRadialGradient(
        noseCenter.x, noseCenter.y, faceWidth * 0.005,
        noseCenter.x, noseCenter.y, faceWidth * 0.12
    );
    ng.addColorStop(0, '#050510e0');
    ng.addColorStop(0.4, '#0a0a18c0');
    ng.addColorStop(0.7, '#1a1a2590');
    ng.addColorStop(1, '#30303060');
    ctx.fillStyle = ng;
    ctx.strokeStyle = '#706050';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Top point (narrower)
    ctx.moveTo(nose.x, nose.y - faceHeight * 0.02);
    // Left side curving out
    ctx.quadraticCurveTo(nose.x - faceWidth * 0.08, nose.y + faceHeight * 0.02,
        nose.x - faceWidth * 0.055, noseBottom.y);
    // Bottom curve (wide)
    ctx.quadraticCurveTo(nose.x, noseBottom.y + faceHeight * 0.025,
        nose.x + faceWidth * 0.055, noseBottom.y);
    // Right side curving back
    ctx.quadraticCurveTo(nose.x + faceWidth * 0.08, nose.y + faceHeight * 0.02,
        nose.x, nose.y - faceHeight * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Septum (bony divider)
    ctx.strokeStyle = '#c0b8a890';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nose.x, nose.y - faceHeight * 0.01);
    ctx.lineTo(nose.x, noseBottom.y + faceHeight * 0.005);
    ctx.stroke();
    // Nasal conchae (turbinate bumps inside cavity)
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#b0a898';
    ctx.beginPath();
    ctx.ellipse(nose.x - faceWidth * 0.02, noseBottom.y - faceHeight * 0.01, faceWidth * 0.02, faceHeight * 0.008, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(nose.x + faceWidth * 0.02, noseBottom.y - faceHeight * 0.01, faceWidth * 0.02, faceHeight * 0.008, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // ═══ 5. ZYGOMATIC ARCHES (thicker, more prominent) ═══
    ctx.globalAlpha = 0.7;
    drawRealBone(ctx, leftTemple, p(F.LEFT_CHEEK), 8, 5);
    drawRealBone(ctx, rightTemple, p(F.RIGHT_CHEEK), 8, 5);
    // Connect to orbital rim
    drawRealBone(ctx, p(F.LEFT_CHEEK), { x: p(LEFT_EYE_RING[12]).x, y: p(LEFT_EYE_RING[12]).y + faceHeight * 0.02 }, 5, 3);
    drawRealBone(ctx, p(F.RIGHT_CHEEK), { x: p(RIGHT_EYE_RING[12]).x, y: p(RIGHT_EYE_RING[12]).y + faceHeight * 0.02 }, 5, 3);

    // ═══ 6. MANDIBLE (thicker, stronger) ═══
    ctx.globalAlpha = 0.75;
    const leftJaw = p(F.LEFT_JAW);
    const rightJaw = p(F.RIGHT_JAW);
    drawRealBone(ctx, leftTemple, leftJaw, 8, 6);
    drawRealBone(ctx, rightTemple, rightJaw, 8, 6);
    drawRealBone(ctx, leftJaw, { x: (leftJaw.x + chin.x) / 2, y: chin.y }, 7, 6);
    drawRealBone(ctx, { x: (leftJaw.x + chin.x) / 2, y: chin.y }, chin, 6, 6);
    drawRealBone(ctx, chin, { x: (rightJaw.x + chin.x) / 2, y: chin.y }, 6, 6);
    drawRealBone(ctx, { x: (rightJaw.x + chin.x) / 2, y: chin.y }, rightJaw, 7, 6);

    // ═══ 7. TEETH (taller, more defined) ═══
    ctx.globalAlpha = 0.7;
    const mouthLeft = p(F.MOUTH_LEFT);
    const mouthRight = p(F.MOUTH_RIGHT);
    const upperLip = p(F.UPPER_LIP);
    const lowerLip = p(F.LOWER_LIP);
    const teethW = dist(mouthLeft, mouthRight);
    const teethN = 10;

    // Upper teeth (taller)
    for (let i = 0; i < teethN; i++) {
        const t = (i + 0.5) / teethN;
        const tx = mouthLeft.x + (mouthRight.x - mouthLeft.x) * t;
        // Front teeth wider, molars narrower
        const isFront = Math.abs(t - 0.5) < 0.2;
        const tw = teethW / teethN * (isFront ? 0.92 : 0.82);
        const th = faceHeight * (isFront ? 0.038 : 0.03);
        const tg = ctx.createLinearGradient(tx, upperLip.y - th * 0.3, tx, upperLip.y + th * 0.8);
        tg.addColorStop(0, '#f0e8e0');
        tg.addColorStop(0.5, '#e0d8d0');
        tg.addColorStop(1, '#d0c8c0');
        ctx.fillStyle = tg;
        ctx.strokeStyle = '#90807080';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx - tw / 2, upperLip.y - th * 0.3, tw, th, [1, 1, 2, 2]);
        ctx.fill();
        ctx.stroke();
    }
    // Lower teeth
    for (let i = 0; i < teethN; i++) {
        const t = (i + 0.5) / teethN;
        const tx = mouthLeft.x + (mouthRight.x - mouthLeft.x) * t;
        const isFront = Math.abs(t - 0.5) < 0.2;
        const tw = teethW / teethN * (isFront ? 0.88 : 0.78);
        const th = faceHeight * (isFront ? 0.032 : 0.025);
        const tg = ctx.createLinearGradient(tx, lowerLip.y - th, tx, lowerLip.y);
        tg.addColorStop(0, '#d8d0c8');
        tg.addColorStop(0.5, '#e0d8d0');
        tg.addColorStop(1, '#ece4dc');
        ctx.fillStyle = tg;
        ctx.strokeStyle = '#90807080';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx - tw / 2, lowerLip.y - th * 0.6, tw, th, [2, 2, 1, 1]);
        ctx.fill();
        ctx.stroke();
    }

    // ═══ 8. BONE TEXTURE (more visible) ═══
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#504030';
    for (let i = 0; i < 60; i++) {
        const ang = (i / 60) * Math.PI * 2;
        const r = faceWidth * 0.18 + Math.sin(i * 3.7) * faceWidth * 0.12;
        const px = centerX + Math.cos(ang) * r;
        const py = foreheadTop.y + faceHeight * 0.04 + Math.sin(ang) * r * 0.5;
        ctx.beginPath();
        ctx.arc(px, py, 0.6 + Math.sin(i * 2.1) * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    // Maxilla area texture (between nose and cheekbones)
    [p(F.LEFT_CHEEK), p(F.RIGHT_CHEEK)].forEach(cheek => {
        for (let i = 0; i < 10; i++) {
            const ox = Math.sin(i * 5.1) * faceWidth * 0.06;
            const oy = Math.cos(i * 3.3) * faceHeight * 0.04;
            ctx.beginPath();
            ctx.arc(cheek.x + ox, cheek.y + oy, 0.5 + Math.sin(i) * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // ═══ 9. LABELS ═══
    ctx.globalAlpha = 1;
    drawLabel(ctx, 'Frontal Bone', { x: centerX, y: crownY + faceHeight * 0.1 }, '#00ff88');
    drawLabel(ctx, 'Orbital Cavity', p(F.LEFT_EYE_TOP), '#00ff88');
    drawLabel(ctx, 'Nasal Bone', noseTop, '#00ff88');
    drawLabel(ctx, 'Zygomatic', p(F.LEFT_CHEEK), '#00ff88');
    drawLabel(ctx, 'Mandible', chin, '#00ff88');
    drawLabel(ctx, 'Maxilla', { x: mouthLeft.x - 10, y: upperLip.y - 8 }, '#00ff88');
    drawLabel(ctx, 'Teeth', { x: mouthRight.x, y: (upperLip.y + lowerLip.y) / 2 }, '#00ff88');
}

function drawSutureLine(ctx, a, b, amp) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const nx = -dy / len, ny = dx / len;
    const steps = Math.max(8, len / 5);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const wave = Math.sin(i * 2.7) * amp * ((i % 2) ? 1 : -1);
        ctx.lineTo(a.x + dx * t + nx * wave, a.y + dy * t + ny * wave);
    }
    ctx.stroke();
}

export function drawFaceMuscles(ctx, landmarks, w, h) {
    const p = (i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
    const F = FACE;

    const foreheadTop = p(F.FOREHEAD_TOP);
    const chin = p(F.CHIN);
    const leftTemple = p(F.LEFT_TEMPLE);
    const rightTemple = p(F.RIGHT_TEMPLE);
    const nose = p(F.NOSE_TIP);
    const faceHeight = dist(foreheadTop, chin);
    const faceWidth = dist(leftTemple, rightTemple);
    const centerX = (leftTemple.x + rightTemple.x) / 2;

    // Frontalis (forehead)
    ctx.globalAlpha = 0.5;
    drawMuscleBundle(ctx, { x: centerX - faceWidth * 0.2, y: foreheadTop.y }, p(F.NOSE_BRIDGE), '#c03040', 12, 16);
    drawMuscleBundle(ctx, { x: centerX + faceWidth * 0.2, y: foreheadTop.y }, p(F.NOSE_BRIDGE), '#c03040', 12, 16);

    // Orbicularis oculi
    ctx.globalAlpha = 0.45;
    [LEFT_EYE_RING, RIGHT_EYE_RING].forEach(ring => {
        const pts = ring.map(i => p(i));
        const cx = pts.reduce((s, pt) => s + pt.x, 0) / pts.length;
        const cy = pts.reduce((s, pt) => s + pt.y, 0) / pts.length;
        const scaled = pts.map(pt => ({ x: cx + (pt.x - cx) * 1.4, y: cy + (pt.y - cy) * 1.3 }));
        ctx.strokeStyle = '#c03040';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(scaled[0].x, scaled[0].y);
        scaled.forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.closePath();
        ctx.stroke();
    });

    // Masseter
    ctx.globalAlpha = 0.55;
    drawMuscleBundle(ctx, leftTemple, p(F.LEFT_JAW), '#b82838', 14, 18);
    drawMuscleBundle(ctx, rightTemple, p(F.RIGHT_JAW), '#b82838', 14, 18);

    // Temporalis
    ctx.globalAlpha = 0.4;
    drawMuscleBundle(ctx, { x: leftTemple.x - faceWidth * 0.05, y: leftTemple.y - faceHeight * 0.1 },
        leftTemple, '#a52535', 15, 10);
    drawMuscleBundle(ctx, { x: rightTemple.x + faceWidth * 0.05, y: rightTemple.y - faceHeight * 0.1 },
        rightTemple, '#a52535', 15, 10);

    // Orbicularis oris
    const mouthLeft = p(F.MOUTH_LEFT);
    const mouthRight = p(F.MOUTH_RIGHT);
    const mouthCx = (mouthLeft.x + mouthRight.x) / 2;
    const mouthCy = (p(F.UPPER_LIP).y + p(F.LOWER_LIP).y) / 2;
    ctx.globalAlpha = 0.45;
    const mouthRx = dist(mouthLeft, mouthRight) * 0.55;
    const mouthRy = dist(p(F.UPPER_LIP), p(F.LOWER_LIP)) * 0.7;
    ctx.strokeStyle = '#c03040';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(mouthCx, mouthCy, mouthRx, mouthRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Zygomaticus
    ctx.globalAlpha = 0.5;
    drawMuscleBundle(ctx, p(F.LEFT_CHEEK), mouthLeft, '#a52535', 5, 8);
    drawMuscleBundle(ctx, p(F.RIGHT_CHEEK), mouthRight, '#a52535', 5, 8);

    // Nasalis
    drawMuscleBundle(ctx, p(F.NOSE_BRIDGE), nose, '#b82838', 4, 6);

    // Depressor anguli oris
    ctx.globalAlpha = 0.4;
    drawMuscleBundle(ctx, mouthLeft, { x: chin.x - faceWidth * 0.1, y: chin.y }, '#a52535', 4, 6);
    drawMuscleBundle(ctx, mouthRight, { x: chin.x + faceWidth * 0.1, y: chin.y }, '#a52535', 4, 6);

    ctx.globalAlpha = 1;
    drawLabel(ctx, 'Frontalis', foreheadTop, '#ff6680');
    drawLabel(ctx, 'Orbicularis Oculi', p(F.LEFT_EYE_TOP), '#ff6680');
    drawLabel(ctx, 'Temporalis', { x: leftTemple.x - 5, y: leftTemple.y - faceHeight * 0.06 }, '#ff6680');
    drawLabel(ctx, 'Masseter', { x: leftTemple.x, y: (leftTemple.y + p(F.LEFT_JAW).y) / 2 }, '#ff6680');
    drawLabel(ctx, 'Orbicularis Oris', { x: mouthCx, y: mouthCy }, '#ff6680');
    drawLabel(ctx, 'Zygomaticus', p(F.LEFT_CHEEK), '#ff6680');
}


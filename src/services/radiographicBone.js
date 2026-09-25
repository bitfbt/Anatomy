// An educational radiograph-inspired projection, drawn in bone-local space.
// The fixed grain moves with the bone rather than changing as landmarks move.
const GRAIN = Array.from({ length: 42 }, (_, i) => ({
    x: fraction(Math.sin((i + 1) * 127.1) * 43758.5453) * 2 - 1,
    y: fraction(Math.sin((i + 1) * 311.7) * 19642.3491),
    tilt: fraction(Math.sin((i + 1) * 74.7) * 12741.231) - 0.5,
}));

function fraction(value) { return value - Math.floor(value); }

export function drawRadiographicBone(ctx, a, b, options = {}) {
    if (![a?.x, a?.y, b?.x, b?.y].every(Number.isFinite)) return;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const startWidth = options.startWidth ?? 8;
    const endWidth = options.endWidth ?? 6;
    const alpha = options.alpha ?? 0.84;
    const midScale = options.midScale ?? 1;
    if (length < 4 || ![length, startWidth, endWidth, alpha, midScale].every(Number.isFinite)
        || startWidth <= 0 || endWidth <= 0 || alpha <= 0 || midScale <= 0) return;

    const type = options.boneType || 'proximal';
    const distal = type === 'distal' || type === 'thumb-distal';
    const metacarpal = type === 'metacarpal' || type === 'thumb-metacarpal';
    // Widths are radii. Broad shafts avoid the pinched, dumbbell-like silhouette
    // of a joint rig; the modest cap also keeps foreshortened bones readable.
    const base = Math.min(startWidth, length * 0.28);
    const head = Math.min(endWidth * (distal ? 0.93 : 1), length * 0.28);
    const shaft = Math.min(base, head) * Math.min(1.16, midScale)
        * (distal ? 0.73 : metacarpal ? 0.79 : 0.83);
    const gap = Math.min(length * 0.044, Math.max(base, head) * 0.28);
    const y0 = gap;
    // Skin-tip landmarks include the fingertip pad beyond the distal tuft.
    const y1 = length * (distal ? 0.85 : 1) - gap;
    const span = y1 - y0;
    const bend = (type === 'thumb-metacarpal' ? 0.075 : 0.024) * base;
    const corticalWidth = Math.max(0.5, Math.min(base, head) * 0.085);

    function silhouette() {
        const shoulder = y0 + span * 0.11;
        ctx.beginPath();
        ctx.moveTo(-base * 0.92, y0);
        ctx.bezierCurveTo(-base * 1.04, y0 + base * 0.08,
            -base * 0.98, shoulder, -base * 0.89, shoulder + span * 0.045);
        ctx.bezierCurveTo(-shaft * 1.02, y0 + span * 0.29,
            -shaft + bend, y0 + span * 0.48, -shaft + bend, y0 + span * 0.61);
        if (distal) {
            // A terminal tuft is a rounded, slightly expanded tip, narrower than
            // the broad proximal base. It has no artificial joint at the nail.
            ctx.bezierCurveTo(-shaft * 0.92, y0 + span * 0.77,
                -head * 1.03, y0 + span * 0.79, -head * 0.94, y0 + span * 0.88);
            ctx.bezierCurveTo(-head * 0.99, y1 - head * 0.15,
                -head * 0.61, y1, -head * 0.14, y1);
            ctx.bezierCurveTo(head * 0.40, y1 + head * 0.025,
                head * 0.91, y1 - head * 0.14, head * 0.94, y0 + span * 0.89);
            ctx.bezierCurveTo(head * 1.03, y0 + span * 0.79,
                shaft * 0.98, y0 + span * 0.77, shaft + bend, y0 + span * 0.61);
        } else {
            ctx.bezierCurveTo(-shaft * 1.02 + bend, y0 + span * 0.76,
                -head * 1.08, y0 + span * 0.83, -head, y1 - head * 0.26);
            if (metacarpal) {
                ctx.bezierCurveTo(-head * 0.98, y1 + head * 0.09,
                    head * 0.77, y1 + head * 0.10, head, y1 - head * 0.26);
            } else {
                // A shallow groove separates two condyles without turning the
                // articular end into a cartoon heart or a separate joint sphere.
                ctx.bezierCurveTo(-head * 0.94, y1 + head * 0.035,
                    -head * 0.32, y1 + head * 0.055, 0, y1 - head * 0.035);
                ctx.bezierCurveTo(head * 0.38, y1 + head * 0.045,
                    head * 0.95, y1 + head * 0.015, head, y1 - head * 0.26);
            }
            ctx.bezierCurveTo(head * 1.07, y0 + span * 0.83,
                shaft * 1.08 + bend, y0 + span * 0.76, shaft + bend, y0 + span * 0.61);
        }
        ctx.bezierCurveTo(shaft + bend, y0 + span * 0.46,
            shaft * 1.09, y0 + span * 0.28, base * 0.91, shoulder + span * 0.045);
        ctx.bezierCurveTo(base * 1.04, shoulder, base * 1.05, y0 + base * 0.06, base * 0.94, y0);
        // The articular base is gently concave in the direction of the shaft.
        ctx.bezierCurveTo(base * 0.47, y0 + base * 0.15,
            -base * 0.35, y0 + base * (metacarpal ? 0.10 : 0.21), -base * 0.92, y0);
        ctx.closePath();
    }

    ctx.save();
    try {
        ctx.globalAlpha *= Math.min(1, alpha);
        ctx.translate(a.x, a.y);
        ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // The brighter outer cortex and darker medullary center imitate density
        // in the supplied radiograph. There is no directional metallic sheen.
        const density = ctx.createLinearGradient(-base, 0, base, 0);
        density.addColorStop(0, 'rgba(220, 224, 220, 0.92)');
        density.addColorStop(0.19, 'rgba(202, 208, 202, 0.88)');
        density.addColorStop(0.42, 'rgba(161, 169, 161, 0.78)');
        density.addColorStop(0.62, 'rgba(166, 173, 166, 0.80)');
        density.addColorStop(0.82, 'rgba(205, 210, 204, 0.90)');
        density.addColorStop(1, 'rgba(223, 226, 222, 0.94)');
        silhouette();
        ctx.fillStyle = density;
        ctx.fill();

        ctx.save();
        ctx.clip();
        // Fine cancellous struts concentrate near the ends, with a little grain
        // through the shaft. Two batched paths keep per-bone canvas work bounded.
        for (let pass = 0; pass < 2; pass++) {
            ctx.beginPath();
            for (let i = pass; i < GRAIN.length; i += 2) {
                const grain = GRAIN[i];
                const end = i % 3 !== 0;
                const t = end
                    ? (i % 2 ? 0.75 + grain.y * 0.20 : 0.05 + grain.y * 0.19)
                    : 0.17 + grain.y * 0.68;
                const radius = t < 0.24 ? base : t > 0.75 ? head : shaft;
                const x = grain.x * radius * 0.84;
                const y = y0 + t * span;
                const strut = Math.min(span * 0.038, radius * 0.32);
                ctx.moveTo(x, y);
                ctx.lineTo(x + grain.tilt * radius * 0.25, y + strut);
            }
            ctx.lineWidth = Math.max(0.32, base * (pass ? 0.028 : 0.033));
            ctx.strokeStyle = pass ? 'rgba(248, 250, 243, 0.25)' : 'rgba(77, 88, 78, 0.15)';
            ctx.stroke();
        }

        // Soft, broadened cortex on the long sides; the single thin outline
        // below closes the articular surfaces while leaving their dark gaps.
        silhouette();
        ctx.strokeStyle = 'rgba(238, 242, 231, 0.30)';
        ctx.lineWidth = corticalWidth * 3.4;
        ctx.stroke();
        ctx.restore();

        silhouette();
        ctx.lineWidth = corticalWidth;
        ctx.strokeStyle = 'rgba(237, 241, 232, 0.79)';
        ctx.stroke();
    } finally {
        ctx.restore();
    }
}

// Letter key in the supplied reference figure:
// https://www.ncbi.nlm.nih.gov/books/NBK535382/figure/article-18977.image.f1/
export const CARPAL_LABELS = [
    { id: 'scaphoid', letter: 'A', name: 'Scaphoid' },
    { id: 'lunate', letter: 'B', name: 'Lunate' },
    { id: 'triquetrum', letter: 'C', name: 'Triquetrum' },
    { id: 'pisiform', letter: 'D', name: 'Pisiform' },
    { id: 'trapezium', letter: 'E', name: 'Trapezium' },
    { id: 'trapezoid', letter: 'F', name: 'Trapezoid' },
    { id: 'capitate', letter: 'G', name: 'Capitate' },
    { id: 'hamate', letter: 'H', name: 'Hamate' },
];

export function drawCarpalLetters(ctx, bones, bounds) {
    const labels = CARPAL_LABELS.flatMap(entry => {
        const bone = bones.find(bone => bone.id === `carpal-${entry.id}`);
        if (!bone) return [];
        const anchor = bone.labelPoint || bone.center;
        if (anchor.x + bone.radius < bounds.left || anchor.x - bone.radius > bounds.right
            || anchor.y + bone.radius < bounds.top || anchor.y - bone.radius > bounds.bottom) return [];
        const fontSize = Math.max(13, Math.min(23, bone.radius * 0.66));
        const padding = fontSize * .65;
        return [{ ...entry, bone, anchor, fontSize, padding,
            x: Math.max(bounds.left + padding, Math.min(bounds.right - padding, anchor.x)),
            y: Math.max(bounds.top + padding, Math.min(bounds.bottom - padding, anchor.y)) }];
    });
    // Separate small, overlapping badges without changing the anatomical shapes.
    for (let pass = 0; pass < 12; pass += 1) {
        for (let i = 0; i < labels.length; i += 1) {
            for (let j = i + 1; j < labels.length; j += 1) {
                const a = labels[i], b = labels[j];
                const dx = b.x - a.x, dy = b.y - a.y;
                const distance = Math.hypot(dx, dy);
                const minimum = a.padding + b.padding + 2;
                if (distance >= minimum) continue;
                const ux = distance > .01 ? dx / distance : 1, uy = distance > .01 ? dy / distance : 0;
                const push = (minimum - distance) * .5;
                a.x -= ux * push; a.y -= uy * push;
                b.x += ux * push; b.y += uy * push;
            }
        }
        labels.forEach(label => {
            label.x = Math.max(bounds.left + label.padding, Math.min(bounds.right - label.padding, label.x));
            label.y = Math.max(bounds.top + label.padding, Math.min(bounds.bottom - label.padding, label.y));
        });
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hitTargets = [];
    labels.forEach(label => {
        const moved = Math.hypot(label.x - label.anchor.x, label.y - label.anchor.y) > label.padding * .6;
        if (moved) {
            ctx.beginPath();
            ctx.moveTo(label.anchor.x, label.anchor.y);
            ctx.lineTo(label.x, label.y);
            ctx.strokeStyle = 'rgba(247, 242, 229, .9)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(label.x, label.y, label.padding, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(237, 232, 214, .94)';
            ctx.fill();
        }
        ctx.font = `700 ${label.fontSize}px system-ui, sans-serif`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = 'rgba(247, 245, 229, .88)';
        ctx.strokeText(label.letter, label.x, label.y);
        ctx.fillStyle = '#141a17';
        ctx.fillText(label.letter, label.x, label.y);
        hitTargets.push({ ...label.bone, id: `letter-${label.bone.id}`, center: { x: label.x, y: label.y },
            radius: label.padding + 4, name: `${label.letter} · ${label.name}` });
    });
    ctx.restore();
    return hitTargets;
}

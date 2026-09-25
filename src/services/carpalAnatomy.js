// Educational PA-style projection of the eight carpal bones. These are authored
// vector contours, not patient-specific internal anatomy or a traced radiograph.
// The reference's A–H key is retained: proximal A–D, distal E–H.
// Coordinates run from radial to ulnar (x), and distal to proximal (y). Keeping
// every contour in one template lets adjoining articular edges fit together.
const CARPALS = [
    {
        id: 'scaphoid', name: 'Scaphoid', letter: 'A', row: 'proximal',
        center: [-0.205, 0.135], rx: 0.157, ry: 0.19,
        location: 'proximal row, elongated bone on the radial/thumb side',
        path: [
            ['M', -0.335, 0.065],
            ['C', -0.334, 0.025, -0.306, -0.011, -0.270, -0.030],
            ['C', -0.235, -0.051, -0.180, -0.069, -0.140, -0.046],
            ['C', -0.117, -0.031, -0.135, 0.020, -0.139, 0.052],
            ['C', -0.145, 0.109, -0.119, 0.157, -0.079, 0.184],
            ['C', -0.060, 0.217, -0.087, 0.273, -0.128, 0.294],
            ['C', -0.177, 0.318, -0.239, 0.273, -0.274, 0.231],
            ['C', -0.308, 0.190, -0.350, 0.122, -0.335, 0.065],
        ],
    },
    {
        id: 'lunate', name: 'Lunate', letter: 'B', row: 'proximal',
        center: [0.065, 0.279], rx: 0.14, ry: 0.087,
        location: 'proximal row, crescent-shaped central wrist bone',
        path: [
            ['M', -0.062, 0.225],
            ['C', -0.045, 0.201, -0.025, 0.177, -0.007, 0.184],
            ['C', 0.022, 0.221, 0.079, 0.227, 0.112, 0.199],
            ['C', 0.132, 0.184, 0.147, 0.206, 0.168, 0.228],
            ['C', 0.198, 0.257, 0.214, 0.296, 0.176, 0.322],
            ['C', 0.139, 0.349, 0.063, 0.358, 0.017, 0.341],
            ['C', -0.032, 0.323, -0.081, 0.275, -0.062, 0.225],
        ],
    },
    {
        id: 'triquetrum', name: 'Triquetrum', letter: 'C', row: 'proximal',
        center: [0.275, 0.137], rx: 0.14, ry: 0.136,
        location: 'proximal row, triangular bone on the ulnar/little-finger side',
        path: [
            ['M', 0.170, 0.103],
            ['C', 0.198, 0.085, 0.214, 0.026, 0.264, 0.015],
            ['C', 0.311, 0.006, 0.360, 0.024, 0.390, 0.059],
            ['C', 0.414, 0.097, 0.385, 0.158, 0.360, 0.206],
            ['C', 0.339, 0.248, 0.301, 0.275, 0.268, 0.257],
            ['C', 0.228, 0.240, 0.215, 0.213, 0.187, 0.202],
            ['C', 0.157, 0.185, 0.148, 0.135, 0.170, 0.103],
        ],
    },
    {
        id: 'trapezium', name: 'Trapezium', letter: 'E', row: 'distal',
        center: [-0.403, -0.125], rx: 0.13, ry: 0.126,
        location: 'distal row under the thumb metacarpal',
        path: [
            ['M', -0.514, -0.185],
            ['C', -0.493, -0.217, -0.454, -0.229, -0.423, -0.229],
            ['C', -0.393, -0.232, -0.352, -0.256, -0.327, -0.238],
            ['C', -0.302, -0.219, -0.321, -0.176, -0.304, -0.147],
            ['C', -0.286, -0.115, -0.299, -0.079, -0.330, -0.055],
            ['C', -0.354, -0.032, -0.393, -0.016, -0.426, -0.018],
            ['C', -0.465, -0.020, -0.502, -0.027, -0.512, -0.060],
            ['C', -0.521, -0.091, -0.535, -0.146, -0.514, -0.185],
        ],
    },
    {
        id: 'trapezoid', name: 'Trapezoid', letter: 'F', row: 'distal',
        center: [-0.228, -0.19], rx: 0.085, ry: 0.11,
        location: 'distal row under the index metacarpal',
        path: [
            ['M', -0.298, -0.270],
            ['C', -0.274, -0.292, -0.201, -0.300, -0.165, -0.278],
            ['C', -0.142, -0.262, -0.141, -0.223, -0.145, -0.192],
            ['C', -0.147, -0.159, -0.139, -0.121, -0.167, -0.094],
            ['C', -0.196, -0.075, -0.231, -0.079, -0.261, -0.092],
            ['C', -0.282, -0.104, -0.276, -0.143, -0.292, -0.163],
            ['C', -0.312, -0.190, -0.311, -0.248, -0.298, -0.270],
        ],
    },
    {
        id: 'capitate', name: 'Capitate', letter: 'G', row: 'distal',
        center: [0.001, -0.075], rx: 0.143, ry: 0.256,
        location: 'distal row, largest central carpal under the middle metacarpal',
        path: [
            ['M', -0.120, -0.287],
            ['C', -0.090, -0.312, 0.051, -0.332, 0.097, -0.306],
            ['C', 0.137, -0.281, 0.138, -0.228, 0.124, -0.176],
            ['C', 0.111, -0.128, 0.111, -0.075, 0.132, -0.027],
            ['C', 0.162, 0.038, 0.139, 0.133, 0.106, 0.163],
            ['C', 0.074, 0.194, 0.018, 0.196, -0.019, 0.164],
            ['C', -0.071, 0.129, -0.121, 0.083, -0.120, 0.027],
            ['C', -0.111, -0.031, -0.099, -0.070, -0.117, -0.102],
            ['C', -0.138, -0.143, -0.144, -0.254, -0.120, -0.287],
        ],
    },
    {
        id: 'hamate', name: 'Hamate', letter: 'H', row: 'distal',
        center: [0.275, -0.17], rx: 0.148, ry: 0.145,
        location: 'distal row under the ring and little-finger metacarpals',
        path: [
            ['M', 0.158, -0.301],
            ['C', 0.183, -0.320, 0.222, -0.284, 0.259, -0.283],
            ['C', 0.296, -0.280, 0.343, -0.284, 0.381, -0.259],
            ['C', 0.414, -0.238, 0.432, -0.211, 0.418, -0.173],
            ['C', 0.401, -0.127, 0.367, -0.091, 0.339, -0.051],
            ['C', 0.310, -0.009, 0.276, -0.017, 0.248, -0.007],
            ['C', 0.216, 0.002, 0.194, 0.049, 0.172, 0.063],
            ['C', 0.157, 0.038, 0.158, -0.011, 0.144, -0.041],
            ['C', 0.121, -0.098, 0.145, -0.129, 0.146, -0.176],
            ['C', 0.151, -0.220, 0.139, -0.274, 0.158, -0.301],
        ],
    },
    // A palmar sesamoid superimposed on the triquetrum in this projection. Its
    // small ulnar overlay is intentionally painted last, not as a ninth-row bead.
    {
        id: 'pisiform', name: 'Pisiform', letter: 'D', row: 'proximal',
        center: [0.389, 0.041], rx: 0.066, ry: 0.089,
        location: 'small palmar bone overlapping the triquetrum on the ulnar side',
        path: [
            ['M', 0.347, -0.010],
            ['C', 0.363, -0.047, 0.402, -0.055, 0.432, -0.035],
            ['C', 0.463, -0.014, 0.456, 0.031, 0.445, 0.066],
            ['C', 0.434, 0.103, 0.408, 0.128, 0.381, 0.122],
            ['C', 0.351, 0.116, 0.332, 0.086, 0.335, 0.056],
            ['C', 0.337, 0.030, 0.338, 0.012, 0.347, -0.010],
        ],
    },
];

const GRAIN = Array.from({ length: 54 }, (_, index) => {
    const fraction = value => value - Math.floor(value);
    return {
        x: fraction(Math.sin((index + 1) * 137.1) * 43758.5453) * 2 - 1,
        y: fraction(Math.sin((index + 1) * 281.7) * 19342.3491) * 2 - 1,
        tilt: fraction(Math.sin((index + 1) * 87.7) * 14751.231) - 0.5,
    };
});

export function createCarpalLayout({ wrist, thumbCmc, indexMcp, middleMcp, ringMcp, pinkyMcp, scale = 1 } = {}) {
    const landmarks = [wrist, thumbCmc, indexMcp, middleMcp, ringMcp, pinkyMcp];
    const empty = { center: { x: 0, y: 0 }, radius: 0, bones: [] };
    if (!landmarks.every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))
        || !Number.isFinite(scale) || scale <= 0) return empty;
    const palmLength = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y);
    const span = Math.hypot(pinkyMcp.x - indexMcp.x, pinkyMcp.y - indexMcp.y);
    if (!Number.isFinite(palmLength) || !Number.isFinite(span) || palmLength < 1 || span < 1) return empty;
    const distal = { x: (middleMcp.x - wrist.x) / palmLength, y: (middleMcp.y - wrist.y) / palmLength };
    // Orthogonalizing prevents the carpus from shearing when the pinky MCP is
    // lower than the index MCP. Its sign follows the tracked hand, including
    // reflections; using a fixed rotation alone would reverse the wrist rows.
    let ulnar = { x: -distal.y, y: distal.x };
    const side = (pinkyMcp.x - indexMcp.x) * ulnar.x + (pinkyMcp.y - indexMcp.y) * ulnar.y;
    const thumbSide = (pinkyMcp.x - thumbCmc.x) * ulnar.x + (pinkyMcp.y - thumbCmc.y) * ulnar.y;
    if ((Math.abs(side) > 0.001 ? side : thumbSide) < 0) ulnar = { x: -ulnar.x, y: -ulnar.y };
    const proximal = { x: -distal.x, y: -distal.y };
    const width = Math.min(span * 0.86, palmLength * 0.96);
    const palmCenter = {
        x: (indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 4,
        y: (indexMcp.y + middleMcp.y + ringMcp.y + pinkyMcp.y) / 4,
    };
    const lateralShift = ((palmCenter.x - wrist.x) * ulnar.x + (palmCenter.y - wrist.y) * ulnar.y) * 0.14;
    const center = {
        x: wrist.x + distal.x * width * 0.34 + ulnar.x * lateralShift,
        y: wrist.y + distal.y * width * 0.34 + ulnar.y * lateralShift,
    };
    const project = ([x, y]) => ({
        x: center.x + width * (x * ulnar.x + y * proximal.x),
        y: center.y + width * (x * ulnar.y + y * proximal.y),
    });
    const angle = Math.atan2(ulnar.y, ulnar.x);
    const bones = CARPALS.map(bone => ({
        id: bone.id, name: bone.name, letter: bone.letter, row: bone.row,
        location: bone.location, center: project(bone.center), labelPoint: project(bone.center),
        rx: bone.rx * width, ry: bone.ry * width, angle,
        frame: { ulnar, proximal },
        // Bone-local coordinates also hold grain still during live translation.
        outline: bone.path.map(([command, ...values]) => [command, ...values.map((value, index) =>
            (value - bone.center[index % 2]) * width)]),
    }));
    return { center, radius: width * 0.61, width, height: width * 0.69, bones };
}

export function drawCarpalAnatomyNode(ctx, carpal) {
    if (!carpal?.outline?.length || ![carpal.center?.x, carpal.center?.y, carpal.rx, carpal.ry,
        carpal.frame?.ulnar?.x, carpal.frame?.ulnar?.y,
        carpal.frame?.proximal?.x, carpal.frame?.proximal?.y].every(Number.isFinite)
        || carpal.rx <= 0 || carpal.ry <= 0) return;
    const outline = () => {
        ctx.beginPath();
        for (const [command, ...values] of carpal.outline) {
            if (command === 'M') ctx.moveTo(...values);
            else ctx.bezierCurveTo(...values);
        }
        ctx.closePath();
    };
    ctx.save();
    try {
        ctx.transform(carpal.frame.ulnar.x, carpal.frame.ulnar.y,
            carpal.frame.proximal.x, carpal.frame.proximal.y, carpal.center.x, carpal.center.y);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        const density = ctx.createLinearGradient(-carpal.rx, 0, carpal.rx, 0);
        density.addColorStop(0, 'rgba(215, 220, 214, .92)');
        density.addColorStop(0.22, 'rgba(185, 194, 184, .89)');
        density.addColorStop(0.55, 'rgba(153, 166, 154, .86)');
        density.addColorStop(0.81, 'rgba(193, 203, 193, .90)');
        density.addColorStop(1, 'rgba(221, 226, 218, .94)');
        outline();
        ctx.fillStyle = density;
        ctx.fill();
        // Thin dark joint spaces separate the fitted outlines; the broader pale
        // cortex stays inside each bone, preserving the connected wrist outline.
        ctx.lineWidth = Math.max(0.8, Math.min(carpal.rx, carpal.ry) * 0.09);
        ctx.strokeStyle = 'rgba(23, 29, 26, .68)';
        ctx.stroke();
        ctx.save();
        try {
            ctx.clip();
            outline();
            ctx.strokeStyle = 'rgba(244, 246, 235, .50)';
            ctx.lineWidth = Math.max(1.3, Math.min(carpal.rx, carpal.ry) * 0.17);
            ctx.stroke();
            for (let pass = 0; pass < 2; pass++) {
                ctx.beginPath();
                for (let index = pass; index < GRAIN.length; index += 2) {
                    const grain = GRAIN[index];
                    const x = grain.x * carpal.rx, y = grain.y * carpal.ry;
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + grain.tilt * carpal.rx * 0.29, y + carpal.ry * 0.12);
                }
                ctx.strokeStyle = pass ? 'rgba(244, 248, 237, .26)' : 'rgba(67, 79, 68, .17)';
                ctx.lineWidth = Math.max(0.3, carpal.rx * 0.021);
                ctx.stroke();
            }
        } finally {
            ctx.restore();
        }
        outline();
        ctx.strokeStyle = 'rgba(237, 241, 230, .78)';
        ctx.lineWidth = Math.max(0.5, Math.min(carpal.rx, carpal.ry) * 0.055);
        ctx.stroke();
    } finally {
        ctx.restore();
    }
}

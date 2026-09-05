export const TERMINOLOGY_MODES = {
    BASIC: 'basic',
    ADVANCED: 'advanced',
};

export const CAMERA_CONFIG = {
    // The camera element is currently not horizontally mirrored in CSS.
    // Set this to true if the video is later displayed with scaleX(-1), so
    // radial/thumb-side and ulnar/pinky-side carpal anchors stay anatomically correct.
    isMirroredCamera: false,
};

export const SIDE_TERMS = {
    radial: {
        basic: 'thumb side',
        advanced: 'radial side (thumb side)',
    },
    ulnar: {
        basic: 'pinky side',
        advanced: 'ulnar side (pinky side)',
    },
    proximal: {
        basic: 'closer to wrist',
        advanced: 'proximal (closer to wrist/body)',
    },
    distal: {
        basic: 'toward fingertip',
        advanced: 'distal (farther from wrist/body)',
    },
    palmar: {
        basic: 'palm side',
        advanced: 'palmar/volar (palm side)',
    },
    dorsal: {
        basic: 'back of hand side',
        advanced: 'dorsal (back of hand side)',
    },
};

// Educational hand-bone dataset.
// Landmark mapping notes:
// - Thumb uses MediaPipe 1->2->3->4: CMC, MCP, IP, tip.
// - Index/middle/ring/pinky use MCP->PIP->DIP->tip landmark chains.
// - Metacarpals are estimated from an approximate carpal center toward each MCP.
// - Carpals are not detected by webcam. They are approximated from wrist, thumb side,
//   index/middle/pinky MCP landmarks, and mirrored by radial/ulnar side when needed.
// This is an educational overlay from visible landmarks, not a medical scanner.
export const HAND_BONE_DATA = {
    carpals: [
        {
            id: 'carpal-scaphoid',
            name: 'Scaphoid',
            row: 'proximal',
            side: 'radial',
            layout: { side: 1.35, along: 0.85 },
            location: 'Proximal carpal row, thumb/radial side of wrist.',
            function: 'Helps bridge wrist motion between the forearm and hand.',
            joints: 'Radius, lunate, trapezium, trapezoid, and capitate.',
            memory: 'Scaphoid sits near the thumb side.',
        },
        {
            id: 'carpal-lunate',
            name: 'Lunate',
            row: 'proximal',
            side: 'central',
            layout: { side: 0.25, along: 1.05 },
            location: 'Proximal carpal row, near the center of the wrist.',
            function: 'Supports central wrist flexion and extension.',
            joints: 'Radius, scaphoid, triquetrum, capitate, and hamate.',
            memory: 'Lunate is moon-shaped and central.',
        },
        {
            id: 'carpal-triquetrum',
            name: 'Triquetrum',
            row: 'proximal',
            side: 'ulnar',
            layout: { side: -0.85, along: 1.05 },
            location: 'Proximal carpal row, pinky/ulnar side.',
            function: 'Supports ulnar-side wrist motion.',
            joints: 'Lunate, pisiform, and hamate.',
            memory: 'Triquetrum is the three-cornered ulnar carpal.',
        },
        {
            id: 'carpal-pisiform',
            name: 'Pisiform',
            row: 'proximal',
            side: 'ulnar',
            layout: { side: -1.65, along: 0.82 },
            location: 'Small pea-shaped bone on the palmar/ulnar side near triquetrum.',
            function: 'Acts like a pulley point for wrist flexor forces.',
            joints: 'Triquetrum.',
            memory: 'Pisiform is pea-sized on the pinky side.',
        },
        {
            id: 'carpal-trapezium',
            name: 'Trapezium',
            row: 'distal',
            side: 'radial',
            layout: { side: 1.65, along: -0.22 },
            location: 'Distal carpal row under the thumb/1st metacarpal.',
            function: 'Supports thumb opposition and pinch.',
            joints: '1st metacarpal, scaphoid, and trapezoid.',
            memory: 'Trapezium is under the thumb.',
        },
        {
            id: 'carpal-trapezoid',
            name: 'Trapezoid',
            row: 'distal',
            side: 'radial',
            layout: { side: 0.58, along: -0.35 },
            location: 'Distal carpal row under the index/2nd metacarpal.',
            function: 'Stabilizes the base of the index metacarpal.',
            joints: '2nd metacarpal, scaphoid, trapezium, and capitate.',
            memory: 'Trapezoid sits beside trapezium under the index.',
        },
        {
            id: 'carpal-capitate',
            name: 'Capitate',
            row: 'distal',
            side: 'central',
            layout: { side: -0.35, along: -0.35 },
            location: 'Central distal carpal row under the middle/3rd metacarpal.',
            function: 'Central keystone for wrist and palm force transfer.',
            joints: '3rd metacarpal, scaphoid, lunate, trapezoid, and hamate.',
            memory: 'Capitate is the central captain of the wrist.',
        },
        {
            id: 'carpal-hamate',
            name: 'Hamate',
            row: 'distal',
            side: 'ulnar',
            layout: { side: -1.35, along: -0.20 },
            location: 'Distal carpal row under ring/pinky side.',
            function: 'Supports the 4th and 5th metacarpals.',
            joints: '4th and 5th metacarpals, capitate, lunate, and triquetrum.',
            memory: 'Hamate has the hook on the hand’s ulnar side.',
        },
    ],
    metacarpals: [
        ['thumb', '1st Metacarpal', 'Thumb metacarpal', 'Base of thumb to thumb MCP joint.'],
        ['index', '2nd Metacarpal', 'Index metacarpal', 'Palm bone leading to the index finger.'],
        ['middle', '3rd Metacarpal', 'Middle metacarpal', 'Central palm bone leading to the middle finger.'],
        ['ring', '4th Metacarpal', 'Ring metacarpal', 'Palm bone leading to the ring finger.'],
        ['pinky', '5th Metacarpal', 'Pinky metacarpal', 'Ulnar-side palm bone leading to the pinky.'],
    ],
    thumbPhalanges: [
        ['proximal', 'Thumb Proximal Phalanx', 'Thumb segment closest to the palm.'],
        ['distal', 'Thumb Distal Phalanx', 'Thumb tip segment.'],
    ],
    fingerPhalanges: ['index', 'middle', 'ring', 'pinky'].flatMap(finger => [
        [finger, 'proximal', `${capitalize(finger)} Proximal Phalanx`, `${capitalize(finger)} finger segment closest to the palm.`],
        [finger, 'middle', `${capitalize(finger)} Middle Phalanx`, `${capitalize(finger)} finger middle segment.`],
        [finger, 'distal', `${capitalize(finger)} Distal Phalanx`, `${capitalize(finger)} fingertip segment.`],
    ]),
};

export function getSideLabel(side, terminologyMode = TERMINOLOGY_MODES.BASIC) {
    return SIDE_TERMS[side]?.[terminologyMode] || side;
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

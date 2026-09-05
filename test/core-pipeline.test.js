import assert from 'node:assert/strict';
import test from 'node:test';
import { drawFaceMuscles, drawHandMuscles, drawStylizedHandBones } from '../src/services/anatomyRenderer.js';
import { ANATOMY_MODES, createHandSkeletonModel, findNearestBone, getLabelsForMode, getWristBones } from '../src/services/handModel.js';
import { LandmarkSmoother } from '../src/services/landmarkSmoothing.js';
import { validateHandForRendering } from '../src/services/handValidation.js';
import { validateFaceForRendering } from '../src/services/faceValidation.js';
import { FACE_MUSCLE_DEFINITIONS, createFaceMuscleModel } from '../src/services/faceMuscleModel.js';

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const VISIBLE_BOUNDS = { left: 18, top: 18, right: 1262, bottom: 702 };

function openHandLandmarks() {
    return [
        { x: 0.50, y: 0.88 },
        { x: 0.39, y: 0.78 }, { x: 0.30, y: 0.70 }, { x: 0.24, y: 0.60 }, { x: 0.20, y: 0.49 },
        { x: 0.41, y: 0.64 }, { x: 0.39, y: 0.44 }, { x: 0.38, y: 0.27 }, { x: 0.38, y: 0.11 },
        { x: 0.50, y: 0.62 }, { x: 0.50, y: 0.38 }, { x: 0.50, y: 0.19 }, { x: 0.50, y: 0.07 },
        { x: 0.59, y: 0.64 }, { x: 0.61, y: 0.43 }, { x: 0.62, y: 0.27 }, { x: 0.63, y: 0.12 },
        { x: 0.68, y: 0.67 }, { x: 0.72, y: 0.49 }, { x: 0.74, y: 0.36 }, { x: 0.75, y: 0.23 },
    ].map(point => ({ ...point, z: 0 }));
}

function frontFaceLandmarks() {
    const landmarks = Array.from({ length: 478 }, (_, index) => {
        const angle = (index / 478) * Math.PI * 2;
        return {
            x: 0.50 + Math.cos(angle) * 0.16,
            y: 0.46 + Math.sin(angle) * 0.25,
            z: 0,
        };
    });
    const set = (index, x, y) => { landmarks[index] = { x, y, z: 0 }; };
    set(10, 0.50, 0.19);
    set(152, 0.50, 0.73);
    set(33, 0.41, 0.39);
    set(263, 0.59, 0.39);
    set(1, 0.50, 0.49);
    set(6, 0.50, 0.41);
    set(61, 0.44, 0.58);
    set(291, 0.56, 0.58);
    set(13, 0.50, 0.565);
    set(14, 0.50, 0.60);
    set(234, 0.34, 0.47);
    set(454, 0.66, 0.47);
    set(127, 0.35, 0.34);
    set(356, 0.65, 0.34);
    set(172, 0.38, 0.63);
    set(397, 0.62, 0.63);
    return landmarks;
}

function createMockContext() {
    const gradient = { addColorStop() {} };
    const drawnLabels = [];
    const context = {
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        createLinearGradient: () => gradient,
        createRadialGradient: () => gradient,
        measureText: (text) => ({ width: String(text).length * 7 }),
        fillText: (text) => drawnLabels.push(String(text)),
        getLineDash: () => [],
        setLineDash() {},
        __drawnLabels: drawnLabels,
    };

    return new Proxy(context, {
        get(target, key) {
            if (key in target) return target[key];
            return () => {};
        },
        set(target, key, value) {
            target[key] = value;
            return true;
        },
    });
}

test('accepts a complete, in-frame hand and reports uncertainty separately', () => {
    const landmarks = openHandLandmarks();
    const stable = validateHandForRendering(landmarks, 0.94, CANVAS_WIDTH, CANVAS_HEIGHT, VISIBLE_BOUNDS);
    const uncertain = validateHandForRendering(landmarks, 0.60, CANVAS_WIDTH, CANVAS_HEIGHT, VISIBLE_BOUNDS);

    assert.equal(stable.valid, true);
    assert.equal(stable.uncertain, false);
    assert.equal(uncertain.valid, true);
    assert.equal(uncertain.uncertain, true);
});

test('rejects invalid, low-confidence, and clipped hand landmark sets', () => {
    const landmarks = openHandLandmarks();
    const invalid = openHandLandmarks();
    invalid[7].x = Number.NaN;
    const clipped = openHandLandmarks();
    clipped[8].x = 1.02;
    const nearEdge = openHandLandmarks();
    nearEdge[12].y = 0.035;

    assert.equal(validateHandForRendering([], 0.9, CANVAS_WIDTH, CANVAS_HEIGHT, VISIBLE_BOUNDS).reason, 'No 21 landmarks detected');
    assert.equal(validateHandForRendering(invalid, 0.9, CANVAS_WIDTH, CANVAS_HEIGHT, VISIBLE_BOUNDS).reason, 'Landmarks invalid');
    assert.equal(validateHandForRendering(landmarks, 0.45, CANVAS_WIDTH, CANVAS_HEIGHT, VISIBLE_BOUNDS).reason, 'Confidence below threshold');
    assert.equal(validateHandForRendering(clipped, 0.9, CANVAS_WIDTH, CANVAS_HEIGHT, VISIBLE_BOUNDS).reason, 'Hand partly outside frame');
    assert.equal(validateHandForRendering(nearEdge, 0.9, CANVAS_WIDTH, CANVAS_HEIGHT, VISIBLE_BOUNDS).reason, 'Move hand fully into frame');
});

test('accepts a complete front-facing face and rejects clipped face landmarks', () => {
    const face = frontFaceLandmarks();
    const accepted = validateFaceForRendering(face, CANVAS_WIDTH, CANVAS_HEIGHT, VISIBLE_BOUNDS);
    const clipped = frontFaceLandmarks();
    clipped[10].y = 0.005;

    assert.equal(accepted.valid, true);
    assert.ok(accepted.confidence >= 0.72);
    assert.equal(validateFaceForRendering([], CANVAS_WIDTH, CANVAS_HEIGHT, VISIBLE_BOUNDS).reason, 'No complete face landmarks detected');
    assert.equal(validateFaceForRendering(clipped, CANVAS_WIDTH, CANVAS_HEIGHT, VISIBLE_BOUNDS).reason, 'Move face fully into frame');
});

test('smooths normal motion, reacts faster to large motion, and reseeds stale tracks', () => {
    const smoother = new LandmarkSmoother();
    const initial = openHandLandmarks();
    const shifted = initial.map(point => ({ ...point, x: point.x + 0.10 }));

    const first = smoother.smooth('left-0', initial, 0);
    const moved = smoother.smooth('left-0', shifted, 100);
    const reseeded = smoother.smooth('left-0', shifted, 700);

    assert.equal(first[0].x, initial[0].x);
    assert.ok(moved[0].x > initial[0].x && moved[0].x < shifted[0].x);
    assert.equal(reseeded[0].x, shifted[0].x);
});

test('builds a complete educational skeleton model with wrist and hit-test data', () => {
    const model = createHandSkeletonModel(openHandLandmarks(), CANVAS_WIDTH, CANVAS_HEIGHT, {
        handedness: 'Left',
        score: 0.94,
        isMirroredCamera: false,
    });

    assert.equal(model.bones.filter(bone => bone.group === 'carpals').length, 8);
    assert.equal(model.bones.filter(bone => bone.group === 'metacarpals').length, 5);
    assert.equal(getWristBones(model).length, 8);
    assert.equal(getLabelsForMode(model, ANATOMY_MODES.SIMPLE).length, 3);
    assert.ok(findNearestBone(model, model.bones[0].center));
});

test('renders skeleton modes without exceptions and exposes bone hit targets', () => {
    const landmarks = openHandLandmarks();
    for (const labelMode of ['off', 'clean', 'detailed']) {
        for (const wristMode of ['off', 'simple', 'detailed']) {
            const result = drawStylizedHandBones(createMockContext(), landmarks, CANVAS_WIDTH, CANVAS_HEIGHT, {
                labelMode,
                wristMode,
                visibleBounds: VISIBLE_BOUNDS,
            });
            assert.ok(result.bones.length >= 25);
        }
    }
});

test('anchors metacarpals to distinct carpal exits instead of a single wrist fan', () => {
    const result = drawStylizedHandBones(createMockContext(), openHandLandmarks(), CANVAS_WIDTH, CANVAS_HEIGHT, {
        labelMode: 'off',
        wristMode: 'off',
        visibleBounds: VISIBLE_BOUNDS,
    });
    const bonesById = new Map(result.bones.map((bone) => [bone.id, bone]));
    const pairs = [
        ['thumb-metacarpal', 'carpal-trapezium'],
        ['index-metacarpal', 'carpal-trapezoid'],
        ['middle-metacarpal', 'carpal-capitate'],
        ['ring-metacarpal', 'carpal-hamate'],
        ['pinky-metacarpal', 'carpal-hamate'],
    ];
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    pairs.forEach(([metacarpalId, carpalId]) => {
        const metacarpal = bonesById.get(metacarpalId);
        const carpal = bonesById.get(carpalId);
        assert.ok(metacarpal && carpal);
        assert.ok(
            distance(metacarpal.from, carpal.center) < distance(metacarpal.from, metacarpal.to),
            `${metacarpalId} should leave its matching carpal rather than the wrist`,
        );
    });

    assert.ok(distance(bonesById.get('index-metacarpal').from, bonesById.get('middle-metacarpal').from) > 8);
    assert.ok(distance(bonesById.get('ring-metacarpal').from, bonesById.get('pinky-metacarpal').from) > 8);
});

test('adds structured articular surfaces for the landmark-defined joints', () => {
    const result = drawStylizedHandBones(createMockContext(), openHandLandmarks(), CANVAS_WIDTH, CANVAS_HEIGHT, {
        labelMode: 'off',
        wristMode: 'off',
        visibleBounds: VISIBLE_BOUNDS,
    });

    assert.equal(result.articulations.length, 19);
    ['thumb-cmc', 'index-mcp', 'middle-pip', 'ring-dip', 'pinky-cmc'].forEach((id) => {
        const articulation = result.articulations.find((item) => item.id === id);
        assert.ok(articulation, `${id} should be represented`);
        assert.ok(articulation.across > articulation.along);
        assert.ok(Number.isFinite(articulation.center.x) && Number.isFinite(articulation.center.y));
    });
});

test('renders palm and back muscle modes without exceptions', () => {
    const landmarks = openHandLandmarks();
    for (const side of ['palm', 'back']) {
        for (const labelMode of ['off', 'clean', 'detailed']) {
            const result = drawHandMuscles(createMockContext(), landmarks, CANVAS_WIDTH, CANVAS_HEIGHT, {
                side,
                labelMode,
                confidence: 0.94,
                visibleBounds: VISIBLE_BOUNDS,
            });
            assert.deepEqual(result, { muscles: [] });
        }
    }
});

test('renders layered facial muscles and gates face labels by mode', () => {
    const face = frontFaceLandmarks();
    const labelsOff = createMockContext();
    const offResult = drawFaceMuscles(labelsOff, face, CANVAS_WIDTH, CANVAS_HEIGHT, {
        labelMode: 'off',
        confidence: 0.92,
        visibleBounds: VISIBLE_BOUNDS,
    });
    assert.deepEqual(offResult, { muscles: [] });
    assert.deepEqual(labelsOff.__drawnLabels, []);

    const clean = createMockContext();
    const cleanResult = drawFaceMuscles(clean, face, CANVAS_WIDTH, CANVAS_HEIGHT, {
        labelMode: 'clean',
        confidence: 0.92,
        visibleBounds: VISIBLE_BOUNDS,
    });
    assert.ok(cleanResult.muscles.some(muscle => muscle.id === 'orbicularis-oculi-left'));
    assert.ok(cleanResult.muscles.some(muscle => muscle.id === 'masseter-left'));
    assert.ok(!cleanResult.muscles.some(muscle => muscle.id === 'temporalis-left'));
    assert.ok(clean.__drawnLabels.includes('Forehead'));
    assert.ok(clean.__drawnLabels.includes('Eyes'));
    assert.ok(clean.__drawnLabels.length <= 6);

    const detailed = createMockContext();
    const detailedResult = drawFaceMuscles(detailed, face, CANVAS_WIDTH, CANVAS_HEIGHT, {
        labelMode: 'detailed',
        confidence: 0.92,
        visibleBounds: VISIBLE_BOUNDS,
    });
    assert.ok(detailedResult.muscles.length > cleanResult.muscles.length);
    assert.ok(detailedResult.muscles.some(muscle => muscle.id === 'temporalis-left'));
    assert.ok(detailedResult.muscles.some(muscle => muscle.id === 'nasalis'));
    assert.ok(detailedResult.muscles.some(muscle => muscle.id === 'levator-alaeque-left'));
    assert.ok(detailedResult.muscles.some(muscle => muscle.id === 'depressor-anguli-right'));
    assert.ok(detailed.__drawnLabels.includes('Frontalis'));
    assert.ok(detailed.__drawnLabels.includes('Orbicularis oculi'));
    assert.ok(!detailed.__drawnLabels.includes('Cheek muscles'));
    assert.ok(detailed.__drawnLabels.length <= 14);

    const uncertain = createMockContext();
    const uncertainResult = drawFaceMuscles(uncertain, face, CANVAS_WIDTH, CANVAS_HEIGHT, {
        labelMode: 'detailed',
        isUncertain: true,
        visibleBounds: VISIBLE_BOUNDS,
    });
    assert.ok(uncertain.__drawnLabels.includes('Frontalis'));
    assert.ok(uncertainResult.muscles.some(muscle => muscle.id === 'temporalis-left'));
    const stableFrontalis = detailedResult.muscles.find(muscle => muscle.id === 'frontalis-left');
    const uncertainFrontalis = uncertainResult.muscles.find(muscle => muscle.id === 'frontalis-left');
    assert.ok(uncertainFrontalis.opacity < stableFrontalis.opacity);
});

test('defines every facial muscle through the structured educational model', () => {
    const requiredFields = [
        'id', 'displayName', 'side', 'landmarkAnchors', 'muscleType', 'controlPoints',
        'fiberDirection', 'baseOpacity', 'labelAnchor', 'labelPriority', 'visibility',
    ];
    FACE_MUSCLE_DEFINITIONS.forEach(definition => {
        requiredFields.forEach(field => assert.ok(field in definition, `${definition.id} is missing ${field}`));
        assert.ok(definition.landmarkAnchors.length > 0);
        assert.ok(['left', 'right', 'center'].includes(definition.side));
    });

    const names = new Set(FACE_MUSCLE_DEFINITIONS.map(definition => definition.displayName));
    [
        'Frontalis', 'Corrugator supercilii', 'Depressor supercilii', 'Procerus',
        'Temporalis', 'Orbicularis oculi', 'Nasalis',
        'Levator labii superioris alaeque nasi', 'Levator labii superioris',
        'Zygomaticus minor', 'Zygomaticus major', 'Risorius', 'Orbicularis oris',
        'Depressor anguli oris', 'Depressor labii inferioris', 'Mentalis', 'Masseter', 'Platysma',
    ].forEach(name => assert.ok(names.has(name), `missing ${name}`));
});

test('keeps facial geometry finite across expressions, tilt, and moderate yaw', () => {
    const variants = [];
    const smile = frontFaceLandmarks();
    smile[61] = { x: 0.42, y: 0.56, z: 0 };
    smile[291] = { x: 0.58, y: 0.56, z: 0 };
    variants.push(smile);

    const mouthOpen = frontFaceLandmarks();
    mouthOpen[13] = { x: 0.50, y: 0.55, z: 0 };
    mouthOpen[14] = { x: 0.50, y: 0.63, z: 0 };
    variants.push(mouthOpen);

    const eyesClosed = frontFaceLandmarks();
    [159, 145].forEach(index => { eyesClosed[index] = { x: 0.45, y: 0.40, z: 0 }; });
    [386, 374].forEach(index => { eyesClosed[index] = { x: 0.55, y: 0.40, z: 0 }; });
    variants.push(eyesClosed);

    const browsRaised = frontFaceLandmarks();
    [70, 63, 105, 66, 107, 336, 296, 334, 293, 300].forEach(index => {
        browsRaised[index] = { ...browsRaised[index], y: browsRaised[index].y - 0.035 };
    });
    variants.push(browsRaised);

    const angle = Math.PI / 9;
    const tilted = frontFaceLandmarks().map(point => {
        const x = point.x - 0.5;
        const y = point.y - 0.46;
        return {
            x: 0.5 + x * Math.cos(angle) - y * Math.sin(angle),
            y: 0.46 + x * Math.sin(angle) + y * Math.cos(angle),
            z: point.z,
        };
    });
    variants.push(tilted);

    variants.forEach(landmarks => {
        const model = createFaceMuscleModel(landmarks, CANVAS_WIDTH, CANVAS_HEIGHT, {
            mode: 'detailed', confidence: 0.92, visibleBounds: VISIBLE_BOUNDS,
        });
        assert.ok(model.muscles.length >= 30);
        model.muscles.forEach(muscle => {
            const geometryPoints = muscle.points || muscle.path || muscle.outerPoints;
            assert.ok(geometryPoints.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
        });
    });

    const yawed = frontFaceLandmarks();
    yawed[1] = { x: 0.57, y: 0.49, z: 0 };
    const yawModel = createFaceMuscleModel(yawed, CANVAS_WIDTH, CANVAS_HEIGHT, {
        mode: 'detailed', confidence: 0.92, visibleBounds: VISIBLE_BOUNDS,
    });
    const leftMasseter = yawModel.muscles.find(muscle => muscle.id === 'masseter-left');
    const rightMasseter = yawModel.muscles.find(muscle => muscle.id === 'masseter-right');
    assert.notEqual(leftMasseter.opacity, rightMasseter.opacity);
});

test('keeps bone and muscle labels correctly gated by their selected modes', () => {
    const landmarks = openHandLandmarks();

    const bonesOff = createMockContext();
    drawStylizedHandBones(bonesOff, landmarks, CANVAS_WIDTH, CANVAS_HEIGHT, {
        labelMode: 'off',
        wristMode: 'off',
        visibleBounds: VISIBLE_BOUNDS,
    });
    assert.deepEqual(bonesOff.__drawnLabels, []);

    const bonesClean = createMockContext();
    drawStylizedHandBones(bonesClean, landmarks, CANVAS_WIDTH, CANVAS_HEIGHT, {
        labelMode: 'clean',
        wristMode: 'simple',
        visibleBounds: VISIBLE_BOUNDS,
    });
    assert.deepEqual(bonesClean.__drawnLabels, [
        'Distal phalanx',
        'Middle phalanx',
        'Proximal phalanx',
        'Metacarpals',
        'Carpals',
    ]);

    const musclesOff = createMockContext();
    drawHandMuscles(musclesOff, landmarks, CANVAS_WIDTH, CANVAS_HEIGHT, {
        side: 'palm',
        labelMode: 'off',
        confidence: 0.94,
        visibleBounds: VISIBLE_BOUNDS,
    });
    assert.deepEqual(musclesOff.__drawnLabels, []);

    const musclesClean = createMockContext();
    drawHandMuscles(musclesClean, landmarks, CANVAS_WIDTH, CANVAS_HEIGHT, {
        side: 'palm',
        labelMode: 'clean',
        confidence: 0.94,
        visibleBounds: VISIBLE_BOUNDS,
    });
    assert.deepEqual(musclesClean.__drawnLabels, [
        'Flexor tendon paths',
        'Thenar muscles',
        'Hypothenar muscles',
        'Lumbricals',
        'Palmar interossei',
    ]);

    const musclesDetailed = createMockContext();
    drawHandMuscles(musclesDetailed, landmarks, CANVAS_WIDTH, CANVAS_HEIGHT, {
        side: 'palm',
        labelMode: 'detailed',
        confidence: 0.94,
        visibleBounds: VISIBLE_BOUNDS,
    });
    assert.ok(musclesDetailed.__drawnLabels.includes('Flexor tendon paths'));
    assert.ok(musclesDetailed.__drawnLabels.includes('Thenar muscles'));
    assert.ok(musclesDetailed.__drawnLabels.includes('Palmar interossei'));
    assert.ok(musclesDetailed.__drawnLabels.length <= 6, 'detailed mode must shed lower-priority labels when crowded');
});

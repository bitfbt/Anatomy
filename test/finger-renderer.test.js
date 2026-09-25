import assert from 'node:assert/strict';
import test from 'node:test';
import { drawTrackedFingerAnatomy } from '../src/services/anatomyRenderer.js';

const WIDTH = 500;
const HEIGHT = 700;
const BOUNDS = { left: 18, top: 18, right: 482, bottom: 682 };
const indexFinger = () => ({
    name: 'Index',
    points: [{ x: .5, y: .8 }, { x: .49, y: .52 }, { x: .48, y: .32 }, { x: .47, y: .15 }],
    width: .14,
});

function context(alpha = .36) {
    const stack = [];
    const calls = [];
    const gradients = { addColorStop() {} };
    const target = {
        globalAlpha: alpha,
        globalCompositeOperation: 'source-over',
        calls,
        save() { stack.push({ ...target }); },
        restore() { Object.assign(target, stack.pop()); },
        createLinearGradient: () => gradients,
        createRadialGradient: () => gradients,
        measureText: text => ({ width: String(text).length * 6 }),
        getLineDash: () => [],
    };
    return new Proxy(target, {
        get(object, key) {
            if (key in object) return object[key];
            return (...args) => {
                for (const value of args) {
                    if (typeof value === 'number') assert.ok(Number.isFinite(value), `${key} received non-finite geometry`);
                }
                calls.push({ method: key, args, alpha: target.globalAlpha });
            };
        },
    });
}

test('close-up bones contain only the named finger phalanges and retain camera coordinates', () => {
    const ctx = context();
    const result = drawTrackedFingerAnatomy(ctx, indexFinger(), WIDTH, HEIGHT, {
        layer: 'skeleton', labelMode: 'detailed', visibleBounds: BOUNDS,
    });
    assert.deepEqual(result.bones.map(bone => bone.id), [
        'index-proximal-phalanx', 'index-middle-phalanx', 'index-distal-phalanx',
    ]);
    assert.deepEqual(result.bones[0].from, { x: 250, y: 560 });
    assert.ok(result.bones.every(bone => bone.finger === 'Index' && bone.estimated));
    assert.deepEqual(result.tendons, []);
    const text = ctx.calls.filter(call => call.method === 'fillText').map(call => call.args[0]);
    assert.equal(text.length, 3);
    assert.ok(text.every(label => /^Index: (proximal|middle|distal) phalanx$/.test(label)));
});

test('a thumb close-up has exactly two phalanges and never invents a middle phalanx', () => {
    const finger = { name: 'Thumb', points: indexFinger().points.slice(1), width: .15 };
    const result = drawTrackedFingerAnatomy(context(), finger, WIDTH, HEIGHT, { labelMode: 'detailed' });
    assert.deepEqual(result.bones.map(bone => bone.id), ['thumb-proximal-phalanx', 'thumb-distal-phalanx']);
    assert.equal(result.bones.some(bone => bone.segment.includes('middle')), false);
});

test('muscle mode shows digit tendons on the selected side without palm muscle bellies', () => {
    for (const side of ['palm', 'back']) {
        for (const name of ['Index', 'Thumb']) {
            const ctx = context();
            const finger = indexFinger();
            finger.name = name;
            if (name === 'Thumb') finger.points = finger.points.slice(1);
            const result = drawTrackedFingerAnatomy(ctx, finger, WIDTH, HEIGHT, {
                layer: 'muscles', side, labelMode: 'clean', visibleBounds: BOUNDS,
            });
            assert.deepEqual(result.bones, []);
            assert.equal(result.tendons.length, 1);
            assert.equal(result.tendons[0].name, `${name} ${side === 'back' ? 'extensor' : 'flexor'} tendon path`);
            assert.deepEqual(ctx.calls.filter(call => call.method === 'fillText').map(call => call.args[0]), [result.tendons[0].name]);
            assert.ok(ctx.calls.some(call => call.method === 'fill'), 'digit tendon ribbon should render');
        }
    }
});

test('cropped fingers draw crossing segments and clip their anatomy and labels to visible bounds', () => {
    const ctx = context();
    const finger = indexFinger();
    finger.points = [{ x: .5, y: 1.4 }, { x: .5, y: 1.1 }, { x: .5, y: .5 }, { x: .5, y: -.3 }];
    const result = drawTrackedFingerAnatomy(ctx, finger, WIDTH, HEIGHT, {
        labelMode: 'detailed', visibleBounds: BOUNDS,
    });
    assert.deepEqual(result.bones.map(bone => bone.segment), ['middle phalanx', 'distal phalanx']);
    const firstClip = ctx.calls.findIndex(call => call.method === 'clip');
    const firstFill = ctx.calls.findIndex(call => call.method === 'fill');
    assert.ok(firstClip >= 0 && firstClip < firstFill);
    assert.deepEqual(ctx.calls.find(call => call.method === 'rect').args, [18, 18, 464, 664]);
    for (const { args: [x, y, width, height] } of ctx.calls.filter(call => call.method === 'strokeRect')) {
        assert.ok(x >= BOUNDS.left && x + width <= BOUNDS.right);
        assert.ok(y >= BOUNDS.top && y + height <= BOUNDS.bottom);
    }
    for (const bone of result.bones) {
        assert.ok(bone.labelPoint.y >= BOUNDS.top && bone.labelPoint.y <= BOUNDS.bottom);
    }
});

test('close-up rendering enlarges bone widths with the finger and preserves the caller opacity', () => {
    const small = indexFinger();
    small.width /= 2;
    for (const layer of ['skeleton', 'muscles']) {
        const ctx = context(.23);
        const result = drawTrackedFingerAnatomy(ctx, indexFinger(), WIDTH, HEIGHT, { layer, labelMode: 'clean' });
        if (layer === 'skeleton') {
            const smallResult = drawTrackedFingerAnatomy(context(), small, WIDTH, HEIGHT);
            assert.ok(result.bones[0].radius > smallResult.bones[0].radius * 1.9);
        }
        assert.equal(ctx.globalAlpha, .23);
        assert.ok(ctx.calls.every(call => call.alpha <= .23 + 1e-12 && call.alpha >= 0));
    }
});

test('unsupported, malformed, offscreen, and degenerate finger chains draw nothing', () => {
    const finger = indexFinger();
    const invalid = [
        null,
        { ...finger, name: 'Palm' },
        { ...finger, points: finger.points.slice(1) },
        { ...finger, width: NaN },
        { ...finger, width: 0 },
        { ...finger, points: finger.points.map(point => ({ ...point, x: NaN })) },
        { ...finger, points: finger.points.map(point => ({ ...point, x: 3 })) },
        { ...finger, points: finger.points.map(() => ({ x: .5, y: .5 })) },
    ];
    for (const input of invalid) {
        const ctx = context();
        assert.deepEqual(drawTrackedFingerAnatomy(ctx, input, WIDTH, HEIGHT), { bones: [], tendons: [] });
        assert.deepEqual(ctx.calls, []);
    }
});

test('labels off and labels that cannot fit in a narrow crop do not draw text', () => {
    for (const options of [
        { labelMode: 'off' },
        { labelMode: 'detailed', visibleBounds: { left: 220, top: 20, right: 275, bottom: 680 } },
    ]) {
        const ctx = context();
        const result = drawTrackedFingerAnatomy(ctx, indexFinger(), WIDTH, HEIGHT, options);
        assert.ok(result.bones.length > 0);
        assert.equal(ctx.calls.some(call => call.method === 'fillText'), false);
    }
});

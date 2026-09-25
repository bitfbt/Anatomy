import assert from 'node:assert/strict';
import test from 'node:test';
import { createCarpalLayout, drawCarpalAnatomyNode } from '../src/services/carpalAnatomy.js';

const hand = {
    wrist: { x: 320, y: 600 }, thumbCmc: { x: 190, y: 478 },
    indexMcp: { x: 225, y: 322 }, middleMcp: { x: 320, y: 294 },
    ringMcp: { x: 391, y: 317 }, pinkyMcp: { x: 458, y: 363 }, scale: 1.7,
};

const remap = transform => Object.fromEntries(Object.entries(hand).map(([key, value]) =>
    [key, key === 'scale' ? value : transform(value)]));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} should equal ${b}`);

test('the reference key identifies all eight carpals with pisiform drawn over triquetrum', () => {
    const layout = createCarpalLayout(hand);
    assert.deepEqual(Object.fromEntries(layout.bones.map(bone => [bone.letter, bone.name])), {
        A: 'Scaphoid', B: 'Lunate', C: 'Triquetrum', E: 'Trapezium',
        F: 'Trapezoid', G: 'Capitate', H: 'Hamate', D: 'Pisiform',
    });
    assert.equal(layout.bones.at(-1).id, 'pisiform');
    assert.equal(new Set(layout.bones.map(bone => bone.id)).size, 8);
    const byId = Object.fromEntries(layout.bones.map(bone => [bone.id, bone]));
    assert.ok(byId.scaphoid.center.x < byId.lunate.center.x);
    assert.ok(byId.triquetrum.center.x > byId.lunate.center.x);
    assert.ok(byId.trapezium.center.x < byId.trapezoid.center.x);
    assert.ok(byId.hamate.center.x > byId.capitate.center.x);
    assert.ok(byId.capitate.center.y < byId.lunate.center.y);
    assert.ok(byId.scaphoid.ry > byId.scaphoid.rx);
    assert.ok(byId.capitate.rx * byId.capitate.ry > byId.scaphoid.rx * byId.scaphoid.ry);
    assert.ok(Math.hypot(byId.pisiform.center.x - byId.triquetrum.center.x,
        byId.pisiform.center.y - byId.triquetrum.center.y) < byId.triquetrum.rx + byId.pisiform.rx);
    assert.ok(layout.width > Math.hypot(hand.pinkyMcp.x - hand.indexMcp.x,
        hand.pinkyMcp.y - hand.indexMcp.y) * 0.8);
    assert.ok(layout.height > layout.width * 0.6 && layout.height < layout.width * 0.75);
});

test('rotation and reflection preserve the carpal key, fitted shapes, and anatomical sides', () => {
    const original = createCarpalLayout(hand);
    const angle = 1.28;
    for (const transform of [
        point => ({ x: 1000 - point.x, y: point.y }),
        point => ({
            x: point.x * Math.cos(angle) - point.y * Math.sin(angle) + 90,
            y: point.x * Math.sin(angle) + point.y * Math.cos(angle) - 110,
        }),
    ]) {
        const transformed = createCarpalLayout(remap(transform));
        close(transformed.radius, original.radius);
        transformed.bones.forEach((bone, index) => {
            const source = original.bones[index];
            const expected = transform(source.center);
            assert.equal(bone.letter, source.letter);
            close(bone.center.x, expected.x);
            close(bone.center.y, expected.y);
            close(bone.frame.ulnar.x * bone.frame.proximal.x + bone.frame.ulnar.y * bone.frame.proximal.y, 0);
            source.outline.forEach((command, commandIndex) => command.slice(1).forEach((value, numberIndex) =>
                close(value, bone.outline[commandIndex][numberIndex + 1])));
        });
    }
});

test('carpal geometry scales smoothly with hand distance instead of staying as wrist beads', () => {
    const original = createCarpalLayout(hand);
    const enlarged = createCarpalLayout({ ...remap(point => ({ x: point.x * 3, y: point.y * 3 })), scale: 5.1 });
    close(enlarged.width, original.width * 3);
    for (let index = 0; index < original.bones.length; index++) {
        const bone = enlarged.bones[index], source = original.bones[index];
        close(bone.center.x, source.center.x * 3);
        close(bone.center.y, source.center.y * 3);
        close(bone.rx, source.rx * 3);
        close(bone.ry, source.ry * 3);
    }
});

function context(alpha = 0.23) {
    const stack = [], paints = [], calls = [];
    const state = { globalAlpha: alpha, fillStyle: '#fff', strokeStyle: '#eee', lineWidth: 7,
        shadowBlur: 4, shadowOffsetX: 2, shadowOffsetY: 3 };
    const ctx = new Proxy(state, {
        get(target, key) {
            if (key in target) return target[key];
            if (key === 'save') return () => stack.push({ ...state });
            if (key === 'restore') return () => Object.assign(state, stack.pop());
            if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
            return (...args) => {
                args.filter(value => typeof value === 'number').forEach(value => assert.ok(Number.isFinite(value)));
                calls.push([key, ...args]);
                if (key === 'fill' || key === 'stroke') paints.push(state.globalAlpha);
            };
        },
    });
    return { ctx, stack, paints, calls, state };
}

test('carpal rendering preserves the outer tracking fade and canvas state without adding labels', () => {
    const drawing = context();
    const initial = { ...drawing.state };
    for (const carpal of createCarpalLayout(hand).bones) drawCarpalAnatomyNode(drawing.ctx, carpal);
    assert.ok(drawing.paints.length > 0);
    assert.ok(drawing.paints.every(alpha => alpha <= initial.globalAlpha));
    assert.deepEqual(drawing.state, initial);
    assert.equal(drawing.stack.length, 0);
    assert.ok(!drawing.calls.some(([name]) => name === 'fillText' || name === 'strokeText'));
    assert.ok(drawing.calls.length < 2000, 'live carpal drawing must use a bounded number of vector commands');
});

test('invalid or collapsed hand geometry produces no invented carpals', () => {
    for (const input of [undefined, {}, { ...hand, scale: Infinity }, { ...hand, wrist: { x: NaN, y: 2 } },
        { ...hand, middleMcp: hand.wrist }, { ...hand, pinkyMcp: hand.indexMcp }]) {
        assert.equal(createCarpalLayout(input).bones.length, 0);
    }
    const drawing = context();
    drawCarpalAnatomyNode(drawing.ctx, null);
    drawCarpalAnatomyNode(drawing.ctx, { center: { x: Infinity, y: 30 } });
    assert.deepEqual(drawing.calls, []);
});

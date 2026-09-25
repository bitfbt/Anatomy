import assert from 'node:assert/strict';
import test from 'node:test';
import { drawRadiographicBone } from '../src/services/radiographicBone.js';

function drawingContext(alpha = 0.3) {
    const stack = [];
    const calls = [];
    const paints = [];
    const state = {
        globalAlpha: alpha, strokeStyle: '#123456', fillStyle: '#654321',
        lineWidth: 9, shadowBlur: 6, shadowOffsetX: 2, shadowOffsetY: 3,
    };
    const ctx = new Proxy(state, {
        get(target, key) {
            if (key in target) return target[key];
            if (key === 'save') return () => stack.push({ ...state });
            if (key === 'restore') return () => Object.assign(state, stack.pop());
            if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
            return (...args) => {
                args.filter(value => typeof value === 'number').forEach(value => {
                    assert.ok(Number.isFinite(value), `${key} received invalid geometry`);
                });
                calls.push([key, ...args]);
                if (key === 'fill' || key === 'stroke') paints.push(state.globalAlpha);
            };
        },
    });
    return { ctx, state, calls, paints, stack };
}

test('radiographic rendering respects an outer tracking fade and restores canvas styling', () => {
    const drawing = drawingContext(0.23);
    const before = { ...drawing.state };
    drawRadiographicBone(drawing.ctx, { x: 50, y: 150 }, { x: 55, y: 30 }, {
        startWidth: 16, endWidth: 12, alpha: 0.8, boneType: 'proximal',
    });
    assert.ok(drawing.paints.length > 0);
    assert.ok(drawing.paints.every(alpha => alpha > 0 && alpha <= 0.23 * 0.8 + 1e-12));
    assert.deepEqual(drawing.state, before);
    assert.equal(drawing.stack.length, 0);
});

test('bone grain stays attached to anatomy during camera translation', () => {
    const first = drawingContext();
    const translated = drawingContext();
    drawRadiographicBone(first.ctx, { x: 15, y: 30 }, { x: 80, y: 165 }, { boneType: 'metacarpal' });
    drawRadiographicBone(translated.ctx, { x: 415, y: 280 }, { x: 480, y: 415 }, { boneType: 'metacarpal' });
    const localCommands = drawing => drawing.calls.filter(([name]) => name !== 'translate');
    assert.deepEqual(localCommands(translated), localCommands(first));
});

test('mirrored and cropped rays remain finite; malformed rays render nothing', () => {
    for (const type of ['metacarpal', 'thumb-metacarpal', 'proximal', 'middle', 'distal', 'thumb-distal']) {
        for (const sign of [-1, 1]) {
            const drawing = drawingContext();
            drawRadiographicBone(drawing.ctx, { x: -20 * sign, y: 500 }, { x: -180 * sign, y: -400 }, {
                startWidth: 30, endWidth: 20, boneType: type,
            });
            assert.ok(drawing.paints.length > 0);
            assert.ok(drawing.calls.length < 500, 'vector work must remain bounded for live rendering');
            assert.equal(drawing.stack.length, 0);
        }
    }
    for (const [a, b, options] of [
        [{ x: NaN, y: 0 }, { x: 0, y: 30 }, {}],
        [{ x: 0, y: 0 }, { x: Infinity, y: 30 }, {}],
        [{ x: 0, y: 0 }, { x: 0, y: 0 }, {}],
        [{ x: 0, y: 0 }, { x: 0, y: 30 }, { startWidth: 0 }],
        [{ x: 0, y: 0 }, { x: 0, y: 30 }, { alpha: 0 }],
    ]) {
        const drawing = drawingContext();
        drawRadiographicBone(drawing.ctx, a, b, options);
        assert.deepEqual(drawing.calls, []);
    }
});

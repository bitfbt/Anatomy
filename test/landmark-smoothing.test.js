import test from 'node:test';
import assert from 'node:assert/strict';
import { LandmarkSmoother } from '../src/services/landmarkSmoothing.js';

const frameMs = 1000 / 60;
const hand = () => Array.from({ length: 21 }, (_, index) => ({
    x: 0.35 + (index % 5) * 0.04,
    y: 0.25 + Math.floor(index / 5) * 0.05,
    z: 0,
    visibility: 0.9,
}));
const translate = (points, dx) => points.map(point => ({ ...point, x: point.x + dx }));

test('stationary hand noise is reduced without moving the mean hand position', () => {
    const smoother = new LandmarkSmoother();
    const still = hand();
    smoother.smooth('hand', still, 0);
    let seed = 42;
    const noise = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return (seed / 2 ** 32 - 0.5) * 0.003;
    };
    let rawSquared = 0, smoothSquared = 0, meanError = 0, count = 0;
    for (let frame = 1; frame <= 600; frame += 1) {
        const input = still.map(point => ({ ...point, x: point.x + noise(), y: point.y + noise() }));
        const result = smoother.smooth('hand', input, frame * frameMs);
        if (frame < 60) continue;
        result.forEach((point, index) => {
            rawSquared += (input[index].x - still[index].x) ** 2 + (input[index].y - still[index].y) ** 2;
            smoothSquared += (point.x - still[index].x) ** 2 + (point.y - still[index].y) ** 2;
            meanError += point.x - still[index].x;
            count += 1;
        });
    }
    const rmsRatio = Math.sqrt(smoothSquared / rawSquared);
    assert.ok(rmsRatio < 0.45, `Filtered/raw RMS noise: ${rmsRatio}`);
    assert.ok(Math.abs(meanError / count) < 0.00005);
});

test('deliberate hand movement follows at least 94 percent of a step in the next frame', () => {
    const smoother = new LandmarkSmoother();
    const initial = hand();
    smoother.smooth('hand', initial, 0);
    const input = translate(initial, 0.05);
    const result = smoother.smooth('hand', input, frameMs);
    for (let index = 0; index < result.length; index += 1) {
        assert.ok(Math.abs(input[index].x - result[index].x) <= 0.003);
        assert.equal(result[index].y, initial[index].y);
    }
});

test('an independently moving fingertip reacts immediately while the other joints stay still', () => {
    const smoother = new LandmarkSmoother();
    const initial = hand();
    smoother.smooth('hand', initial, 0);
    const input = hand();
    input[8].x += 0.08;
    const result = smoother.smooth('hand', input, frameMs);
    assert.ok(input[8].x - result[8].x <= 0.0041);
    result.forEach((point, index) => {
        if (index !== 8) assert.deepEqual(point, initial[index]);
    });
    assert.equal(result[8].visibility, 0.9);
    assert.equal(initial[8].x, hand()[8].x);
});

test('small-motion settling uses the same elapsed-time response at 15, 30 and 60 fps', () => {
    const endings = [15, 30, 60].map(fps => {
        const smoother = new LandmarkSmoother();
        const initial = hand();
        const input = translate(initial, 0.001);
        smoother.smooth('hand', initial, 0);
        let result;
        for (let frame = 1; frame <= fps / 5; frame += 1) {
            result = smoother.smooth('hand', input, frame * 1000 / fps);
        }
        return result[0].x;
    });
    assert.ok(Math.max(...endings) - Math.min(...endings) < 1e-12);
});

test('steady camera motion has bounded and comparable tracking lag across frame rates', () => {
    const errors = [15, 30, 60].map(fps => {
        const smoother = new LandmarkSmoother();
        const initial = hand();
        smoother.smooth('hand', initial, 0);
        let result, input;
        for (let frame = 1; frame <= fps; frame += 1) {
            input = translate(initial, 0.09 * frame / fps);
            result = smoother.smooth('hand', input, frame * 1000 / fps);
        }
        return input[0].x - result[0].x;
    });
    errors.forEach(error => assert.ok(error >= 0 && error < 0.006, `Normalized tracking lag: ${error}`));
    assert.ok(Math.max(...errors) - Math.min(...errors) < 0.002);
});

test('topology changes and stale, repeated or backwards times seed current geometry', () => {
    const smoother = new LandmarkSmoother();
    const initial = hand();
    smoother.smooth('hand', initial, 100);
    for (const [input, time] of [
        [translate(initial, 0.01), 100],
        [translate(initial, 0.02), 50],
        [translate(initial, 0.03).slice(0, 1), 70],
        [translate(initial, 0.04), 90],
        [translate(initial, 0.05), 1000],
    ]) {
        assert.deepEqual(smoother.smooth('hand', input, time), input);
    }
});

test('invalid timestamps clear history, and reset/prune still discard only the intended tracks', () => {
    const smoother = new LandmarkSmoother();
    const initial = hand();
    for (const timestamp of [NaN, Infinity, -Infinity]) {
        smoother.smooth('hand', initial, 0);
        const input = translate(initial, 0.001);
        assert.deepEqual(smoother.smooth('hand', input, timestamp), input);
        assert.deepEqual(smoother.smooth('hand', initial, 10), initial);
    }
    smoother.smooth('other', initial, 0);
    smoother.prune(['hand']);
    assert.deepEqual(smoother.smooth('other', translate(initial, 0.001), 10), translate(initial, 0.001));
    smoother.reset();
    assert.deepEqual(smoother.smooth('hand', initial, 20), initial);
});

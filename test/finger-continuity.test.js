import assert from 'node:assert/strict';
import test from 'node:test';
import { FingerContinuityTracker, FINGER_CONTINUITY_CONFIG } from '../src/services/fingerContinuity.js';

const WIDTH = 160, HEIGHT = 160;
function landmarks() {
    const points = [{ x: .5, y: .90 }];
    for (const x of [.18, .43, .62, .76, .89]) {
        for (const y of [.78, .53, .33, .12]) points.push({ x, y });
    }
    return points;
}
const measurement = { trackId: 'hand-1', handedness: 'Left', landmarks: landmarks() };

function image(dx = 0, scale = 1) {
    const data = new Uint8Array(WIDTH * HEIGHT).fill(80);
    // An isolated textured index finger. Everything else is deliberately flat.
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const sx = Math.round((x - 69 - dx) / scale + 69);
            const sy = Math.round((y - 80) / scale + 80);
            if (sx < 61 || sx > 77 || sy < 10 || sy > 132) continue;
            const hash = Math.imul(sx * 1973 + sy * 9277, 26699) >>> 0;
            data[y * WIDTH + x] = 60 + ((hash ^ (hash >>> 9)) % 140);
        }
    }
    return { width: WIDTH, height: HEIGHT, data };
}

function seed(tracker) {
    for (let i = 0; i < 5; i++) tracker.update([measurement], image(), 1000 + i * 40);
}

test('a recognized index finger stays aligned from real image motion beyond the old one-second grace', () => {
    const tracker = new FingerContinuityTracker();
    seed(tracker);
    let result;
    for (let frame = 1; frame <= 32; frame++) {
        result = tracker.update([], image(frame), 1160 + frame * 40);
        assert.equal(result.length, 1);
        assert.equal(result[0].name, 'Index');
        assert.ok(Math.abs(result[0].points[1].x - (.43 + frame / WIDTH)) < .02);
    }
    assert.ok(result[0].ageMs > 1000);
    assert.ok(result[0].alpha > .7);
});

test('camera pixels alone cannot invent a finger identity without measured hand history', () => {
    const tracker = new FingerContinuityTracker();
    assert.deepEqual(tracker.update([], image(), 900), []);
    tracker.update([measurement], image(), 1000);
    assert.deepEqual(tracker.update([], image(1), 1040), []);
});

test('a brief loss of texture predicts the finger and recovers from the last clear image', () => {
    const tracker = new FingerContinuityTracker();
    seed(tracker);
    assert.equal(tracker.update([], image(2), 1200).length, 1);
    const flat = { width: WIDTH, height: HEIGHT, data: new Uint8Array(WIDTH * HEIGHT).fill(80) };
    const [predicted]=tracker.update([], flat, 1240);
    assert.equal(predicted.source,'memory');
    assert.equal(predicted.evidenceAgeMs,40);
    const [recovered]=tracker.update([], image(3), 1280);
    assert.equal(recovered.source,'image');
    assert.ok(Math.abs(recovered.points[1].x-(.43+3/WIDTH))<.02);
});

test('fresh full-hand landmarks take precedence over a cached finger', () => {
    const tracker = new FingerContinuityTracker();
    seed(tracker);
    assert.equal(tracker.update([], image(2), 1200).length, 1);
    const fresh = { ...measurement, trackId: 'hand-2', handedness: 'Right',
        landmarks: measurement.landmarks.map(point => ({ x: point.x + 2 / WIDTH, y: point.y })) };
    assert.deepEqual(tracker.update([fresh], image(2), 1240), []);
    assert.deepEqual(tracker.update([], image(3), 1280), []);
});

test('stopping during a focus gap recovers even when the motion forecast overshoots',()=>{
    const tracker=new FingerContinuityTracker();seed(tracker);
    for(let i=1;i<=4;i++)assert.equal(tracker.update([],image(i*8),1160+i*40)[0].source,'image');
    const flat={width:WIDTH,height:HEIGHT,data:new Uint8Array(WIDTH*HEIGHT).fill(80)};
    tracker.update([],flat,1360);tracker.update([],flat,1400);
    const [recovered]=tracker.update([],image(32),1440);
    assert.equal(recovered.source,'image');
    assert.ok(Math.abs(recovered.points[1].x-(.43+32/WIDTH))<.02);
});

test('session resets, changed viewport, pauses and unavailable frames discard finger memory', () => {
    for (const action of [
        tracker => tracker.reset(),
        tracker => tracker.update([], null, 1200),
        tracker => tracker.update([], image(), 1161+FINGER_CONTINUITY_CONFIG.maxFrameGapMs),
        tracker => tracker.update([], image(), 1200, { left: .1, top: 0, right: .9, bottom: 1 }),
    ]) {
        const tracker = new FingerContinuityTracker();
        seed(tracker);
        action(tracker);
        assert.deepEqual(tracker.update([], image(2), 2000), []);
    }
});

test('even consistently matched pixels cannot extend anatomy memory forever', () => {
    const tracker = new FingerContinuityTracker({
        trackPoints: (_previous, _current, points) => points.map(point => ({ from: point, to: { ...point }, error: 0 })),
    });
    seed(tracker);
    let result;
    for (let age = 100; age <= 8000; age += 100) result = tracker.update([], image(), 1160 + age);
    assert.deepEqual(result, []);
});

test('two currently measured hands with the same handedness retain independent histories', () => {
    const tracker = new FingerContinuityTracker({
        trackPoints: (_previous, _current, points) => points.map(point => ({ from: point, to: { ...point }, error: 0 })),
    });
    const frame = image();
    for (let i = 0; i < frame.data.length; i++) frame.data[i] = 40 + ((Math.imul(i, 48271) >>> 8) % 180);
    const hands = [-.20, .20].map((offset, index) => ({ ...measurement, trackId: `hand-${index}`,
        landmarks: measurement.landmarks.map(point => ({ x: .5 + (point.x - .5) * .5 + offset, y: point.y })) }));
    for (let i = 0; i < 5; i++) tracker.update(hands, frame, 1000 + i * 40);
    const predictions = tracker.update([], frame, 1200);
    assert.deepEqual([...new Set(predictions.map(finger => finger.trackId))].sort(), ['hand-0', 'hand-1']);
});

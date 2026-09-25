import test from 'node:test';
import assert from 'node:assert/strict';
import { FingerContinuityTracker } from '../src/services/fingerContinuity.js';

const WIDTH = 160, HEIGHT = 160, CENTER_X = 69, CENTER_Y = 80;
const landmarks = [{ x: .5, y: .9 }];
for (const x of [.18, .43, .62, .76, .89]) {
    for (const y of [.78, .53, .33, .12]) landmarks.push({ x, y });
}
const measurement = { trackId: 'zoom-hand', handedness: 'Left', landmarks };
const source = new Uint8Array(WIDTH * HEIGHT).fill(80);
let random = 74;
for (let y = 8; y < 134; y++) {
    for (let x = 58; x < 81; x++) {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        source[y * WIDTH + x] = 50 + (random >>> 24) % 160;
    }
}

function image(scale = 1) {
    const data = new Uint8Array(WIDTH * HEIGHT).fill(80);
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const sx = (x - CENTER_X) / scale + CENTER_X;
            const sy = (y - CENTER_Y) / scale + CENTER_Y;
            const ix = Math.floor(sx), iy = Math.floor(sy);
            if (ix < 0 || iy < 0 || ix + 1 >= WIDTH || iy + 1 >= HEIGHT) continue;
            const fx = sx - ix, fy = sy - iy, offset = iy * WIDTH + ix;
            data[y * WIDTH + x] = source[offset] * (1 - fx) * (1 - fy)
                + source[offset + 1] * fx * (1 - fy)
                + source[offset + WIDTH] * (1 - fx) * fy
                + source[offset + WIDTH + 1] * fx * fy;
        }
    }
    return { width: WIDTH, height: HEIGHT, data };
}

test('image tracking follows a gradual twofold index close-up with its base and tip outside the frame', () => {
    const tracker = new FingerContinuityTracker();
    for (let frame = 0; frame < 5; frame++) tracker.update([measurement], image(), 1000 + frame * 40);
    let result;
    for (let frame = 1; frame <= 40; frame++) {
        const scale = 1 + frame / 40;
        result = tracker.update([], image(scale), 1160 + frame * 40);
        assert.equal(result.length, 1, `tracking should survive scale ${scale}`);
        assert.equal(result[0].name, 'Index');
        for (let joint = 1; joint <= 2; joint++) {
            const measured = measurement.landmarks[5 + joint];
            const expectedX = ((measured.x * WIDTH - CENTER_X) * scale + CENTER_X) / WIDTH;
            const expectedY = ((measured.y * HEIGHT - CENTER_Y) * scale + CENTER_Y) / HEIGHT;
            assert.ok(Math.hypot(result[0].points[joint].x - expectedX, result[0].points[joint].y - expectedY) < .05,
                `joint ${joint} should stay on the magnified finger at scale ${scale}`);
        }
    }
    assert.ok(result[0].points[0].y > 1, 'the index base is offscreen');
    assert.ok(result[0].points[3].y < 0, 'the index tip is offscreen');
    assert.ok(result[0].ageMs > 1000);
});

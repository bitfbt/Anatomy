import test from 'node:test';
import assert from 'node:assert/strict';
import { trackImagePoints } from '../src/services/fingerMotion.js';

function texture(width = 80, height = 72, seed = 23) {
    const data = new Uint8Array(width * height);
    let state = seed;
    for (let i = 0; i < data.length; i++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        data[i] = 45 + (state >>> 24) % 155;
    }
    return { width, height, data };
}

function translate(frame, dx, dy, brightness = 0) {
    const { width, height } = frame;
    const data = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (x - dx >= 0 && x - dx < width && y - dy >= 0 && y - dy < height) {
                data[y * width + x] = frame.data[(y - dy) * width + x - dx] + brightness;
            }
        }
    }
    return { width, height, data };
}

function affineFrame(frame, scale, angle, dx, dy) {
    const { width, height } = frame;
    const data = new Uint8Array(width * height);
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tx = x - width / 2 - dx, ty = y - height / 2 - dy;
            const sx = (cosine * tx + sine * ty) / scale + width / 2;
            const sy = (-sine * tx + cosine * ty) / scale + height / 2;
            const ix = Math.floor(sx), iy = Math.floor(sy);
            if (ix < 0 || iy < 0 || ix + 1 >= width || iy + 1 >= height) continue;
            const fx = sx - ix, fy = sy - iy;
            const offset = iy * width + ix;
            data[y * width + x] = frame.data[offset] * (1 - fx) * (1 - fy)
                + frame.data[offset + 1] * fx * (1 - fy)
                + frame.data[offset + width] * (1 - fx) * fy
                + frame.data[offset + width + 1] * fx * fy;
        }
    }
    return { width, height, data };
}

const points = [{ x: 20, y: 20 }, { x: 40, y: 36 }, { x: 60.3, y: 50.2 }];

test('tracks image-supported translations in both axes, including fractional input points', () => {
    const previous = texture();
    for (const [dx, dy] of [[0, 0], [8, -6], [-7, 8], [1, 2]]) {
        const matches = trackImagePoints(previous, translate(previous, dx, dy), points);
        assert.equal(matches.length, points.length);
        matches.forEach((match, i) => {
            assert.deepEqual(match.from, points[i]);
            assert.ok(Math.abs(match.to.x - points[i].x - dx) < 1e-8);
            assert.ok(Math.abs(match.to.y - points[i].y - dy) < 1e-8);
            assert.ok(match.error < 1e-6);
        });
    }
});

test('exposure brightness changes preserve motion tracking', () => {
    const previous = texture();
    const matches = trackImagePoints(previous, translate(previous, 5, -3, 28), points);
    assert.equal(matches.length, points.length);
    for (const match of matches) {
        assert.ok(Math.abs(match.to.x - match.from.x - 5) < 1e-8);
        assert.ok(Math.abs(match.to.y - match.from.y + 3) < 1e-8);
        assert.ok(match.error < 1e-6);
    }
});

test('incremental close-up magnification and rotation preserve local image correspondences', () => {
    const source = texture();
    const previous = { ...source, data: source.data.slice() };
    // Camera texture has spatial continuity, unlike independent pixel noise.
    for (let y = 1; y < source.height - 1; y++) {
        for (let x = 1; x < source.width - 1; x++) {
            let sum = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) sum += source.data[(y + dy) * source.width + x + dx];
            }
            previous.data[y * source.width + x] = sum / 9;
        }
    }
    const scale = 1.04, angle = 0.045, dx = 3, dy = 2;
    const current = affineFrame(previous, scale, angle, dx, dy);
    const matches = trackImagePoints(previous, current, points);
    assert.equal(matches.length, points.length);
    for (const { from, to } of matches) {
        const x = from.x - previous.width / 2, y = from.y - previous.height / 2;
        const expected = {
            x: scale * (Math.cos(angle) * x - Math.sin(angle) * y) + previous.width / 2 + dx,
            y: scale * (Math.sin(angle) * x + Math.cos(angle) * y) + previous.height / 2 + dy,
        };
        assert.ok(Math.hypot(to.x - expected.x, to.y - expected.y) < 1);
    }
});

test('flat images, straight edges, unrelated content and repeated textures are not motion evidence', () => {
    const flat = { width: 80, height: 72, data: new Uint8Array(80 * 72).fill(100) };
    assert.deepEqual(trackImagePoints(flat, flat, points), []);
    const edge = { ...flat, data: flat.data.map((_, i) => i % 80 < 40 ? 60 : 180) };
    assert.deepEqual(trackImagePoints(edge, translate(edge, 2, 0), [{ x: 40, y: 36 }]), []);
    assert.deepEqual(trackImagePoints(texture(), texture(80, 72, 94), points), []);
    const repeated = { ...flat, data: flat.data.map((_, i) => (i % 80 % 4 < 2) !== (Math.floor(i / 80) % 4 < 2) ? 60 : 180) };
    assert.deepEqual(trackImagePoints(repeated, repeated, points), []);
});

test('rejects occluded points while continuing to track visible points', () => {
    const previous = texture();
    const current = translate(previous, 3, 2);
    for (let y = 13; y < 32; y++) {
        for (let x = 14; x < 33; x++) current.data[y * current.width + x] = 90;
    }
    const matches = trackImagePoints(previous, current, points);
    assert.equal(matches.length, 2);
    assert.deepEqual(matches.map(match => match.from), points.slice(1));
});

test('patches outside the frame are skipped and patches near the frame edge can still track', () => {
    const previous = texture();
    const current = translate(previous, -5, 0);
    const matches = trackImagePoints(previous, current, [
        { x: -1, y: 20 }, { x: 2, y: 20 }, { x: 78, y: 20 },
        { x: 6, y: 20 }, { x: 9, y: 40 }, { x: NaN, y: 20 },
    ]);
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0].from, { x: 9, y: 40 });
    assert.deepEqual(matches[0].to, { x: 4, y: 40 });
});

test('large unsupported jumps and invalid frames do not invent correspondences', () => {
    const previous = texture();
    assert.deepEqual(trackImagePoints(previous, translate(previous, 20, 0), points), []);
    assert.deepEqual(trackImagePoints(previous, texture(70, 72), points), []);
    assert.deepEqual(trackImagePoints(previous, { ...previous, data: new Uint8Array(1) }, points), []);
    assert.deepEqual(trackImagePoints(null, previous, points), []);
    assert.deepEqual(trackImagePoints(previous, previous, null), []);
});

test('recent motion can guide a larger displacement but cannot replace pixel evidence',()=>{
    const previous=texture(120,100),points=[{x:30,y:30},{x:55,y:50},{x:80,y:70}];
    const predictions=points.map(p=>({x:p.x+22,y:p.y-3}));
    const current=translate(previous,22,-3);
    assert.deepEqual(trackImagePoints(previous,current,points),[]);
    const matches=trackImagePoints(previous,current,points,{predictions});
    assert.equal(matches.length,3);
    for(const match of matches){assert.equal(match.to.x-match.from.x,22);assert.equal(match.to.y-match.from.y,-3);}
    assert.deepEqual(trackImagePoints(previous,texture(120,100,94),points,{predictions}),[]);
    assert.deepEqual(trackImagePoints(previous,current,points,{predictions:points.map(p=>({x:p.x+100,y:p.y}))}),[]);
});

test('point count bounds the work even if the caller supplies a very large list', () => {
    const previous = texture();
    const matches = trackImagePoints(previous, previous, Array(1000).fill(points[0]));
    assert.equal(matches.length, 64);
});

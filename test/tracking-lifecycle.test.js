import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTrackingLifecycle } from '../src/services/trackingLifecycle.js';
import { FingerFrameSampler } from '../src/services/fingerContinuity.js';

function fixture() {
    const callbacks = new Map();
    const cancelled = [];
    let sequence = 0;
    const lifecycle = createTrackingLifecycle({
        requestFrame(callback) { callbacks.set(++sequence, callback); return sequence; },
        cancelFrame(id) { cancelled.push(id); },
    });
    return { lifecycle, callbacks, cancelled };
}

test('Stop and unmount invalidate pending model initialization across rapid scans', async () => {
    const { lifecycle } = fixture();
    let resolveModels;
    const models = new Promise(resolve => { resolveModels = resolve; });
    const token = lifecycle.beginScan();
    let obsoleteStarts = 0;
    const initialization = models.then(() => {
        if (lifecycle.isCurrentScan(token)) obsoleteStarts += 1;
    });
    lifecycle.cancelScan();
    const nextToken = lifecycle.beginScan();
    resolveModels();
    await initialization;
    assert.equal(obsoleteStarts, 0);
    assert.equal(lifecycle.isCurrentScan(nextToken), true);
    lifecycle.cancelScan(); // The same teardown used by React unmount.
    assert.equal(lifecycle.isCurrentScan(nextToken), false);
    assert.equal(lifecycle.isActive(), false);
});

test('stopped callbacks cannot resurrect a loop or overwrite its replacement', () => {
    const { lifecycle, callbacks, cancelled } = fixture();
    lifecycle.beginScan();
    let disposed = 0;
    const old = lifecycle.startLoop(() => { disposed += 1; });
    let calls = 0;
    old.schedule(() => { calls += 1; old.schedule(() => { calls += 1; }); });
    const stale = callbacks.get(1);
    lifecycle.cancelScan();
    lifecycle.beginScan();
    const current = lifecycle.startLoop(() => { disposed += 1; });
    current.schedule(() => { calls += 1; });
    stale(); // A callback already dispatched before cancellation is also inert.
    old.schedule(() => { calls += 100; });
    assert.equal(calls, 0);
    assert.equal(callbacks.size, 2);
    callbacks.get(2)();
    assert.equal(calls, 1);
    assert.deepEqual(cancelled, [1]);
    lifecycle.cancelScan();
    assert.equal(disposed, 2);
});

test('background release disposes pixels while preserving current scan for resume', () => {
    const { lifecycle } = fixture();
    const token = lifecycle.beginScan();
    const capture = { width: 1280, height: 720 };
    const owner = lifecycle.startLoop(() => { capture.width = capture.height = 0; });
    lifecycle.stopLoop();
    assert.deepEqual(capture, { width: 0, height: 0 });
    assert.equal(owner.isCurrent(), false);
    assert.equal(lifecycle.isCurrentScan(token), true);
    assert.equal(lifecycle.isRunning(), false);
    assert.ok(lifecycle.startLoop(() => {}));
    lifecycle.cancelScan();
});

test('starting another loop disposes its predecessor and retains only one owner', () => {
    const { lifecycle, cancelled } = fixture();
    lifecycle.beginScan();
    let disposed = 0;
    const first = lifecycle.startLoop(() => { disposed += 1; });
    first.schedule(() => assert.fail('old frame executed'));
    const second = lifecycle.startLoop(() => { disposed += 1; });
    assert.equal(first.isCurrent(), false);
    assert.equal(second.isCurrent(), true);
    assert.equal(disposed, 1);
    assert.deepEqual(cancelled, [1]);
    lifecycle.cancelScan();
    assert.equal(disposed, 2);
});

test('sampler reset erases its backing pixels and releases the canvas', () => {
    const sampler = new FingerFrameSampler();
    const canvas = { width: 320, height: 180 };
    sampler.canvas = canvas;
    sampler.reset();
    assert.deepEqual(canvas, { width: 0, height: 0 });
    assert.equal(sampler.canvas, null);
    sampler.reset();
});

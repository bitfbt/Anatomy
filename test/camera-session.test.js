import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCameraSession } from '../src/services/cameraSession.js';

function fakeStream() {
    const track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
    return { getTracks: () => [track] };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('releases every track when hidden and acquires a fresh stream on return', async () => {
    const streams = [];
    const updates = [];
    const session = createCameraSession({
        getUserMedia: async () => { const stream = fakeStream(); streams.push(stream); return stream; },
        onStream: stream => updates.push(stream),
        onError: assert.fail,
    });
    await session.setActive(true);
    await session.setActive(true);
    assert.equal(streams.length, 1);
    session.setActive(false);
    assert.equal(streams[0].getTracks()[0].readyState, 'ended');
    assert.equal(updates.at(-1), null);
    await session.setActive(true);
    assert.equal(streams.length, 2);
    assert.equal(updates.at(-1), streams[1]);
    session.dispose();
    assert.equal(streams[1].getTracks()[0].readyState, 'ended');
});

test('a request that finishes after backgrounding is stopped without attaching', async () => {
    const request = deferred();
    const stream = fakeStream();
    const session = createCameraSession({
        getUserMedia: () => request.promise,
        onStream: () => assert.fail('obsolete capture must never attach'),
        onError: assert.fail,
    });
    const pending = session.setActive(true);
    await flush();
    session.setActive(false);
    request.resolve(stream);
    await pending;
    assert.equal(stream.getTracks()[0].readyState, 'ended');
    session.dispose();
});

test('returning while permission is pending waits for cleanup before reacquiring', async () => {
    const first = deferred();
    const obsolete = fakeStream();
    const fresh = fakeStream();
    const attached = [];
    let calls = 0;
    const session = createCameraSession({
        getUserMedia: () => {
            calls += 1;
            if (calls === 1) return first.promise;
            assert.equal(obsolete.getTracks()[0].readyState, 'ended');
            return Promise.resolve(fresh);
        },
        onStream: stream => attached.push(stream),
        onError: assert.fail,
    });
    session.setActive(true);
    await flush();
    session.setActive(false);
    session.setActive(true);
    assert.equal(calls, 1);
    first.resolve(obsolete);
    await flush();
    assert.equal(calls, 2);
    assert.deepEqual(attached, [fresh]);
    session.dispose();
});

test('unmount and remount never overlap pending capture requests', async () => {
    const first = deferred();
    const obsolete = fakeStream();
    const fresh = fakeStream();
    let nextStarted = false;
    const previous = createCameraSession({
        facingMode:'environment',
        getUserMedia: constraints => {
            assert.equal(constraints.video.facingMode.ideal,'environment');
            return first.promise;
        },
        onStream: () => assert.fail('unmounted session must never attach'),
        onError: assert.fail,
    });
    previous.setActive(true);
    await flush();
    previous.dispose();
    const next = createCameraSession({
        facingMode:'user',
        getUserMedia: async constraints => {
            assert.equal(constraints.video.facingMode.ideal,'user');
            nextStarted = true;
            assert.equal(obsolete.getTracks()[0].readyState, 'ended');
            return fresh;
        },
        onStream: () => {},
        onError: assert.fail,
    });
    const pending = next.setActive(true);
    await flush();
    assert.equal(nextStarted, false);
    first.resolve(obsolete);
    await pending;
    assert.equal(nextStarted, true);
    next.dispose();
});

test('changing from a live rear camera releases it before acquiring the front camera',async()=>{
    const rear=fakeStream(),front=fakeStream(),updates=[];
    const old=createCameraSession({facingMode:'environment',getUserMedia:async()=>rear,
        onStream:stream=>updates.push(stream),onError:assert.fail});
    await old.setActive(true);
    old.dispose();
    const next=createCameraSession({facingMode:'user',getUserMedia:async constraints=>{
        assert.equal(rear.getTracks()[0].readyState,'ended');
        assert.equal(constraints.video.facingMode.ideal,'user');
        assert.equal(constraints.audio,false);
        return front;
    },onStream:stream=>updates.push(stream),onError:assert.fail});
    await next.setActive(true);
    assert.deepEqual(updates,[rear,null,front]);
    next.dispose();
});

test('current failures are reported once without an automatic retry loop', async () => {
    const error = new Error('Camera unavailable');
    const errors = [];
    let calls = 0;
    const session = createCameraSession({
        getUserMedia: async () => { calls += 1; throw error; },
        onStream: assert.fail,
        onError: value => errors.push(value),
    });
    await session.setActive(true);
    await flush();
    assert.equal(calls, 1);
    assert.deepEqual(errors, [error]);
    session.dispose();
});

test('a rejected request from an unmounted view does not update the new UI', async () => {
    const request = deferred();
    const session = createCameraSession({
        getUserMedia: () => request.promise,
        onStream: assert.fail,
        onError: () => assert.fail('stale error must be ignored'),
    });
    const pending = session.setActive(true);
    await flush();
    session.dispose();
    request.reject(new Error('interrupted'));
    await pending;
});

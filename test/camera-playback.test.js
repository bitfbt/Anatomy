import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playCameraVideo } from '../src/services/cameraPlayback.js';

test('starts a paused camera as muted inline video', async () => {
    const video = {
        srcObject: {}, paused: true,
        async play() {
            assert.equal(this.muted, true);
            assert.equal(this.defaultMuted, true);
            assert.equal(this.playsInline, true);
            this.paused = false;
        },
    };
    assert.equal(await playCameraVideo(video), true);
});

test('blocked autoplay preserves the stream for a successful user retry', async () => {
    const stream = {};
    let blocked = true;
    const video = {
        srcObject: stream, paused: true,
        async play() {
            if (blocked) throw new DOMException('Gesture required', 'NotAllowedError');
            this.paused = false;
        },
    };
    assert.equal(await playCameraVideo(video), false);
    assert.equal(video.srcObject, stream);
    blocked = false;
    assert.equal(await playCameraVideo(video), true);
});

test('does not report playback without a stream or when video stays paused', async () => {
    assert.equal(await playCameraVideo(null), false);
    assert.equal(await playCameraVideo({ play() { assert.fail('no stream'); } }), false);
    assert.equal(await playCameraVideo({ srcObject: {}, paused: true, async play() {} }), false);
});

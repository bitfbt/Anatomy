import assert from 'node:assert/strict';
import test from 'node:test';
import { HandContinuityTracker } from '../src/services/handContinuity.js';
import { validateHandForRendering } from '../src/services/handValidation.js';

const WIDTH = 500;
const HEIGHT = 700;
const BOUNDS = { left: 18, top: 18, right: 482, bottom: 682 };
const POINTS = [
    [.50, .88],
    [.39, .78], [.30, .70], [.24, .60], [.20, .49],
    [.41, .64], [.39, .44], [.38, .27], [.38, .11],
    [.50, .62], [.50, .38], [.50, .19], [.50, .07],
    [.59, .64], [.61, .43], [.62, .27], [.63, .12],
    [.68, .67], [.72, .49], [.74, .36], [.75, .23],
];

function hand({ x = .5, y = .60, scale = .85, handedness = 'Left', valid = true } = {}) {
    return {
        landmarks: POINTS.map(([px, py]) => ({ x: x + (px - .5) * scale, y: y + (py - .62) * scale, z: 0 })),
        valid, handedness, confidence: .94,
    };
}

function update(tracker, observations, now, width = WIDTH, height = HEIGHT, bounds = BOUNDS) {
    return tracker.update(observations, now, width, height, bounds);
}

function seed(tracker, makeObservation = i => hand({ x: .48 + i * .005, scale: .75 + i * .05 }), count = 5) {
    let observation;
    let result;
    for (let i = 0; i < count; i++) {
        observation = makeObservation(i);
        result = update(tracker, [observation], 1000 + i * 40);
    }
    return { observation, result, time: 1000 + (count - 1) * 40 };
}

const span = landmarks => Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
const palmCenterX = landmarks => [0, 5, 9, 13, 17].reduce((sum, index) => sum + landmarks[index].x, 0) / 5;
const finite = prediction => prediction.landmarks.length === 21 && prediction.landmarks.every(point => Number.isFinite(point.x) && Number.isFinite(point.y));

test('does not invent a hand before a short measured history is established', () => {
    const tracker = new HandContinuityTracker();
    assert.deepEqual(update(tracker, [], 900).predictions, []);
    const { time } = seed(tracker, undefined, 3);
    assert.deepEqual(update(tracker, [], time + 40).predictions, []);
});

test('four measured frames are sufficient to bridge a detector dropout', () => {
    const tracker = new HandContinuityTracker();
    const { time } = seed(tracker, undefined, 4);
    const result = update(tracker, [], time + 40);
    assert.equal(result.predictions.length, 1);
    assert.ok(finite(result.predictions[0]));
});

test('continues recent approach motion and scale, then fades and expires', () => {
    const tracker = new HandContinuityTracker();
    const { observation, result, time } = seed(tracker);
    const early = update(tracker, [], time + 80).predictions;
    assert.equal(early.length, 1);
    assert.equal(early[0].trackId, result.trackIds[0]);
    assert.equal(early[0].handedness, 'Left');
    assert.equal(early[0].ageMs, 80);
    assert.ok(finite(early[0]));
    assert.ok(early[0].alpha > 0 && early[0].alpha <= 1);
    assert.ok(span(early[0].landmarks) > span(observation.landmarks), 'the overlay should keep enlarging briefly as the hand approaches');
    assert.ok(palmCenterX(early[0].landmarks) > palmCenterX(observation.landmarks), 'the overlay should continue the observed translation');
    const late = update(tracker, [], time + 650).predictions;
    assert.equal(late.length, 1);
    assert.ok(late[0].alpha < early[0].alpha);
    assert.ok(span(late[0].landmarks) < span(observation.landmarks) * 2, 'extrapolation should remain bounded');
    assert.deepEqual(update(tracker, [], time + 1001).predictions, []);
});

test('repeated predicted frames never refresh the measurement lifetime', () => {
    const tracker = new HandContinuityTracker();
    const { time } = seed(tracker);
    for (let elapsed = 40; elapsed <= 960; elapsed += 40) update(tracker, [], time + elapsed);
    assert.deepEqual(update(tracker, [], time + 1001).predictions, []);
});

test('uses live cropped palm anchors without extending the full hand history', () => {
    const tracker = new HandContinuityTracker();
    const { observation, result, time } = seed(tracker, i => hand({ scale: 1.4 + i * .15 }));
    const cropped = hand({ scale: 2.6, valid: false });
    assert.equal(validateHandForRendering(observation.landmarks, .94, WIDTH, HEIGHT, BOUNDS).valid, true);
    assert.equal(validateHandForRendering(cropped.landmarks, .94, WIDTH, HEIGHT, BOUNDS).valid, false);
    const croppedResult = update(tracker, [cropped], time + 40);
    const anchored = croppedResult.predictions;
    assert.equal(croppedResult.trackIds[0], null, "a crop is not a fresh full-hand measurement");
    assert.equal(anchored[0].observationIndex, 0, "the forearm must pair with this exact continuation hand");
    assert.equal(anchored.length, 1);
    assert.equal(anchored[0].trackId, result.trackIds[0]);
    for (const index of [5, 9, 13]) {
        assert.ok(Math.abs(anchored[0].landmarks[index].x - cropped.landmarks[index].x) < 1e-6);
        assert.ok(Math.abs(anchored[0].landmarks[index].y - cropped.landmarks[index].y) < 1e-6);
    }
    assert.ok(span(anchored[0].landmarks) > span(observation.landmarks));
    assert.equal(update(tracker, [cropped], time + 650).predictions[0].ageMs, 650);
    assert.deepEqual(update(tracker, [cropped], time + 1001).predictions, []);
});

test('a fresh detection replaces its prediction and renews its measured lifetime', () => {
    const tracker = new HandContinuityTracker();
    const { result, time } = seed(tracker);
    assert.equal(update(tracker, [], time + 40).predictions.length, 1);
    const recovered = update(tracker, [hand({ x: .51, scale: 1.0 })], time + 80);
    assert.deepEqual(recovered.predictions, []);
    assert.equal(recovered.trackIds[0], result.trackIds[0]);
    const nextDropout = update(tracker, [], time + 120).predictions;
    assert.equal(nextDropout.length, 1);
    assert.equal(nextDropout[0].ageMs, 40);
});

test('keeps a missing hand independently while the other remains detected', () => {
    const tracker = new HandContinuityTracker();
    const left = hand({ x: .28, scale: .38, handedness: 'Left' });
    const right = hand({ x: .72, scale: .38, handedness: 'Right' });
    let measured;
    for (let i = 0; i < 5; i++) measured = update(tracker, [left, right], 1000 + i * 40);
    const partial = update(tracker, [right], 1200);
    assert.equal(partial.trackIds[0], measured.trackIds[1]);
    assert.equal(partial.predictions.length, 1);
    assert.equal(partial.predictions[0].trackId, measured.trackIds[0]);
    assert.equal(partial.predictions[0].handedness, 'Left');
});

test('identities survive reordered detections and uncertain handedness', () => {
    const tracker = new HandContinuityTracker();
    const left = hand({ x: .28, scale: .38, handedness: 'Left' });
    const right = hand({ x: .72, scale: .38, handedness: 'Right' });
    const initial = update(tracker, [left, right], 1000);
    const reordered = update(tracker, [right, { ...left, handedness: 'Hand', confidence: .45 }], 1040);
    assert.deepEqual(reordered.trackIds, [initial.trackIds[1], initial.trackIds[0]]);
    assert.deepEqual(reordered.predictions, []);
});

test('a handedness classification flip cannot leave a duplicate prediction on a live hand', () => {
    const tracker = new HandContinuityTracker();
    const { observation, time } = seed(tracker);
    const flipped = { ...observation, handedness: 'Right', confidence: .96 };
    const result = update(tracker, [flipped], time + 40);
    assert.equal(result.trackIds.length, 1);
    assert.deepEqual(result.predictions, []);
});

test('predicts a slow turn in screen coordinates without distorting palm size', () => {
    const tracker = new HandContinuityTracker();
    const { observation, time } = seed(tracker, i => {
        const original = hand({ scale: .75 });
        const angle = i * .025;
        original.landmarks = original.landmarks.map(point => {
            const dx = (point.x - .5) * WIDTH;
            const dy = (point.y - .6) * HEIGHT;
            return { ...point, x: .5 + (dx * Math.cos(angle) - dy * Math.sin(angle)) / WIDTH,
                y: .6 + (dx * Math.sin(angle) + dy * Math.cos(angle)) / HEIGHT };
        });
        return original;
    });
    const projected = update(tracker, [], time + 80).predictions;
    assert.equal(projected.length, 1);
    const palmAngle = points => Math.atan2((points[17].y - points[5].y) * HEIGHT, (points[17].x - points[5].x) * WIDTH);
    const palmWidth = points => Math.hypot((points[17].y - points[5].y) * HEIGHT, (points[17].x - points[5].x) * WIDTH);
    assert.ok(palmAngle(projected[0].landmarks) > palmAngle(observation.landmarks));
    assert.ok(Math.abs(palmWidth(projected[0].landmarks) - palmWidth(observation.landmarks)) < 1e-6);
});

test('explicit geometry leaving the view suppresses and invalidates the old overlay', () => {
    const tracker = new HandContinuityTracker();
    const { observation, time } = seed(tracker, i => hand({ x: .80 + i * .03, scale: .38 }));
    const outside = hand({ x: 1.0, scale: .38, valid: false });
    assert.equal(validateHandForRendering(observation.landmarks, .94, WIDTH, HEIGHT, BOUNDS).valid, true);
    assert.equal(validateHandForRendering(outside.landmarks, .94, WIDTH, HEIGHT, BOUNDS).valid, false);
    assert.deepEqual(update(tracker, [outside], time + 40).predictions, []);
    assert.deepEqual(update(tracker, [], time + 80).predictions, []);
});

test('malformed detector coordinates cannot poison later measured or predicted geometry', () => {
    const tracker = new HandContinuityTracker();
    const malformed = hand();
    malformed.landmarks[8].x = NaN;
    const first = update(tracker, [malformed, { ...hand(), landmarks: [] }], 900);
    assert.deepEqual(first.predictions, []);
    const { time } = seed(tracker);
    const badFrame = update(tracker, [malformed], time + 40);
    assert.ok(badFrame.predictions.every(finite));
    const recovered = update(tracker, [hand({ scale: .95 })], time + 80);
    assert.equal(recovered.trackIds.length, 1);
    assert.ok(update(tracker, [], time + 120).predictions.every(finite));
});

test('reset discards all history so a new scan cannot show the previous hand', () => {
    const tracker = new HandContinuityTracker();
    const { time } = seed(tracker);
    tracker.reset();
    assert.deepEqual(update(tracker, [], time + 40).predictions, []);
    update(tracker, [hand()], time + 80);
    assert.deepEqual(update(tracker, [], time + 120).predictions, []);
});

test('changing viewport orientation invalidates estimates fitted to the old view', () => {
    const tracker = new HandContinuityTracker();
    const { time } = seed(tracker);
    assert.equal(update(tracker, [], time + 40).predictions.length, 1);
    const landscapeBounds = { left: 18, top: 18, right: 682, bottom: 482 };
    assert.deepEqual(update(tracker, [], time + 80, HEIGHT, WIDTH, landscapeBounds).predictions, []);
});

test('uses the visible portrait crop within object-fit cover coordinates', () => {
    const tracker = new HandContinuityTracker();
    const drawWidth = 1244;
    const drawHeight = 700;
    const portraitBounds = { left: 390, top: 18, right: 854, bottom: 682 };
    for (let i = 0; i < 5; i++) {
        update(tracker, [hand({ x: .56 + i * .02, scale: .45 + i * .015 })], 1000 + i * 40, drawWidth, drawHeight, portraitBounds);
    }
    const prediction = update(tracker, [], 1200, drawWidth, drawHeight, portraitBounds).predictions;
    assert.equal(prediction.length, 1);
    assert.ok(finite(prediction[0]));
    const departed = hand({ x: .73, scale: .51, valid: false });
    assert.equal(validateHandForRendering(departed.landmarks, .94, drawWidth, drawHeight, portraitBounds).valid, false);
    assert.deepEqual(update(tracker, [departed], 1240, drawWidth, drawHeight, portraitBounds).predictions, []);
    assert.deepEqual(update(tracker, [], 1280, drawWidth, drawHeight, portraitBounds).predictions, []);
});

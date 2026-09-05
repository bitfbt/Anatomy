import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let vite;
let ScanButton;
let ErrorFallback;
let HUD;

const noOp = () => {};

function renderScanButton(overrides = {}) {
    return renderToStaticMarkup(React.createElement(ScanButton, {
        state: 'active',
        anatomyTarget: 'hand',
        onAnatomyTargetChange: noOp,
        onScan: noOp,
        onRescan: noOp,
        onAnalyze: noOp,
        labelMode: 'off',
        onLabelModeChange: noOp,
        wristMode: 'simple',
        onWristModeChange: noOp,
        layer: 'skeleton',
        onLayerChange: noOp,
        muscleLabelMode: 'clean',
        onMuscleLabelModeChange: noOp,
        muscleSide: 'palm',
        onMuscleSideChange: noOp,
        ...overrides,
    }));
}

before(async () => {
    vite = await createServer({
        appType: 'custom',
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true },
    });
    ({ default: ScanButton } = await vite.ssrLoadModule('/src/components/ScanButton.jsx'));
    ({ default: ErrorFallback } = await vite.ssrLoadModule('/src/components/ErrorFallback.jsx'));
    ({ default: HUD } = await vite.ssrLoadModule('/src/components/HUD.jsx'));
});

after(async () => {
    await vite.close();
});

test('shows a single Scan entry point before tracking starts', () => {
    const markup = renderScanButton({ state: 'idle' });
    assert.match(markup, /id="scan-button"/);
    assert.doesNotMatch(markup, /control-dock/);
});

test('keeps active Skeleton controls focused and removes recording', () => {
    const markup = renderScanButton();
    assert.match(markup, /id="analyze-button"/);
    assert.match(markup, /id="rescan-button"/);
    assert.match(markup, /Labels/);
    assert.match(markup, /Wrist/);
    assert.doesNotMatch(markup, /Record/);
    assert.doesNotMatch(markup, /Stop Rec/);
});

test('switches active controls to the muscle-specific set', () => {
    const markup = renderScanButton({ layer: 'muscles' });
    assert.match(markup, /Muscles/);
    assert.match(markup, /Side/);
    assert.match(markup, /Palm/);
    assert.match(markup, /Back/);
    assert.doesNotMatch(markup, /Wrist/);
});

test('shows an explicit face muscle view without hand-only wrist or side controls', () => {
    const markup = renderScanButton({ anatomyTarget: 'face', layer: 'muscles' });
    assert.match(markup, /Target/);
    assert.match(markup, />Hand</);
    assert.match(markup, />Face</);
    assert.match(markup, /View/);
    assert.match(markup, /Enable facial muscle view/);
    assert.match(markup, />Muscles</);
    assert.match(markup, /Overlay/);
    assert.match(markup, />Off</);
    assert.match(markup, />Simple</);
    assert.match(markup, />Detailed</);
    assert.doesNotMatch(markup, /Muscle label mode controls/);
    assert.doesNotMatch(markup, />Bones</);
    assert.doesNotMatch(markup, /Wrist/);
    assert.doesNotMatch(markup, />Palm</);
    assert.doesNotMatch(markup, />Back</);
});

test('does not expose a non-functional upload action in the camera fallback', () => {
    const markup = renderToStaticMarkup(React.createElement(ErrorFallback, { type: 'camera' }));
    assert.match(markup, /Camera Access Denied/);
    assert.match(markup, /grant camera permission/i);
    assert.doesNotMatch(markup, /upload-button/);
});

test('uses a local tracker recovery message rather than an API error', () => {
    const markup = renderToStaticMarkup(React.createElement(ErrorFallback, {
        type: 'tracker-error',
        message: 'Failed to load tracking models',
        onRetry: noOp,
    }));
    assert.match(markup, /Tracker Unavailable/);
    assert.match(markup, /Retry/);
    assert.doesNotMatch(markup, /API Error/);
});

test('describes Back-side muscle rendering as dorsal anatomy', () => {
    const markup = renderToStaticMarkup(React.createElement(HUD, {
        state: 'active',
        layer: 'muscles',
        muscleSide: 'back',
        trackingInfo: {
            status: 'Tracking: Left Hand',
            statusType: 'tracking',
            acceptedHands: 1,
            acceptedLandmarks: true,
            handedness: 'Left Hand',
            handednessUncertain: false,
            rawConfidence: 0.94,
            acceptedConfidence: 0.94,
            lastValidConfidence: 0.94,
            skeletonStatus: 'Muscle overlay',
            warnings: [],
        },
    }));

    assert.match(markup, /Estimated dorsal overlay/);
    assert.doesNotMatch(markup, /Palm-side muscle detail is limited/);
});

test('keeps the face HUD compact and honest about overlay status', () => {
    const markup = renderToStaticMarkup(React.createElement(HUD, {
        state: 'active',
        anatomyTarget: 'face',
        layer: 'muscles',
        trackingInfo: {
            target: 'face',
            status: 'Tracking: Face',
            statusType: 'tracking',
            acceptedHands: 1,
            acceptedTargets: 1,
            acceptedLandmarks: true,
            rawConfidence: 0,
            rawConfidenceAvailable: false,
            acceptedConfidence: 0.91,
            lastValidConfidence: 0.91,
            skeletonStatus: 'Facial muscles rendering',
            warnings: [],
        },
    }));

    assert.match(markup, /FACIAL MUSCLES/);
    assert.match(markup, /Face detected/);
    assert.match(markup, /Confidence/);
    assert.match(markup, /Overlay mode/);
    assert.match(markup, /Simple/);
    assert.match(markup, /Estimated facial muscle overlay from visible landmarks/);
    assert.doesNotMatch(markup, /Detector score/);
    assert.doesNotMatch(markup, /Last valid/);
    assert.doesNotMatch(markup, /Muscle side/);
});

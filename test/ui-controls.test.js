import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let vite;
let ScanButton;
let ErrorFallback;
let HUD;
let WristLegend;
let ForearmControls;

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
    ({ default: WristLegend } = await vite.ssrLoadModule('/src/components/WristLegend.jsx'));
    ({ default: ForearmControls } = await vite.ssrLoadModule('/src/components/ForearmControls.jsx'));
});

after(async () => {
    await vite.close();
});

test('shows a single Scan entry point before tracking starts', () => {
    const markup = renderScanButton({ state: 'idle' });
    assert.match(markup, /id="scan-button"/);
    assert.doesNotMatch(markup, /control-dock/);
});

test('opens the bundled privacy notice inside the app in idle and active states', () => {
    for (const state of ['idle', 'active']) {
        const markup = renderScanButton({ state });
        assert.match(markup, /<dialog[^>]*id="privacy-notice"/);
        assert.match(markup, /<iframe[^>]*src="\/privacy.html"/);
        assert.match(markup, /aria-controls="privacy-notice"/);
        assert.doesNotMatch(markup, /target="_blank"/);
    }
});

test('opens the text-only user guide from the start screen and active settings', () => {
    for (const state of ['idle', 'active']) {
        const markup = renderScanButton({ state });
        assert.match(markup, /How to use AnatomyLens/);
        assert.match(markup, /<dialog[^>]*id="how-to-use"/);
        assert.match(markup, /<iframe[^>]*src="\/guide\.html"/);
        assert.match(markup, /aria-controls="how-to-use"/);
    }
});

test('camera switching is available before scanning and in both anatomy views',()=>{
    for(const state of ['idle','active'])for(const layer of ['skeleton','muscles']){
        const rear=renderScanButton({state,layer,cameraFacing:'environment'});
        assert.match(rear,/aria-label="Switch to front camera"/);
        assert.match(rear,/>Rear</);
        const front=renderScanButton({state,layer,cameraFacing:'user'});
        assert.match(front,/aria-label="Switch to rear camera"/);
        assert.match(front,/>Front</);
    }
    assert.match(renderScanButton({cameraSwitching:true}),/disabled=""/);
});

test('keeps the active bar compact with secondary controls in a closed settings dialog', () => {
    const markup = renderScanButton();
    assert.match(markup, /id="analyze-button"/);
    assert.match(markup, /id="rescan-button"/);
    assert.match(markup, /Labels/);
    assert.match(markup, /Wrist/);
    assert.match(markup, /<dialog[^>]*id="scan-settings"/);
    assert.doesNotMatch(markup, /<dialog[^>]* open/);
    assert.match(markup, /aria-haspopup="dialog"/);
    assert.match(markup, /Face · Coming soon/);
    assert.match(markup, /Full body · Coming soon/);
    const bar = markup.split('<dialog')[0];
    assert.doesNotMatch(bar, /Coming soon|Wrist|Labels|Analyze|Resume tracking/);
    assert.match(bar, />Bones</);
    assert.match(bar, />Muscles</);
    assert.doesNotMatch(markup, /Record/);
    assert.doesNotMatch(markup, /Stop Rec/);
});

test('switches active controls to the muscle-specific set', () => {
    const markup = renderScanButton({ layer: 'muscles' });
    assert.match(markup, /Muscles/);
    assert.match(markup, /Hand side/);
    assert.match(markup, /Palm/);
    assert.match(markup, /Back/);
    assert.doesNotMatch(markup, /Wrist/);
});

test('shows an explicit face muscle view without hand-only wrist or side controls', () => {
    const markup = renderScanButton({ anatomyTarget: 'face', layer: 'muscles' });
    assert.match(markup, /<dialog[^>]*id="scan-settings"/);
    assert.doesNotMatch(markup, /<dialog[^>]* open/);
    assert.match(markup, /aria-haspopup="dialog"/);
    assert.match(markup, />Hand \+ forearm</);
    assert.match(markup, /Face · Coming soon/);
    assert.match(markup, /Anatomy view/);
    assert.match(markup, /Facial muscle overlay controls/);
    assert.match(markup, />Muscles</);
    assert.match(markup, /Overlay/);
    assert.match(markup, />Off</);
    assert.match(markup, />Simple</);
    assert.match(markup, />Detailed</);
    assert.doesNotMatch(markup, /Muscle label mode controls/);
    assert.match(markup, />Bones</);
    assert.doesNotMatch(markup, /Wrist/);
    assert.doesNotMatch(markup, />Palm</);
    assert.doesNotMatch(markup, />Back</);
});

test('offers facial bones with label controls and no wrist controls', () => {
    const markup = renderScanButton({ anatomyTarget: 'face', layer: 'skeleton' });
    assert.match(markup, /Anatomy view/);
    assert.match(markup, /Bone label mode controls/);
    assert.match(markup, />Bones</);
    assert.match(markup, />Muscles</);
    assert.doesNotMatch(markup, /Wrist label controls|Hand side controls|Facial muscle overlay controls/);
});

test('keeps the selected face target when restarting a stopped scan', () => {
    const markup = renderScanButton({ state: 'idle', anatomyTarget: 'face' });
    assert.match(markup, /Scan face/);
    assert.match(markup, /Start face tracking/);
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

test('shows one tracking status without diagnostics over the camera', () => {
    const markup = renderToStaticMarkup(React.createElement(HUD, {
        state: 'active',
        trackingInfo: { acceptedHands: 1, statusType: 'tracking', rawConfidence: 0.94 },
    }));
    assert.match(markup, /Tracking live/);
    assert.match(markup, /role="status"/);
    assert.doesNotMatch(markup, /tracking-panel|Raw confidence|Last valid|hud-timestamp/);
});

test('gives brief guidance when waiting, loading, or uncertain', () => {
    const render = (props) => renderToStaticMarkup(React.createElement(HUD, props));
    assert.match(render({ state: 'active' }), /Show your hand and forearm/);
    assert.match(render({ state: 'loading' }), /Loading tracker/);
    assert.match(render({ state: 'active', trackingInfo: { acceptedHands: 1, statusType: 'uncertain' } }), /Hold steady/);
    assert.equal(render({ state: 'idle' }), '');
});

test('labels inferred hand overlays as estimated even while another hand is live', () => {
    for (const acceptedHands of [0, 1]) {
        const markup = renderToStaticMarkup(React.createElement(HUD, {
            state: 'active', trackingInfo: { acceptedHands, predictedHands: 1 },
        }));
        assert.match(markup, /Estimated tracking/);
        assert.doesNotMatch(markup, /Tracking live|is-tracking/);
    }
});

test('identifies a retained finger close-up as estimated anatomy', () => {
    const markup = renderToStaticMarkup(React.createElement(HUD, {
        state: 'active', trackingInfo: { acceptedHands: 0, predictedHands: 1, trackedFingerNames: ['Index'] },
    }));
    assert.match(markup, /Index close-up · estimated/);
    assert.doesNotMatch(markup, /Tracking live|is-tracking/);
});

// The letters match the supplied reference image, not alphabetical bone names.
test('provides the full reference key and a letter-only wrist setting', () => {
    const markup = renderToStaticMarkup(React.createElement(WristLegend));
    assert.match(markup, /<details open/);
    for (const [letter, name] of Object.entries({ A: 'Scaphoid', B: 'Lunate', C: 'Triquetrum', D: 'Pisiform', E: 'Trapezium', F: 'Trapezoid', G: 'Capitate', H: 'Hamate' })) {
        assert.ok(markup.includes(`<dt>${letter}</dt><dd>${name}</dd>`));
    }
    const settings = renderScanButton({ wristMode: 'detailed' });
    assert.match(settings, />A–H</);
    assert.match(settings, />A–H \+ names</);
});

test('distinguishes a measured forearm from an estimated one and explains cropping', () => {
    const render = trackingInfo => renderToStaticMarkup(React.createElement(HUD, {
        state:'active', trackingInfo:{acceptedHands:1,...trackingInfo},
    }));
    const estimated=render({estimatedForearms:1,trackedForearms:1});
    assert.match(estimated,/Elbow briefly held · keep arm in view/);
    assert.doesNotMatch(estimated,/Tracking live|is-tracking/);
    assert.match(render({trackedForearms:1}),/Hand \+ forearm tracked/);
    assert.match(render({missingForearms:1}),/Show your elbow to align the forearm/);
    assert.match(render({trackedForearms:1,croppedForearms:1}),/Move back to include your elbow/);
});

test('labels approximate, image-followed and pinned elbows distinctly',()=>{
    const render=trackingInfo=>renderToStaticMarkup(React.createElement(HUD,{
        state:'active',trackingInfo:{acceptedHands:1,...trackingInfo},
    }));
    const preview=render({approximateForearms:1});
    assert.match(preview,/Forearm preview · tap Align elbow/);
    assert.doesNotMatch(preview,/is-tracking/);
    const pinned=render({pinnedForearms:1});
    assert.match(pinned,/Elbow pinned · Align elbow to adjust/);
    assert.doesNotMatch(pinned,/is-tracking/);
    assert.match(render({manualForearms:1}),/Following your selected elbow/);
});

test('elbow placement offers a camera-tap instruction, cancel, and return to automatic placement',()=>{
    const render=props=>renderToStaticMarkup(React.createElement(ForearmControls,props));
    assert.match(render({}),/>Align elbow</);
    assert.doesNotMatch(render({}),/>Auto elbow</);
    assert.match(render({hasManual:true}),/>Auto elbow</);
    const aligning=render({aligning:true});
    assert.match(aligning,/Tap your elbow in the camera picture/);
    assert.match(aligning,/>Cancel</);
});

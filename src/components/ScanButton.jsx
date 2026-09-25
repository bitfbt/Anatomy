import { useRef } from 'react';
import CameraSwitch from './CameraSwitch';

const LABEL_MODES = [
    { id: 'off', label: 'Off' },
    { id: 'clean', label: 'Clean' },
    { id: 'detailed', label: 'Detailed' },
];
const WRIST_MODES = [
    { id: 'off', label: 'Off' },
    { id: 'simple', label: 'A–H' },
    { id: 'detailed', label: 'A–H + names' },
];
const FACE_OVERLAY_MODES = [{ id: 'off', label: 'Off' }, { id: 'clean', label: 'Simple' }, { id: 'detailed', label: 'Detailed' }];
const VIEW_MODES = [
    { id: 'skeleton', label: 'Bones' },
    { id: 'muscles', label: 'Muscles' },
];
const SIDE_MODES = [{ id: 'palm', label: 'Palm' }, { id: 'back', label: 'Back' }];

function Segments({ modes, value, onChange, label }) {
    return (
        <div className="segmented-control" role="group" aria-label={label}>
            {modes.map(mode => (
                <button key={mode.id} className={`segment-btn ${value === mode.id ? 'active' : ''}`}
                    onClick={() => onChange(mode.id)} aria-pressed={value === mode.id}>
                    {mode.label}
                </button>
            ))}
        </div>
    );
}

export default function ScanButton({
    state, anatomyTarget = 'hand', onScan, onRescan, onAnalyze,
    labelMode, onLabelModeChange, wristMode, onWristModeChange,
    layer, onLayerChange, muscleLabelMode, onMuscleLabelModeChange,
    muscleSide, onMuscleSideChange,
    cameraFacing, onCameraSwitch, cameraSwitching=false,
}) {
    const settingsRef = useRef(null);
    const privacyRef = useRef(null);
    const guideRef = useRef(null);
    const isFace = anatomyTarget === 'face';
    const openPrivacy = () => {
      settingsRef.current?.close();
      privacyRef.current?.showModal();
    };
    const openGuide = () => {
      settingsRef.current?.close();
      guideRef.current?.showModal();
    };
    const privacyDialog = (
        <dialog ref={privacyRef} id="privacy-notice" className="privacy-dialog" aria-labelledby="privacy-title">
            <header className="privacy-heading">
                <h2 id="privacy-title">Privacy and data use</h2>
                <button type="button" className="settings-done" onClick={() => privacyRef.current?.close()} autoFocus>Done</button>
            </header>
            <iframe title="AnatomyLens privacy notice" src={`${import.meta.env.BASE_URL}privacy.html`} />
        </dialog>
    );
    const guideDialog = (
        <dialog ref={guideRef} id="how-to-use" className="privacy-dialog" aria-labelledby="guide-title">
            <header className="privacy-heading">
                <h2 id="guide-title">How to use AnatomyLens</h2>
                <button type="button" className="settings-done" onClick={() => guideRef.current?.close()} autoFocus>Done</button>
            </header>
            <iframe title="AnatomyLens user guide" src={`${import.meta.env.BASE_URL}guide.html`} />
        </dialog>
    );

    if (state === 'loading') return null;
    if (state !== 'active') {
        return (<>
            <button className="scan-start" onClick={onScan} id="scan-button"
                aria-label={`Scan = Start ${anatomyTarget} tracking`}>
                Scan {anatomyTarget}
            </button>
            <div className="info-links-idle">
                <button type="button" className="privacy-link-idle" onClick={openPrivacy} aria-haspopup="dialog" aria-controls="privacy-notice">Privacy and data use</button>
                <button type="button" className="privacy-link-idle" onClick={openGuide} aria-haspopup="dialog" aria-controls="how-to-use">How to use AnatomyLens</button>
            </div>
            <CameraSwitch facingMode={cameraFacing} onSwitch={onCameraSwitch} disabled={cameraSwitching} idle />
            {privacyDialog}
            {guideDialog}
        </>);
    }

    return (
        <>
            <div className="control-dock" role="group" aria-label="Anatomy controls">
                <Segments modes={VIEW_MODES} value={layer} onChange={onLayerChange} label="Anatomy view" />
                <CameraSwitch facingMode={cameraFacing} onSwitch={onCameraSwitch} disabled={cameraSwitching} />
                <button className="dock-btn settings-toggle" aria-label="Settings" title="Settings"
                    aria-haspopup="dialog" aria-controls="scan-settings"
                    onClick={() => settingsRef.current?.showModal()}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M4 7h7m4 0h5M4 17h3m4 0h9" />
                        <circle cx="13" cy="7" r="2" /><circle cx="9" cy="17" r="2" />
                    </svg>
                </button>
                <button className="dock-btn stop" onClick={onRescan} id="rescan-button" aria-label="Stop tracking">Stop</button>
            </div>

            <dialog ref={settingsRef} id="scan-settings" className="scan-settings" aria-labelledby="settings-title"
                onClick={event => { if (event.target === event.currentTarget) settingsRef.current?.close(); }}>
                <div className="settings-content">
                    <header className="settings-heading">
                        <div><h2 id="settings-title">Scan settings</h2><p>Hand + forearm</p></div>
                        <button className="settings-done" onClick={() => settingsRef.current?.close()} autoFocus>Done</button>
                    </header>
                    <div className="settings-field">
                        <h3>{isFace && layer === 'muscles' ? 'Overlay' : 'Labels'}</h3>
                        <Segments modes={isFace && layer === 'muscles' ? FACE_OVERLAY_MODES : LABEL_MODES}
                            value={layer === 'skeleton' ? labelMode : muscleLabelMode}
                            onChange={layer === 'skeleton' ? onLabelModeChange : onMuscleLabelModeChange}
                            label={layer === 'skeleton' ? 'Bone label mode controls' : isFace ? 'Facial muscle overlay controls' : 'Muscle label mode controls'} />
                    </div>
                    {anatomyTarget === 'hand' && (
                        <div className="settings-field">
                            <h3>{layer === 'skeleton' ? 'Wrist labels' : 'Hand side'}</h3>
                            <Segments modes={layer === 'skeleton' ? WRIST_MODES : SIDE_MODES}
                                value={layer === 'skeleton' ? wristMode : muscleSide}
                                onChange={layer === 'skeleton' ? onWristModeChange : onMuscleSideChange}
                                label={layer === 'skeleton' ? 'Wrist label controls' : 'Hand side controls'} />
                        </div>
                    )}
                    <div className="settings-notes">
                        <p>Full body · Coming soon</p><p>Face · Coming soon</p>
                        <p className="settings-disclaimer">Educational anatomy illustration. Not medical imaging.</p>
                        <p>Camera frames and landmarks are processed on this device and are not uploaded by AnatomyLens. Short tracking history is cleared when scanning stops or the camera changes.</p>
                        <p><button type="button" className="privacy-link-settings" onClick={openPrivacy} aria-haspopup="dialog" aria-controls="privacy-notice">Privacy and data use</button></p>
                        <p><button type="button" className="privacy-link-settings" onClick={openGuide} aria-haspopup="dialog" aria-controls="how-to-use">How to use AnatomyLens</button></p>
                        {layer === 'muscles' && muscleSide === 'back' && <p>Estimated dorsal overlay; tendons and muscle positions are approximate.</p>}
                    </div>
                    <button className="settings-retry" id="analyze-button" onClick={() => { onAnalyze(); settingsRef.current?.close(); }}>Resume tracking</button>
                </div>
            </dialog>
            {privacyDialog}
            {guideDialog}
        </>
    );
}

const LABEL_MODES = [
    { id: 'off', label: 'Off' },
    { id: 'clean', label: 'Clean' },
    { id: 'detailed', label: 'Detailed' },
];

const WRIST_MODES = [
    { id: 'off', label: 'Off' },
    { id: 'simple', label: 'Simple' },
    { id: 'detailed', label: 'Detailed' },
];

const VIEW_MODES = [
    { id: 'skeleton', label: 'Bones' },
    { id: 'muscles', label: 'Muscles' },
];

const MUSCLE_LABEL_MODES = [
    { id: 'off', label: 'Off' },
    { id: 'clean', label: 'Clean' },
    { id: 'detailed', label: 'Detailed' },
];

const FACE_MUSCLE_MODES = [
    { id: 'off', label: 'Off' },
    { id: 'clean', label: 'Simple' },
    { id: 'detailed', label: 'Detailed' },
];

const MUSCLE_SIDE_MODES = [
    { id: 'palm', label: 'Palm' },
    { id: 'back', label: 'Back' },
];

const ANATOMY_TARGETS = [
    { id: 'hand', label: 'Hand' },
    { id: 'face', label: 'Face' },
];

export default function ScanButton({
    state,
    anatomyTarget = 'hand',
    onAnatomyTargetChange,
    onScan,
    onRescan,
    onAnalyze,
    labelMode,
    onLabelModeChange,
    wristMode,
    onWristModeChange,
    layer,
    onLayerChange,
    muscleLabelMode,
    onMuscleLabelModeChange,
    muscleSide,
    onMuscleSideChange,
}) {
    const availableViewModes = anatomyTarget === 'face'
        ? VIEW_MODES.filter(mode => mode.id === 'muscles')
        : VIEW_MODES;
    const availableMuscleModes = anatomyTarget === 'face' ? FACE_MUSCLE_MODES : MUSCLE_LABEL_MODES;

    if (state === 'loading') {
        return null;
    }

    if (state === 'active') {
        return (
            <div className="control-dock">
                <div className="control-group action-group" aria-label="Tracking controls">
                    <button
                        className="dock-btn primary"
                        onClick={onAnalyze}
                        id="analyze-button"
                        title={`Analyze = Start ${anatomyTarget} anatomy tracking`}
                        aria-label={`Analyze = Start ${anatomyTarget} anatomy tracking`}
                    >
                        Analyze
                    </button>
                    <button
                        className="dock-btn stop"
                        onClick={onRescan}
                        id="rescan-button"
                        title="Stop = Stop tracking"
                        aria-label="Stop = Stop tracking"
                    >
                        Stop
                    </button>
                </div>

                <div className="control-group target-group" aria-label="Anatomy target controls">
                    <span className="dock-label">Target</span>
                    <div className="segmented-control">
                        {ANATOMY_TARGETS.map(target => (
                            <button
                                key={target.id}
                                className={`segment-btn ${anatomyTarget === target.id ? 'active' : ''}`}
                                onClick={() => onAnatomyTargetChange(target.id)}
                                aria-pressed={anatomyTarget === target.id}
                            >
                                {target.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="control-group view-group" aria-label={`${anatomyTarget} anatomy view controls`}>
                    <span className="dock-label">View</span>
                    <div className="segmented-control">
                        {availableViewModes.map(mode => (
                            <button
                                key={mode.id}
                                className={`segment-btn ${layer === mode.id ? 'active' : ''}`}
                                onClick={() => onLayerChange(mode.id)}
                                aria-pressed={layer === mode.id}
                                title={anatomyTarget === 'face' ? 'Enable facial muscle view' : undefined}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                </div>

                {anatomyTarget === 'hand' && layer === 'skeleton' ? (
                    <>
                        <div className="control-group labels-group" aria-label="Bone label mode controls">
                            <span className="dock-label">Labels</span>
                            <div className="segmented-control">
                                {LABEL_MODES.map(mode => (
                                    <button
                                        key={mode.id}
                                        className={`segment-btn ${labelMode === mode.id ? 'active' : ''}`}
                                        onClick={() => onLabelModeChange(mode.id)}
                                        aria-pressed={labelMode === mode.id}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="control-group wrist-group" aria-label="Wrist label controls">
                            <span className="dock-label">Wrist</span>
                            <div className="segmented-control">
                                {WRIST_MODES.map(mode => (
                                    <button
                                        key={mode.id}
                                        className={`segment-btn ${wristMode === mode.id ? 'active' : ''}`}
                                        onClick={() => onWristModeChange(mode.id)}
                                        aria-pressed={wristMode === mode.id}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div
                            className="control-group labels-group"
                            aria-label={anatomyTarget === 'face' ? 'Facial muscle overlay controls' : 'Muscle label mode controls'}
                        >
                            <span className="dock-label">{anatomyTarget === 'face' ? 'Overlay' : 'Labels'}</span>
                            <div className="segmented-control">
                                {availableMuscleModes.map(mode => (
                                    <button
                                        key={mode.id}
                                        className={`segment-btn ${muscleLabelMode === mode.id ? 'active' : ''}`}
                                        onClick={() => onMuscleLabelModeChange(mode.id)}
                                        aria-pressed={muscleLabelMode === mode.id}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {anatomyTarget === 'hand' && (
                            <div className="control-group side-group" aria-label="Hand side controls">
                                <span className="dock-label">Side</span>
                                <div className="segmented-control">
                                    {MUSCLE_SIDE_MODES.map(mode => (
                                        <button
                                            key={mode.id}
                                            className={`segment-btn ${muscleSide === mode.id ? 'active' : ''}`}
                                            onClick={() => onMuscleSideChange(mode.id)}
                                            aria-pressed={muscleSide === mode.id}
                                        >
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

            </div>
        );
    }

    return (
        <button
            className="scan-btn pulse"
            onClick={onScan}
            id="scan-button"
            title="Scan = Start camera tracking"
            aria-label="Scan = Start camera tracking"
        >
            SCAN
        </button>
    );
}

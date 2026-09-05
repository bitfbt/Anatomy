import { ANATOMY_MODES } from '../services/handModel';
import { TERMINOLOGY_MODES } from '../services/handAnatomyData';

const MODES = [
    [ANATOMY_MODES.SIMPLE, 'Simple'],
    [ANATOMY_MODES.GROUPED, 'Grouped'],
    [ANATOMY_MODES.DETAILED, 'Full'],
    [ANATOMY_MODES.QUIZ, 'Quiz'],
    [ANATOMY_MODES.DEBUG, 'Debug'],
];

const MODE_HELP = {
    [ANATOMY_MODES.SIMPLE]: 'Simple = Broad anatomy groups',
    [ANATOMY_MODES.GROUPED]: 'Grouped = Finger/wrist groups',
    [ANATOMY_MODES.DETAILED]: 'Full = Individual bone names',
    [ANATOMY_MODES.QUIZ]: 'Quiz = Identification practice',
    [ANATOMY_MODES.DEBUG]: 'Debug = Detection diagnostics',
};

export default function AnatomyModeControls({ activeMode, onModeChange, terminologyMode, onTerminologyChange, visible }) {
    if (!visible) return null;

    return (
        <div className="anatomy-mode-toggle">
            <div className="mode-row">
                {MODES.map(([mode, label]) => (
                    <button
                        key={mode}
                        className={`mode-btn ${activeMode === mode ? 'active' : ''}`}
                        onClick={() => onModeChange(mode)}
                        title={MODE_HELP[mode]}
                        aria-label={MODE_HELP[mode]}
                        aria-pressed={activeMode === mode}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="mode-row terminology-row">
                <button
                    className={`mode-btn term-btn ${terminologyMode === TERMINOLOGY_MODES.BASIC ? 'active' : ''}`}
                    onClick={() => onTerminologyChange(TERMINOLOGY_MODES.BASIC)}
                    title="Basic Names = simpler labels"
                    aria-label="Basic Names = simpler labels"
                    aria-pressed={terminologyMode === TERMINOLOGY_MODES.BASIC}
                >
                    Basic Names
                </button>
                <button
                    className={`mode-btn term-btn ${terminologyMode === TERMINOLOGY_MODES.ADVANCED ? 'active' : ''}`}
                    onClick={() => onTerminologyChange(TERMINOLOGY_MODES.ADVANCED)}
                    title="Advanced Terms = anatomy vocabulary"
                    aria-label="Advanced Terms = anatomy vocabulary"
                    aria-pressed={terminologyMode === TERMINOLOGY_MODES.ADVANCED}
                >
                    Advanced Terms
                </button>
            </div>
        </div>
    );
}

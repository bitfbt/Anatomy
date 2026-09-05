export default function LayerToggle({ activeLayer, onLayerChange, disabled }) {
    return (
        <div className="layer-toggle">
            <button
                className={`layer-btn ${activeLayer === 'muscles' ? 'active muscles' : ''}`}
                onClick={() => onLayerChange('muscles')}
                disabled={disabled}
                id="layer-muscles"
                title="Muscles = soft-tissue educational overlay"
                aria-label="Muscles = soft-tissue educational overlay"
                aria-pressed={activeLayer === 'muscles'}
            >
                <span className="layer-icon">💪</span>
                <span>MUSCLES</span>
            </button>
            <button
                className={`layer-btn ${activeLayer === 'skeleton' ? 'active skeleton' : ''}`}
                onClick={() => onLayerChange('skeleton')}
                disabled={disabled}
                id="layer-skeleton"
                title="Skeleton = landmark-based bone overlay"
                aria-label="Skeleton = landmark-based bone overlay"
                aria-pressed={activeLayer === 'skeleton'}
            >
                <span className="layer-icon">🦴</span>
                <span>SKELETON</span>
            </button>
        </div>
    );
}

export default function LayerToggle({ activeLayer, onLayerChange, disabled }) {
    return (
        <div className="layer-toggle">
            <button
                className={`layer-btn ${activeLayer === 'muscles' ? 'active muscles' : ''}`}
                onClick={() => onLayerChange('muscles')}
                disabled={disabled}
                id="layer-muscles"
            >
                <span className="layer-icon">💪</span>
                <span>MUSCLES</span>
            </button>
            <button
                className={`layer-btn ${activeLayer === 'skeleton' ? 'active skeleton' : ''}`}
                onClick={() => onLayerChange('skeleton')}
                disabled={disabled}
                id="layer-skeleton"
            >
                <span className="layer-icon">🦴</span>
                <span>SKELETON</span>
            </button>
        </div>
    );
}

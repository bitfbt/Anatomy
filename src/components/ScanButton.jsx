export default function ScanButton({ state, onScan, onRescan, onAnalyze, isAnalyzing }) {
    if (state === 'loading') {
        return null;
    }

    if (state === 'active') {
        return (
            <div className="scan-btn-group">
                <button
                    className={`scan-btn analyze ${isAnalyzing ? 'analyzing' : ''}`}
                    onClick={onAnalyze}
                    disabled={isAnalyzing}
                    id="analyze-button"
                >
                    {isAnalyzing ? '...' : 'ANALYZE'}
                </button>
                <button
                    className="scan-btn rescan"
                    onClick={onRescan}
                    id="rescan-button"
                >
                    STOP
                </button>
            </div>
        );
    }

    return (
        <button
            className="scan-btn pulse"
            onClick={onScan}
            id="scan-button"
        >
            SCAN
        </button>
    );
}

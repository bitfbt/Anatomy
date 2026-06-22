import { useEffect, useState } from 'react';

export default function HUD({ state, layer, detectedParts, isAnalyzing, analysisData, analysisError }) {
    const [time, setTime] = useState('');

    useEffect(() => {
        const update = () => {
            const now = new Date();
            setTime(
                now.toLocaleTimeString('en-US', { hour12: false }) +
                '.' +
                String(now.getMilliseconds()).padStart(3, '0')
            );
        };
        update();
        const interval = setInterval(update, 100);
        return () => clearInterval(interval);
    }, []);

    const layerLabel = layer === 'skeleton' ? '🦴 SKELETON' : '💪 MUSCLES';

    return (
        <>
            {state === 'loading' && (
                <div className="analyzing-overlay">
                    <div className="spinner" />
                    <div className="analyzing-text">Loading Tracker</div>
                    <div style={{ fontSize: '9px', opacity: 0.4, letterSpacing: '1px' }}>
                        Downloading hand landmark model...
                    </div>
                </div>
            )}

            {isAnalyzing && (
                <div className="analyzing-overlay" style={{ background: '#00000044' }}>
                    <div className="spinner" />
                    <div className="analyzing-text">Analyzing Anatomy</div>
                    <div style={{ fontSize: '9px', opacity: 0.4, letterSpacing: '1px' }}>
                        Identifying structures...
                    </div>
                </div>
            )}

            {state === 'active' && (
                <>
                    <div className="object-badge">
                        {analysisData
                            ? <span>◆ {analysisData.object.toUpperCase()} — {layerLabel}</span>
                            : <span>◆ {layerLabel} VIEW</span>
                        }
                    </div>

                    <div className="layer-indicator">
                        {analysisError
                            ? <span style={{ color: 'var(--red)' }}>{analysisError}</span>
                            : analysisData
                                ? `${analysisData.parts.length} structures identified`
                                : detectedParts.length > 0
                                    ? `Tracking: ${detectedParts.join(', ')}`
                                    : 'Position yourself in view...'}
                    </div>
                </>
            )}

            <div className="hud-timestamp">SYS:{time}</div>
            <div className="hud-coords">AR-SCAN v2.0</div>
        </>
    );
}

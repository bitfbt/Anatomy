import { useEffect, useState } from 'react';

export default function HUD({
    state,
    anatomyTarget = 'hand',
    layer,
    trackingInfo,
    labelMode = 'off',
    wristMode = 'simple',
    muscleLabelMode = 'clean',
    muscleSide = 'palm',
    isMirroredCamera = false,
}) {
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

    const isFace = anatomyTarget === 'face';
    const acceptedCount = trackingInfo?.acceptedTargets ?? trackingInfo?.acceptedHands ?? 0;
    const layerLabel = isFace ? 'FACIAL MUSCLES' : layer === 'skeleton' ? 'SKELETON' : 'MUSCLES';
    const trackingStatus = trackingInfo?.status || `Waiting for ${anatomyTarget}`;
    const rawConfidencePercent = Math.round((trackingInfo?.rawConfidence ?? 0) * 100);
    const acceptedConfidencePercent = Math.round((trackingInfo?.acceptedConfidence ?? trackingInfo?.confidence ?? 0) * 100);
    const lastValidConfidencePercent = Math.round((trackingInfo?.lastValidConfidence ?? 0) * 100);
    const detectedTarget = acceptedCount > 0
        ? isFace ? 'Face' : trackingInfo.handedness
        : trackingInfo?.handednessUncertain
            ? 'Uncertain'
            : 'None';
    const labelModeText = labelMode ? labelMode.charAt(0).toUpperCase() + labelMode.slice(1) : 'Off';
    const wristModeText = wristMode ? wristMode.charAt(0).toUpperCase() + wristMode.slice(1) : 'Off';
    const muscleLabelModeText = muscleLabelMode ? muscleLabelMode.charAt(0).toUpperCase() + muscleLabelMode.slice(1) : 'Off';
    const faceOverlayModeText = muscleLabelMode === 'clean'
        ? 'Simple'
        : muscleLabelMode === 'detailed' ? 'Detailed' : 'Off';
    const muscleSideText = muscleSide === 'back' ? 'Back side' : 'Palm side';
    const overlayName = isFace ? 'Face overlay' : layer === 'muscles' ? 'Muscle overlay' : 'Skeleton';
    const trackingClass = trackingInfo?.statusType
        ? trackingInfo.statusType
        : acceptedCount > 0
            ? trackingInfo.handednessUncertain
            ? 'uncertain'
            : 'confident'
            : trackingInfo?.status === `No ${anatomyTarget} detected`
                ? 'lost'
                : 'waiting';

    return (
        <>
            {state === 'loading' && (
                <div className="analyzing-overlay">
                    <div className="spinner" />
                    <div className="analyzing-text">Loading Tracker</div>
                    <div style={{ fontSize: '9px', opacity: 0.4, letterSpacing: '1px' }}>
                        Downloading {anatomyTarget} landmark model...
                    </div>
                </div>
            )}

            {state === 'active' && (
                <>
                    <div className="object-badge">
                        <span>◆ {layerLabel} VIEW</span>
                    </div>

                    {(layer === 'skeleton' || layer === 'muscles') && trackingInfo && (
                        <div className={`tracking-panel ${trackingClass}`}>
                            <div className="tracking-status">{trackingStatus}</div>
                            {isFace ? (
                                <>
                                    <div className="tracking-row">
                                        <span>Face detected</span>
                                        <strong>{acceptedCount > 0 ? 'Yes' : 'No'}</strong>
                                    </div>
                                    <div className="tracking-row">
                                        <span>Confidence</span>
                                        <strong>{acceptedCount > 0 ? `${acceptedConfidencePercent}%` : '--'}</strong>
                                    </div>
                                    <div className="tracking-row">
                                        <span>Overlay mode</span>
                                        <strong>{faceOverlayModeText}</strong>
                                    </div>
                                    <div className="tracking-row">
                                        <span>Overlay</span>
                                        <strong>{trackingInfo.skeletonStatus || 'Waiting'}</strong>
                                    </div>
                                    {!trackingInfo.acceptedLandmarks && trackingInfo.rejectionReason && (
                                        <div className="tracking-reason">Reason: {trackingInfo.rejectionReason}</div>
                                    )}
                                    {(trackingInfo.warnings || []).length > 0 && (
                                        <div className="tracking-warning">{trackingInfo.warnings.join(' / ')}</div>
                                    )}
                                    <div className="edu-disclaimer compact">
                                        Estimated facial muscle overlay from visible landmarks. Not medical imaging.
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="tracking-row">
                                        <span>Detected {anatomyTarget}</span>
                                        <strong>{detectedTarget}</strong>
                                    </div>
                                    <div className="tracking-row">
                                        <span>Raw confidence</span>
                                        <strong>{`${rawConfidencePercent}%`}</strong>
                                    </div>
                                    <div className="tracking-row">
                                        <span>Accepted landmarks</span>
                                        <strong>{trackingInfo.acceptedLandmarks ? 'Yes' : 'No'}</strong>
                                    </div>
                                    <div className="tracking-row">
                                        <span>{`${overlayName} confidence`}</span>
                                        <strong>{acceptedConfidencePercent}%</strong>
                                    </div>
                                    <div className="tracking-row">
                                        <span>{overlayName}</span>
                                        <strong>{trackingInfo.skeletonStatus || 'Waiting'}</strong>
                                    </div>
                                    <div className="tracking-row">
                                        <span>Last valid</span>
                                        <strong>{lastValidConfidencePercent}%</strong>
                                    </div>
                                    {!trackingInfo.acceptedLandmarks && trackingInfo.rejectionReason && (
                                        <div className="tracking-reason">Reason: {trackingInfo.rejectionReason}</div>
                                    )}
                                    {layer === 'skeleton' ? (
                                        <>
                                            <div className="tracking-row">
                                                <span>Label mode</span>
                                                <strong>{labelModeText}</strong>
                                            </div>
                                            <div className="tracking-row">
                                                <span>Wrist</span>
                                                <strong>{wristModeText}</strong>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="tracking-row">
                                                <span>Muscle labels</span>
                                                <strong>{muscleLabelModeText}</strong>
                                            </div>
                                            <div className="tracking-row">
                                                <span>Muscle side</span>
                                                <strong>{muscleSideText}</strong>
                                            </div>
                                            {muscleSide === 'back' && (
                                                <div className="tracking-note">Estimated dorsal overlay: extensor tendons and interossei are approximate.</div>
                                            )}
                                        </>
                                    )}
                                    {isMirroredCamera && (
                                        <div className="tracking-note">Mirrored camera view. Wrist sides follow visible thumb/pinky landmarks.</div>
                                    )}
                                    {(trackingInfo.warnings || []).length > 0 && (
                                        <div className="tracking-warning">{trackingInfo.warnings.join(' / ')}</div>
                                    )}
                                    <div className="edu-disclaimer compact">
                                        {layer === 'muscles'
                                            ? 'Estimated educational muscle overlay. Not medical imaging.'
                                            : 'Educational landmark overlay. Not X-ray or medical accuracy.'}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}

            <div className="hud-timestamp">SYS:{time}</div>
            <div className="hud-coords">AR-SCAN v2.0</div>
        </>
    );
}

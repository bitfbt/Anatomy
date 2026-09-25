export default function HUD({ state, anatomyTarget = 'hand', trackingInfo }) {
    if (state === 'idle') return null;

    const accepted = (trackingInfo?.acceptedTargets ?? trackingInfo?.acceptedHands ?? 0) > 0;
    const uncertain = trackingInfo?.statusType === 'uncertain';
    const estimated = (trackingInfo?.predictedHands ?? 0) > 0;
    const estimatedForearm = (trackingInfo?.estimatedForearms ?? 0) > 0;
    const trackedForearm = (trackingInfo?.trackedForearms ?? 0) > 0;
    const croppedForearm = (trackingInfo?.croppedForearms ?? 0) > 0;
    const missingForearm = (trackingInfo?.missingForearms ?? 0) > 0;
    const approximateForearm = (trackingInfo?.approximateForearms ?? 0) > 0;
    const manualForearm = (trackingInfo?.manualForearms ?? 0) > 0;
    const pinnedForearm = (trackingInfo?.pinnedForearms ?? 0) > 0;
    const fingers = trackingInfo?.trackedFingerNames ?? [];
    const message = state === 'loading'
        ? 'Loading tracker…'
        : fingers.length
            ? `${fingers.length === 1 ? fingers[0] : 'Finger'} close-up · estimated`
            : estimated
            ? 'Estimated tracking — move back slightly'
            : pinnedForearm
            ? 'Elbow pinned · Align elbow to adjust'
            : manualForearm
            ? 'Following your selected elbow'
            : approximateForearm
            ? 'Forearm preview · tap Align elbow'
            : estimatedForearm
            ? 'Elbow briefly held · keep arm in view'
            : missingForearm
            ? 'Show your elbow to align the forearm'
            : trackedForearm && croppedForearm
            ? 'Move back to include your elbow'
            : uncertain
            ? 'Hold steady to track'
            : trackedForearm
            ? 'Hand + forearm tracked'
            : accepted
                ? 'Tracking live'
                : `Show your ${anatomyTarget === 'hand' ? 'hand and forearm' : anatomyTarget}`;

    return (
        <div className={`scan-status ${accepted && !uncertain && !estimated && !estimatedForearm && !croppedForearm && !missingForearm && !approximateForearm && !pinnedForearm ? 'is-tracking' : ''}`} role="status">
            <span className={state === 'loading' ? 'status-dot is-loading' : 'status-dot'} aria-hidden="true" />
            <span>{message}</span>
        </div>
    );
}

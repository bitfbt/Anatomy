import { Capacitor } from '@capacitor/core';

export default function ErrorFallback({ type, message, onRetry }) {
    if (type === 'camera') {
        const platform = Capacitor.getPlatform();
        const isNative = Capacitor.isNativePlatform();
        const cameraCopy = isNative
            ? platform === 'ios'
                ? 'Allow camera access in iPhone Settings under Privacy & Security → Camera → AnatomyLens, then return and try again. If AnatomyLens is not listed, tap Retry and allow access when iPhone asks.'
                : 'Allow camera access for AnatomyLens in your device settings, then return and try again.'
            : 'Allow camera access for AnatomyLens in your browser’s site settings, then reload or retry.';

        return (
            <div className="error-container">
                <div className="error-icon">📷</div>
                <div className="error-title">Camera Permission Needed</div>
                <div className="error-msg">
                    {message || cameraCopy}
                </div>
                {onRetry && <button className="upload-btn" onClick={onRetry}>↻ Retry</button>}
            </div>
        );
    }

    if (type === 'tracker-error') {
        let displayMsg = message || 'The local hand tracker could not be loaded. Please try again.';
        if (displayMsg.length > 120) {
            displayMsg = displayMsg.slice(0, 120) + '…';
        }

        return (
            <div className="analyzing-overlay" style={{ background: '#000000cc' }}>
                <div className="error-icon" style={{ fontSize: '36px' }}>⚠</div>
                <div className="error-title" style={{ fontSize: '12px' }}>Tracker Unavailable</div>
                <div className="error-msg" style={{ maxWidth: '260px' }}>
                    {displayMsg}
                </div>
                <button className="upload-btn" onClick={onRetry} id="retry-button">
                    ↻ Retry
                </button>
            </div>
        );
    }

    return null;
}

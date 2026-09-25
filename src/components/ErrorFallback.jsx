export default function ErrorFallback({ type, message, onRetry }) {
    if (type === 'camera') {
        return (
            <div className="error-container">
                <div className="error-icon">📷</div>
                <div className="error-title">Camera Access Denied</div>
                <div className="error-msg">
                    {message || 'Unable to access your camera. Please grant camera permission in your browser settings, then retry.'}
                </div>
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

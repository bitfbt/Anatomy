export default function ErrorFallback({ type, message, onRetry, onUpload }) {
    if (type === 'camera') {
        const canUpload = typeof onUpload === 'function';
        return (
            <div className="error-container">
                <div className="error-icon">📷</div>
                <div className="error-title">Camera Access Denied</div>
                <div className="error-msg">
                    {message || (canUpload
                        ? 'Unable to access your camera. Please grant camera permission in your browser settings, or upload an image manually.'
                        : 'Unable to access your camera. Please grant camera permission in your browser settings, then retry.')}
                </div>
                {canUpload && (
                    <>
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={onUpload}
                            style={{ display: 'none' }}
                            id="file-upload"
                        />
                        <button
                            className="upload-btn"
                            onClick={() => document.getElementById('file-upload').click()}
                            id="upload-button"
                        >
                            ↑ Upload Image
                        </button>
                    </>
                )}
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

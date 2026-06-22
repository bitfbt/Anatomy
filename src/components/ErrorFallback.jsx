export default function ErrorFallback({ type, message, onRetry, onUpload }) {
    if (type === 'camera') {
        return (
            <div className="error-container">
                <div className="error-icon">📷</div>
                <div className="error-title">Camera Access Denied</div>
                <div className="error-msg">
                    {message || 'Unable to access your camera. Please grant camera permission in your browser settings, or upload an image manually.'}
                </div>
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
            </div>
        );
    }

    if (type === 'ai-error') {
        // Extract a clean, short error message
        let displayMsg = message || 'AI returned an invalid response. Please try again.';
        // Strip "API Error (500): " prefix if present
        displayMsg = displayMsg.replace(/^API Error \(\d+\):\s*/i, '');
        // Truncate to something readable
        if (displayMsg.length > 120) {
            displayMsg = displayMsg.slice(0, 120) + '…';
        }

        return (
            <div className="analyzing-overlay" style={{ background: '#000000cc' }}>
                <div className="error-icon" style={{ fontSize: '36px' }}>⚠</div>
                <div className="error-title" style={{ fontSize: '12px' }}>Analysis Failed</div>
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

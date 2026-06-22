import { useState, useEffect } from 'react';

export default function Settings({ isOpen, onClose }) {
    const [claudeKey, setClaudeKey] = useState('');

    useEffect(() => {
        setClaudeKey(localStorage.getItem('ar_scanner_api_key') || '');
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('ar_scanner_api_key', claudeKey);
        onClose();
    };

    return (
        <>
            {isOpen && <div className="settings-overlay" onClick={onClose} />}
            <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
                <button className="settings-close" onClick={onClose}>✕</button>
                <h2>⚙ Settings</h2>

                <div>
                    <label>Anthropic API Key</label>
                    <input
                        type="password"
                        value={claudeKey}
                        onChange={e => setClaudeKey(e.target.value)}
                        placeholder="sk-ant-..."
                        id="api-key-input"
                    />
                    <div style={{ fontSize: '8px', opacity: 0.4, marginTop: '4px' }}>
                        Used for body part identification and anatomical labeling
                    </div>
                </div>

                <div style={{ fontSize: '9px', opacity: 0.5, lineHeight: 1.6 }}>
                    Your key is stored locally and only sent to the proxy server for AI calls.
                    It is never shared with third parties.
                </div>

                <button className="upload-btn" onClick={handleSave} id="save-settings">
                    Save
                </button>
            </div>
        </>
    );
}

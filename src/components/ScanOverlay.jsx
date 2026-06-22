export default function ScanOverlay({ state }) {
    return (
        <>
            {/* Scanlines — always visible */}
            <div className="scanlines" />

            {/* Corner brackets */}
            <div className="corner-brackets" />
            <div className="corner-brackets-bottom" />

            {/* Sweep line — appears during scanning */}
            {state === 'loading' && <div className="sweep-line" />}
        </>
    );
}

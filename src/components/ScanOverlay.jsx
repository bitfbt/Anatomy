export default function ScanOverlay({ state }) {
    return state === 'loading' ? <div className="sweep-line" aria-hidden="true" /> : null;
}

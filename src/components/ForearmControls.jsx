export default function ForearmControls({aligning,hasManual,onAlign,onCancel,onAuto}) {
    return <div className="forearm-controls" aria-label="Forearm alignment">
        {aligning ? <><span role="status">Tap your elbow in the camera picture</span>
            <button onClick={onCancel}>Cancel</button></> : <>
            {hasManual && <button onClick={onAuto}>Auto elbow</button>}
            <button onClick={onAlign}>Align elbow</button>
        </>}
    </div>;
}

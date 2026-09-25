export default function CameraSwitch({facingMode='environment',onSwitch,disabled=false,idle=false}) {
    const front=facingMode==='user';
    return <button className={`dock-btn camera-switch${idle?' camera-switch-idle':''}`}
        onClick={onSwitch} disabled={disabled}
        aria-label={`Switch to ${front?'rear':'front'} camera`}
        title={`${front?'Front':'Rear'} camera · tap to switch`}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M8 5l1.5-2h5L16 5h4a1 1 0 0 1 1 1v13H3V6a1 1 0 0 1 1-1z" />
            <path d="M8 12a4 4 0 0 1 7-2m1 2a4 4 0 0 1-7 2M15 7v3h-3m-3 7v-3h3" />
        </svg>
        <span>{disabled?'…':front?'Front':'Rear'}</span>
    </button>;
}

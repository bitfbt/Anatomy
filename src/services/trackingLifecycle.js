// One scan owns its asynchronous initialization and at most one frame loop.
export function createTrackingLifecycle({
    requestFrame = callback => requestAnimationFrame(callback),
    cancelFrame = id => cancelAnimationFrame(id),
} = {}) {
    let generation = 0;
    let active = false;
    let loop = null;
    function stopLoop() {
        const previous = loop;
        loop = null;
        if (!previous) return;
        if (previous.frame !== null) cancelFrame(previous.frame);
        previous.dispose();
    }
    function cancelScan() {
        active = false;
        generation += 1;
        stopLoop();
    }
    return {
        beginScan() { cancelScan(); active = true; return generation; },
        cancelScan,
        stopLoop,
        isCurrentScan: token => active && token === generation,
        isActive: () => active,
        isRunning: () => loop !== null,
        startLoop(dispose) {
            stopLoop();
            if (!active) { dispose(); return null; }
            const owner = { frame: null, dispose };
            loop = owner;
            return {
                isCurrent: () => active && loop === owner,
                schedule(callback) {
                    if (!active || loop !== owner) return;
                    if (owner.frame !== null) cancelFrame(owner.frame);
                    owner.frame = requestFrame(() => {
                        owner.frame = null;
                        if (active && loop === owner) callback();
                    });
                },
            };
        },
    };
}

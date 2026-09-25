const ARM_JOINTS = [[13, 15], [14, 16]];
const finite = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const distance = (a, b, w, h) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
const inside = (p, w, h, b) => finite(p) && p.x*w >= b.left && p.x*w <= b.right && p.y*h >= b.top && p.y*h <= b.bottom;

function handGeometry(hand, w, h, bounds) {
    if (![w, h, bounds?.left, bounds?.top, bounds?.right, bounds?.bottom].every(Number.isFinite)
        || w <= 0 || h <= 0 || bounds.right <= bounds.left || bounds.bottom <= bounds.top) return null;
    if (hand?.length !== 21 || !hand.every(finite)) return null;
    if (!inside(hand[0], w, h, bounds)) return null;
    const span = distance(hand[5], hand[17], w, h);
    const axis = {x: (hand[9].x-hand[0].x)*w, y: (hand[9].y-hand[0].y)*h};
    const length = Math.hypot(axis.x, axis.y);
    if (span < 8 || length < 5) return null;
    return {wrist: hand[0], span, palmLength: length, axis: {x: axis.x/length, y: axis.y/length}};
}

function chooseWrist(geometry, pose, w, h) {
    const candidates = pose?.length === 33 ? ARM_JOINTS
        .filter(([, i]) => finite(pose[i]) && (pose[i].visibility ?? 0) >= .45)
        .map(([elbow, index]) => ({index, elbow: pose[elbow], distance: distance(pose[index], geometry.wrist, w, h)}))
        .sort((a,b) => a.distance-b.distance) : [];
    const ambiguous = candidates.length > 1 && candidates[1].distance-candidates[0].distance < geometry.span*.18;
    const mismatch = candidates.length > 0 && candidates[0].distance > Math.max(24, geometry.span*.90);
    return {candidate: candidates[0], ambiguous, mismatch};
}

function reliableElbow(candidate, geometry, w, h) {
    if (!finite(candidate?.elbow) || !((candidate.elbow.visibility ?? 0) >= .40)) return false;
    const length = distance(candidate.elbow, geometry.wrist, w, h);
    // Keep confident cropped elbows; reject implausible model extrapolation.
    return length >= geometry.span*.55 && length <= geometry.span*6.5 && length <= Math.hypot(w,h)*1.25;
}

export function matchForearm(hand, pose, w, h, bounds = {left:0,top:0,right:w,bottom:h}, used = new Set()) {
    const geometry = handGeometry(hand,w,h,bounds);
    if (!geometry) return null;
    const {candidate, ambiguous, mismatch} = chooseWrist(geometry,pose,w,h);
    if (ambiguous || mismatch || used.has(candidate?.index) || !reliableElbow(candidate,geometry,w,h)) return null;
    used.add(candidate.index);
    return {elbow:candidate.elbow, wrist:geometry.wrist, index:candidate.index, held:false};
}

export const FOREARM_CONTINUITY_MS = 650;

// A forearm must first have a measured elbow. Brief continuity can bridge a
// dropped pose while the wrist is still observed; it never invents an elbow
// from the direction of a bent hand or refreshes its own measurement time.
export class ForearmTracker {
    constructor() { this.tracks = new Map(); this.pending = new Map(); }
    reset() { this.tracks.clear(); this.pending.clear(); }
    resolve(hand, pose, w, h, bounds, used, now) {
        const match = this.update(hand, pose, w, h, bounds, used, now);
        return match ? {...match, estimated:match.held, source:match.held ? 'held-pose' : 'pose'} : null;
    }
    update(hand, pose, w, h, bounds, used = new Set(), now) {
        if (!Number.isFinite(now)) return null;
        for (const [id, previous] of this.tracks) {
            if (now < previous.time || now - previous.time > FOREARM_CONTINUITY_MS || previous.w !== w || previous.h !== h) {
                this.tracks.delete(id); this.pending.delete(id);
            }
        }
        const geometry = handGeometry(hand,w,h,bounds);
        if (!geometry) return null;
        const {candidate, ambiguous, mismatch} = chooseWrist(geometry,pose,w,h);
        if (ambiguous || mismatch) { this.reset(); return null; }
        if (used.has(candidate?.index)) return null;
        if (candidate && (candidate.elbow?.visibility ?? 0) >= .40 && !reliableElbow(candidate,geometry,w,h)) {
            this.tracks.delete(candidate.index); this.pending.delete(candidate.index); return null;
        }
        if (reliableElbow(candidate,geometry,w,h)) {
            const previous = this.tracks.get(candidate.index);
            // A one-frame elbow jump must not swing the arm away from the live
            // wrist. Confirm a large change on the next frame, without imposing
            // a speed limit on sustained real movement.
            if (previous && now - previous.time < 180) {
                const offset = {x:candidate.elbow.x-geometry.wrist.x, y:candidate.elbow.y-geometry.wrist.y};
                const oldOffset = {x:previous.elbow.x-previous.wrist.x, y:previous.elbow.y-previous.wrist.y};
                const jump = distance(offset,oldOffset,w,h);
                if (jump > geometry.span * .65) {
                    const pending = this.pending.get(candidate.index);
                    const confirmed = pending && now - pending.time < 180 && distance(offset,pending.offset,w,h) < geometry.span * .35;
                    if (!confirmed) {
                        this.pending.set(candidate.index,{offset,time:now});
                        return this.hold(candidate.index,geometry,w,h,used,now);
                    }
                }
            }
            this.pending.delete(candidate.index);
            this.tracks.set(candidate.index, {...geometry, wrist:{...geometry.wrist}, elbow:{...candidate.elbow}, time:now, w, h});
            used.add(candidate.index);
            return {elbow:candidate.elbow,wrist:geometry.wrist,index:candidate.index,held:false,ageMs:0};
        }
        let id = candidate?.index;
        if (id === undefined) {
            const nearby = [...this.tracks].filter(([index,p]) => !used.has(index)
                && distance(p.wrist,geometry.wrist,w,h) < geometry.span*.50);
            if (nearby.length !== 1) return null;
            id = nearby[0][0];
        }
        return this.hold(id,geometry,w,h,used,now);
    }
    hold(id, geometry, w, h, used, now) {
        const previous = this.tracks.get(id);
        if (!previous || used.has(id) || previous.w !== w || previous.h !== h) return null;
        const ageMs = now - previous.time;
        const alignment = previous.axis.x*geometry.axis.x + previous.axis.y*geometry.axis.y;
        const ratio = geometry.span/previous.span;
        if (ageMs < 0 || ageMs > FOREARM_CONTINUITY_MS || alignment < .65 || ratio < .8 || ratio > 1.25
            || distance(previous.wrist,geometry.wrist,w,h) > geometry.span*.5) {
            this.tracks.delete(id); this.pending.delete(id); return null;
        }
        used.add(id);
        return {index:id,wrist:geometry.wrist,held:true,ageMs,elbow:{
            ...previous.elbow,
            x:geometry.wrist.x + (previous.elbow.x-previous.wrist.x)*ratio,
            y:geometry.wrist.y + (previous.elbow.y-previous.wrist.y)*ratio,
        }};
    }
}

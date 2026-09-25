import { trackImagePoints } from './fingerMotion.js';
import { predictFinger, fingerDistanceToPoint } from './fingerPrediction.js';

export const FINGER_CONTINUITY_CONFIG = {
    historySize: 24,
    minHistory: 4,
    maxAgeMs: 8000,
    maxFrameGapMs: 600,
    maxEvidenceGapMs: 1200,
    predictionMs: 300,
    fadeStartMs: 600,
    imageSize: 320,
    maxFeatures: 12,
};

const FINGERS = [
    { name: 'Thumb', indices: [2, 3, 4] },
    { name: 'Index', indices: [5, 6, 7, 8] },
    { name: 'Middle', indices: [9, 10, 11, 12] },
    { name: 'Ring', indices: [13, 14, 15, 16] },
    { name: 'Pinky', indices: [17, 18, 19, 20] },
];
const finite = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pixel = (point, frame) => ({ x: point.x * frame.width, y: point.y * frame.height });
const normalized = (point, frame) => ({ x: point.x / frame.width, y: point.y / frame.height });
const inBounds = (point, bounds, margin = 0) => point.x >= bounds.left + margin && point.x <= bounds.right - margin
    && point.y >= bounds.top + margin && point.y <= bounds.bottom - margin;

// Small transient grayscale snapshots support image motion; no camera photos
// are persisted. Landmark history is kept separately for finger identity.
export class FingerFrameSampler {
    constructor() { this.canvas = null; }

    reset() {
        if (this.canvas) {
            this.canvas.width = 0;
            this.canvas.height = 0;
            this.canvas = null;
        }
    }

    capture(video) {
        const sourceWidth = video?.videoWidth ?? video?.width;
        const sourceHeight = video?.videoHeight ?? video?.height;
        if (!sourceWidth || !sourceHeight || ('readyState' in video && video.readyState < 2)) return null;
        try {
            this.canvas ??= document.createElement('canvas');
            const scale = Math.min(1, FINGER_CONTINUITY_CONFIG.imageSize / Math.max(sourceWidth, sourceHeight));
            const width = Math.round(sourceWidth * scale), height = Math.round(sourceHeight * scale);
            if (this.canvas.width !== width || this.canvas.height !== height) {
                this.canvas.width = width;
                this.canvas.height = height;
            }
            const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(video, 0, 0, width, height);
            const rgba = ctx.getImageData(0, 0, width, height).data;
            const data = new Uint8Array(width * height);
            for (let i = 0; i < data.length; i += 1) data[i] = (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) >> 8;
            // Camera scaling introduces subpixel shimmer. A centered 3x3
            // binomial filter keeps tiny zoom changes from invalidating skin
            // patches simply because their sampling phase changed.
            const filtered=data.slice();
            for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
                const i=y*width+x;
                filtered[i]=(data[i-width-1]+2*data[i-width]+data[i-width+1]
                    +2*data[i-1]+4*data[i]+2*data[i+1]
                    +data[i+width-1]+2*data[i+width]+data[i+width+1])/16;
            }
            return { width, height, data:filtered };
        } catch {
            return null;
        }
    }
}

function texture(frame, point) {
    const x = Math.round(point.x), y = Math.round(point.y);
    if (x < 6 || y < 6 || x >= frame.width - 6 || y >= frame.height - 6) return 0;
    let xx = 0, xy = 0, yy = 0;
    for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
            const index = (y + dy) * frame.width + x + dx;
            const gx = frame.data[index + 1] - frame.data[index - 1];
            const gy = frame.data[index + frame.width] - frame.data[index - frame.width];
            xx += gx * gx; xy += gx * gy; yy += gy * gy;
        }
    }
    return (xx + yy - Math.hypot(xx - yy, 2 * xy)) / 50;
}

function selectFeatures(points, width, frame, bounds) {
    const candidates = [];
    for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index], b = points[index + 1];
        const length = distance(a, b);
        if (length < 2) continue;
        const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
        for (const t of [0.15, 0.4, 0.65, 0.9]) {
            // Samples stay near the digit centerline, away from background edges.
            for (const offset of [-0.18, 0, 0.18]) {
                const point = { x: a.x + (b.x - a.x) * t + nx * width * offset, y: a.y + (b.y - a.y) * t + ny * width * offset };
                if (!inBounds(point, bounds, 5)) continue;
                const score = texture(frame, point);
                if (score >= 16) candidates.push({ point, score });
            }
        }
    }
    candidates.sort((a, b) => b.score - a.score);
    const features = [];
    for (const { point } of candidates) {
        if (features.every(other => distance(point, other) >= 4)) features.push(point);
        if (features.length === FINGER_CONTINUITY_CONFIG.maxFeatures) break;
    }
    return features;
}

function fit(pairs, {minScale=.85,maxScale=1.18,maxAngle=.20}={}) {
    const center = key => ({ x: pairs.reduce((sum, pair) => sum + pair[key].x, 0) / pairs.length,
        y: pairs.reduce((sum, pair) => sum + pair[key].y, 0) / pairs.length });
    const from = center('from'), to = center('to');
    let dot = 0, cross = 0, norm = 0;
    for (const pair of pairs) {
        const x = pair.from.x - from.x, y = pair.from.y - from.y;
        const u = pair.to.x - to.x, v = pair.to.y - to.y;
        dot += x * u + y * v; cross += x * v - y * u; norm += x * x + y * y;
    }
    if (norm < 20) return null;
    const a = dot / norm, b = cross / norm;
    const scale = Math.hypot(a, b);
    if (scale < minScale || scale > maxScale || Math.abs(Math.atan2(b, a)) > maxAngle) return null;
    return { scale, apply: point => ({ x: to.x + a * (point.x - from.x) - b * (point.y - from.y),
        y: to.y + b * (point.x - from.x) + a * (point.y - from.y) }) };
}

function robustMotion(pairs, limits) {
    if (pairs.length < 4) return null;
    let best = [];
    for (let first = 0; first < pairs.length; first += 1) {
        for (let second = first + 1; second < pairs.length; second += 1) {
            if (distance(pairs[first].from, pairs[second].from) < 8) continue;
            const model = fit([pairs[first], pairs[second]], limits);
            if (!model) continue;
            const inliers = pairs.filter(pair => distance(model.apply(pair.from), pair.to) <= 1.8);
            if (inliers.length > best.length) best = inliers;
        }
    }
    if (best.length < 4 || best.length < pairs.length * 0.7) return null;
    const model = fit(best, limits);
    return model ? { ...model, inliers: best } : null;
}

function intersectsView(points,bounds) {
    for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
        let enter=0,leave=1,visible=true;
        for(const [direction,limit] of [[-dx,a.x-bounds.left],[dx,bounds.right-a.x],[-dy,a.y-bounds.top],[dy,bounds.bottom-a.y]]){
            if(direction===0){if(limit<0)visible=false;continue;}
            const t=limit/direction;
            if(direction<0)enter=Math.max(enter,t);else leave=Math.min(leave,t);
        }
        if(visible&&enter<=leave)return true;
    }
    return false;
}

function closeUpHand(landmarks,bounds) {
    const xs=landmarks.map(p=>p.x),ys=landmarks.map(p=>p.y);
    return Math.max(...xs)-Math.min(...xs) >= (bounds.right-bounds.left)*.8
        || Math.max(...ys)-Math.min(...ys) >= (bounds.bottom-bounds.top)*.8;
}

export class FingerContinuityTracker {
    constructor({ trackPoints = trackImagePoints } = {}) {
        this.trackPoints = trackPoints;
        this.histories = new Map();
        this.fingers = new Map();
        this.previousTime = null;
        this.viewport = null;
    }

    reset() {
        this.histories.clear();
        this.fingers.clear();
        this.previousTime = null;
        this.viewport = null;
    }

    update(measurements, frame, now, bounds = { left: 0, top: 0, right: 1, bottom: 1 }) {
        if (!frame || !Number.isFinite(now) || !Number.isInteger(frame.width) || !Number.isInteger(frame.height)
            || frame.width<9 || frame.height<9 || !(frame.data instanceof Uint8Array)
            || frame.data.length<frame.width*frame.height) { this.reset(); return []; }
        const viewport = [frame.width, frame.height, bounds.left, bounds.top, bounds.right, bounds.bottom].join(':');
        if (this.viewport !== viewport || (this.previousTime !== null
            && (now <= this.previousTime || now - this.previousTime > FINGER_CONTINUITY_CONFIG.maxFrameGapMs))) this.reset();
        this.viewport = viewport;
        const pixelBounds = { left: bounds.left * frame.width, top: bounds.top * frame.height,
            right: bounds.right * frame.width, bottom: bounds.bottom * frame.height };
        const currentIds = new Set(measurements.filter(measurement => measurement.trackId
            && measurement.landmarks?.length === 21 && measurement.landmarks.every(finite)).map(measurement => measurement.trackId));
        const live = new Set();
        const predictions = [];
        for (const measurement of measurements) {
            if (!measurement.trackId || measurement.landmarks?.length !== 21 || !measurement.landmarks.every(finite)) continue;
            live.add(measurement.trackId);
            // Recognition supersedes cached identity, including left/right flips.
            for (const [id, history] of this.histories) {
                const previous = history.at(-1);
                if (!currentIds.has(id) && (previous.handedness === measurement.handedness
                    || distance(previous.landmarks[9], measurement.landmarks[9]) < 0.12)) {
                    this.histories.delete(id);
                    for (const [key, finger] of this.fingers) if (finger.trackId === id) this.fingers.delete(key);
                }
            }
            const history = this.histories.get(measurement.trackId) || [];
            if (history.length && now - history.at(-1).time > FINGER_CONTINUITY_CONFIG.maxFrameGapMs) history.length = 0;
            history.push({ time: now, handedness: measurement.handedness, landmarks: measurement.landmarks.map(point => ({ ...point })) });
            this.histories.set(measurement.trackId, history.slice(-FINGER_CONTINUITY_CONFIG.historySize));
            // Refresh actual anatomy only from measured complete hands.
            const palmWidth = distance(pixel(measurement.landmarks[5], frame), pixel(measurement.landmarks[17], frame));
            for (const finger of FINGERS) {
                const key = `${measurement.trackId}:${finger.name}`;
                const points = finger.indices.map(index => pixel(measurement.landmarks[index], frame));
                const width = Math.max(4, palmWidth * (finger.name === 'Pinky' ? 0.20 : 0.24));
                const features = selectFeatures(points, width, frame, pixelBounds);
                if (history.length < FINGER_CONTINUITY_CONFIG.minHistory) {
                    this.fingers.delete(key);
                    continue;
                }
                const previous=this.fingers.get(key);
                const recent=history.slice(-5).map(sample=>({time:sample.time,
                    points:finger.indices.map(index=>pixel(sample.landmarks[index],frame)),
                    width:Math.max(4,distance(pixel(sample.landmarks[5],frame),pixel(sample.landmarks[17],frame))*(finger.name==='Pinky'?.20:.24))}));
                // A weak/blurred frame must not erase the last clear image pair.
                const anchor=features.length>=4 ? {frame,points,width,features,time:now} : previous?.anchor;
                this.fingers.set(key, {trackId:measurement.trackId,name:finger.name,history:recent,anchor,
                    hasImageSupport:previous?.hasImageSupport??false,closeUp:closeUpHand(measurement.landmarks,bounds),
                    measuredAt:now,originalLength:distance(points[0],points.at(-1))});
            }
        }
        for (const [key, finger] of this.fingers) {
            if (live.has(finger.trackId)) continue;
            const age = now - finger.measuredAt;
            const gap=now-finger.history.at(-1).time;
            if(age>=FINGER_CONTINUITY_CONFIG.maxAgeMs||gap>=FINGER_CONTINUITY_CONFIG.maxEvidenceGapMs){this.fingers.delete(key);continue;}
            const prediction=predictFinger(finger.history,now,FINGER_CONTINUITY_CONFIG.predictionMs);
            if(!prediction){this.fingers.delete(key);continue;}
            const {anchor}=finger;
            let motion=null;
            if(anchor&&now-anchor.time<FINGER_CONTINUITY_CONFIG.maxEvidenceGapMs){
                const guide=fit(anchor.points.map((from,i)=>({from,to:prediction.points[i]})),{minScale:.5,maxScale:2,maxAngle:.7});
                // Cropping may remove most old patches. Judge agreement among
                // patches expected to remain visible, not offscreen fingertips.
                const features=anchor.features.filter(point=>inBounds(guide?guide.apply(point):point,pixelBounds,5));
                const limits=now-anchor.time>250 ? {minScale:.6,maxScale:1.8,maxAngle:.5} : {minScale:.75,maxScale:1.4,maxAngle:.35};
                const attempt=(features,predictions=[])=>{
                    if(features.length<4)return null;
                    const pairs=this.trackPoints(anchor.frame,frame,features,{predictions});
                    return pairs.length>=Math.max(4,features.length*.5)?robustMotion(pairs,limits):null;
                };
                motion=attempt(features,features.map(point=>guide?guide.apply(point):point));
                // The user may stop approaching while autofocus settles. If
                // the motion forecast overshoots, also try the last clear place.
                if(!motion&&guide)motion=attempt(anchor.features.filter(point=>inBounds(point,pixelBounds,5)));
            }
            let points,width,alpha,source;
            if(motion){
                points=anchor.points.map(motion.apply);width=anchor.width*motion.scale;
                const length=distance(points[0],points.at(-1));
                if(length>finger.originalLength*5||length<finger.originalLength*.5
                    ||!motion.inliers.some(pair=>inBounds(pair.to,pixelBounds,4))){this.fingers.delete(key);continue;}
                const fresh=selectFeatures(points,width,frame,pixelBounds);
                finger.anchor={frame,points,width,time:now,features:fresh.length>=4?fresh:motion.inliers.map(pair=>pair.to)};
                finger.history.push({time:now,points,width});finger.history=finger.history.slice(-5);
                finger.hasImageSupport=true;
                alpha=.82;source='image';
            }else{
                ({points,width}=prediction);
                if(!intersectsView(points,pixelBounds)){this.fingers.delete(key);continue;}
                const shortSide=Math.min(pixelBounds.right-pixelBounds.left,pixelBounds.bottom-pixelBounds.top);
                const center={x:(pixelBounds.left+pixelBounds.right)/2,y:(pixelBounds.top+pixelBounds.bottom)/2};
                const central=fingerDistanceToPoint(points,center)<=shortSide*.25;
                const closeUp=finger.closeUp&&central&&width>=shortSide*.06
                    &&distance(points[0],points.at(-1))>=shortSide*.4;
                if(!finger.hasImageSupport&&!closeUp)continue;
                const fade=gap<=FINGER_CONTINUITY_CONFIG.fadeStartMs?1:
                    (FINGER_CONTINUITY_CONFIG.maxEvidenceGapMs-gap)/(FINGER_CONTINUITY_CONFIG.maxEvidenceGapMs-FINGER_CONTINUITY_CONFIG.fadeStartMs);
                alpha=.76*fade;source='memory';
            }
            predictions.push({ trackId: finger.trackId, name: finger.name,
                points: points.map(point => normalized(point, frame)), width: width / frame.width,
                alpha: alpha * Math.min(1, (FINGER_CONTINUITY_CONFIG.maxAgeMs - age) / 1000), ageMs: age,
                source,evidenceAgeMs:source==='image'?0:gap,landmarkOnly:!finger.hasImageSupport });
        }
        for (const [id, history] of this.histories) {
            if (now - history.at(-1).time >= FINGER_CONTINUITY_CONFIG.maxAgeMs) this.histories.delete(id);
        }
        this.previousTime = now;
        // With no textured patches yet, retain only the prominent central digit
        // from measured history. Do not manufacture five new close-up fingers.
        const bestMemory=new Map();
        const center={x:(pixelBounds.left+pixelBounds.right)/2,y:(pixelBounds.top+pixelBounds.bottom)/2};
        const supportedIds=new Set(predictions.filter(p=>!p.landmarkOnly).map(p=>p.trackId));
        for(const p of predictions.filter(p=>p.landmarkOnly)){
            const score=fingerDistanceToPoint(p.points.map(point=>pixel(point,frame)),center)/(p.width*frame.width);
            if(!bestMemory.has(p.trackId)||score<bestMemory.get(p.trackId).score)bestMemory.set(p.trackId,{prediction:p,score});
        }
        return predictions.filter(p=>!p.landmarkOnly||(!supportedIds.has(p.trackId)&&bestMemory.get(p.trackId)?.prediction===p));
    }
}

import { Matrix4, Quaternion, Vector3 } from 'three';

export const DEFAULT_SKULL_FIT = { width: 1, height: 1, offsetY: 0, jaw: 1, opacity: 1 };
// Normalized coordinates measured on the CC0 ScatteringSkull mesh (height=1).
export const SKULL_ANCHORS = {
    rightEye: [-.205,.625,.49], leftEye: [.205,.625,.49],
    upperTeeth: [0,.285,.665], chin: [0,.025,.59], jawPivot: [0,.37,.24],
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const vector=a=>new Vector3(...a);
const midpoint=(a,b)=>a.clone().add(b).multiplyScalar(.5);

export function jawWeight(p) {
    const front=clamp((p.z-.10)/.13,0,1);
    const top=.39-.125*clamp((p.z-.28)/.20,0,1);
    return front*clamp((top-p.y)/.015,0,1);
}
export function moveJaw(point,angle) {
    const p=vector(point),weight=jawWeight(p),pivot=vector(SKULL_ANCHORS.jawPivot);
    const moved=p.clone().sub(pivot).applyAxisAngle(new Vector3(1,0,0),angle).add(pivot);
    return p.lerp(moved,weight);
}

export function estimateSkullFit(landmarks,w,h,options=DEFAULT_SKULL_FIT,faceMatrix=null) {
    if(!landmarks?.[454] || !(w>0&&h>0))return null;
    const ids=[33,133,362,263,10,152,13,14];
    if(ids.some(i=>!Number.isFinite(landmarks[i]?.x)||!Number.isFinite(landmarks[i]?.y)))return null;
    const p=i=>new Vector3(landmarks[i].x*w-w/2,h/2-landmarks[i].y*h,-(landmarks[i].z||0)*w);
    const rightEye=midpoint(p(33),p(133)),leftEye=midpoint(p(362),p(263));
    const eyes=midpoint(rightEye,leftEye),x=leftEye.clone().sub(rightEye).normalize();
    const up=p(10).sub(p(152));up.addScaledVector(x,-up.dot(x)).normalize();
    const forward=x.clone().cross(up).normalize();
    if(forward.lengthSq()<.5)return null;
    const basis=new Matrix4().makeBasis(x,up,forward);
    let rotation=new Quaternion().setFromRotationMatrix(basis);
    // Matrix outputs can differ by producer layout. Choose the rotation whose
    // eye axis agrees with the observed 3D landmarks, never the translation.
    if(faceMatrix?.data?.length===16&&faceMatrix.data.every(Number.isFinite)) {
        const m=new Matrix4().fromArray(faceMatrix.data), candidates=[m,m.clone().transpose()];
        const scored=candidates.map(c=>{
            const r=new Matrix4().extractRotation(c),q=new Quaternion().setFromRotationMatrix(r);
            return {q,score:new Vector3(1,0,0).applyQuaternion(q).dot(x)+new Vector3(0,1,0).applyQuaternion(q).dot(up)};
        }).sort((a,b)=>b.score-a.score);
        if(scored[0].score>1.8)rotation=scored[0].q;
    }
    const eyeDistance=rightEye.distanceTo(leftEye);
    if(eyeDistance<8)return null;
    const opening=p(13).distanceTo(p(14))/eyeDistance;
    const jawAngle=clamp((opening-.015)*1.3*(options.jaw??1),0,.55);
    const sx=eyeDistance/.410*(options.width??1);
    const eyeToMouth=eyes.clone().sub(p(13)).dot(up);
    const sy=clamp(eyeToMouth/.34,sx*.60,sx*1.55)*(options.height??1);
    const sz=Math.sqrt(sx*sy);
    const scale=new Vector3(sx,sy,sz);
    // Eyes are the fixed reference. Upper teeth height is fit independently
    // from the eye-to-mouth distance rather than stretching the whole skull.
    const eyeAnchor=vector([0,.625,.49]).multiply(scale).applyQuaternion(rotation);
    const position=eyes.clone().sub(eyeAnchor);
    position.addScaledVector(up,(options.offsetY??0)*sy);
    return {rotation,position,scale,jawAngle,eyes,eyeDistance};
}

export function projectSkullPoint(point,fit,w,h,jaw=false) {
    const v=(jaw?moveJaw(point,fit.jawAngle):vector(point)).multiply(fit.scale).applyQuaternion(fit.rotation).add(fit.position);
    return {x:v.x+w/2,y:h/2-v.y,z:v.z};
}

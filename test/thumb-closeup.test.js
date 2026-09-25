import test from 'node:test';
import assert from 'node:assert/strict';
import {FingerContinuityTracker,FINGER_CONTINUITY_CONFIG} from '../src/services/fingerContinuity.js';

const WIDTH=160,HEIGHT=240,CX=80,CY=130;
const landmarks=[{x:.5,y:.95},{x:.5,y:.9},{x:.5,y:.77},{x:.5,y:.47},{x:.5,y:.14}];
for(const x of [.1,.25,.8,.94])for(const y of [.78,.53,.33,.12])landmarks.push({x,y});
const measurement={trackId:'thumb-hand',handedness:'Left',landmarks};
const source=new Uint8Array(WIDTH*HEIGHT).fill(80);
let random=74;
for(let y=12;y<213;y++)for(let x=64;x<97;x++){
    random=(Math.imul(random,1664525)+1013904223)>>>0;
    source[y*WIDTH+x]=50+(random>>>24)%160;
}
const flat=()=>({width:WIDTH,height:HEIGHT,data:new Uint8Array(WIDTH*HEIGHT).fill(80)});
function image(scale=1,dx=0){
    const frame=flat(),data=frame.data;
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
        const sx=(x-CX-dx)/scale+CX,sy=(y-CY)/scale+CY;
        const ix=Math.floor(sx),iy=Math.floor(sy);
        if(ix<0||iy<0||ix+1>=WIDTH||iy+1>=HEIGHT)continue;
        const fx=sx-ix,fy=sy-iy,i=iy*WIDTH+ix;
        data[y*WIDTH+x]=source[i]*(1-fx)*(1-fy)+source[i+1]*fx*(1-fy)
            +source[i+WIDTH]*(1-fx)*fy+source[i+WIDTH+1]*fx*fy;
    }
    return frame;
}
function seed(tracker,frame=image()){
    for(let i=0;i<5;i++)tracker.update([measurement],frame,1000+i*40);
}

test('a thumb remains aligned during magnification, cropping, and a two-frame autofocus gap',()=>{
    const tracker=new FingerContinuityTracker();seed(tracker);
    let last;
    for(let i=1;i<=40;i++){
        const scale=1+i*.0325,blur=i===12||i===13;
        const result=tracker.update([],blur?flat():image(scale),1160+i*40);
        assert.equal(result.length,1,`thumb should survive frame ${i}, scale ${scale}`);
        const [thumb]=result;
        assert.equal(thumb.name,'Thumb');
        assert.equal(thumb.source,blur?'memory':'image',`tracking source at frame ${i}`);
        const expected=((landmarks[3].y*HEIGHT-CY)*scale+CY)/HEIGHT;
        assert.ok(Math.abs(thumb.points[1].y-expected)<.05,`thumb IP joint alignment at frame ${i}`);
        last=thumb;
    }
    assert.ok(last.points[0].y>1,'thumb base is cropped');
    assert.ok(last.points[2].y<0,'thumb tip is cropped');
    assert.ok(last.width>.2,'thumb anatomy enlarged with the camera image');
});

test('four or five recent hand frames can predict a central thumb even on smooth skin',()=>{
    const tracker=new FingerContinuityTracker();
    for(let i=0;i<5;i++){
        const scale=.88+i*.03;
        const points=landmarks.map(p=>({x:(CX+(p.x*WIDTH-CX)*scale)/WIDTH,y:(CY+(p.y*HEIGHT-CY)*scale)/HEIGHT}));
        tracker.update([{...measurement,landmarks:points}],flat(),1000+i*40);
    }
    const [thumb]=tracker.update([],flat(),1280);
    assert.equal(thumb.name,'Thumb');assert.equal(thumb.source,'memory');assert.equal(thumb.landmarkOnly,true);
    const originalLength=landmarks[2].y-landmarks[4].y;
    assert.ok(thumb.points[0].y-thumb.points[2].y>originalLength*1.05,'recent approach predicts magnification');
});

test('unsupported thumb predictions fade and expire without renewing their own history',()=>{
    const tracker=new FingerContinuityTracker();seed(tracker);
    assert.equal(tracker.update([],image(),1200)[0].source,'image');
    let first,last;
    for(let elapsed=40;elapsed<FINGER_CONTINUITY_CONFIG.maxEvidenceGapMs;elapsed+=40){
        const [thumb]=tracker.update([],flat(),1200+elapsed);
        assert.equal(thumb.source,'memory');assert.equal(thumb.evidenceAgeMs,elapsed);
        first??=thumb;last=thumb;
    }
    assert.ok(last.alpha<first.alpha*.2);
    assert.deepEqual(tracker.update([],flat(),2400),[]);
    assert.deepEqual(tracker.update([],image(),2440),[],'old texture cannot revive expired identity');
});

test('the last clear frame survives weak texture in the final measured hand frame',()=>{
    const tracker=new FingerContinuityTracker();seed(tracker);
    tracker.update([measurement],flat(),1200);
    const result=tracker.update([],image(1,3),1240);
    assert.equal(result.length,1);assert.equal(result[0].name,'Thumb');assert.equal(result[0].source,'image');
});

test('a slower camera frame can recover, while a source or long pause clears memory',()=>{
    const tracker=new FingerContinuityTracker();seed(tracker);
    assert.equal(tracker.update([],image(1,2),1500)[0].source,'image');
    tracker.update([],image(),1501+FINGER_CONTINUITY_CONFIG.maxFrameGapMs);
    assert.deepEqual(tracker.update([],image(),2180),[]);
    seed(tracker);
    assert.deepEqual(tracker.update([],flat(),1200,{left:.1,top:0,right:.9,bottom:1}),[]);
});

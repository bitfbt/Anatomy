import test from 'node:test';
import assert from 'node:assert/strict';
import { ForearmTracker, matchForearm, FOREARM_CONTINUITY_MS } from '../src/services/forearmTracking.js';
import { validateHandForRendering } from '../src/services/handValidation.js';

const bounds={left:0,top:0,right:500,bottom:700};
function fixture(){
    const hand=Array.from({length:21},()=>({x:.5,y:.4}));
    hand[0]={x:.5,y:.5}; hand[5]={x:.4,y:.4};hand[17]={x:.6,y:.4};hand[9]={x:.5,y:.35};
    const pose=Array.from({length:33},()=>({x:0,y:0,visibility:0}));
    pose[15]={x:.51,y:.5,visibility:.95};pose[13]={x:.55,y:.85,visibility:.9};
    return {hand,pose};
}
const update=(tracker,hand,pose,time,used=new Set())=>tracker.update(hand,pose,500,700,bounds,used,time);

test('confident offscreen elbows and camera edge wrists keep matching',()=>{
    const {hand,pose}=fixture();
    for(const elbow of [{x:-.1,y:.6},{x:1.1,y:.6},{x:.5,y:-.1},{x:.5,y:1.1}]){
        pose[13]={...elbow,visibility:.9};
        assert.ok(matchForearm(hand,pose,500,700,bounds));
    }
    hand.forEach(p=>{p.x-=.49;});pose[15].x-=.49;pose[13]={x:.15,y:.9,visibility:.9};
    assert.ok(matchForearm(hand,pose,500,700,bounds));
});

test('continuity follows the live wrist and expires from the last observed elbow',()=>{
    const {hand,pose}=fixture(),tracker=new ForearmTracker();
    const first=update(tracker,hand,pose,1000);assert.equal(first.held,false);
    const moved=hand.map(p=>({...p,x:p.x+.025}));
    const held=update(tracker,moved,null,1100);assert.equal(held.held,true);
    assert.equal(held.wrist.x,moved[0].x);
    assert.ok(Math.abs(held.elbow.x-first.elbow.x-.025)<1e-6);
    assert.ok(update(tracker,moved,null,1250));
    assert.ok(update(tracker,moved,null,1500));
    assert.equal(update(tracker,moved,null,1001+FOREARM_CONTINUITY_MS),null);
});

test('explicit pose contradictions, ambiguity and invalid live hands never reuse an arm',()=>{
    for(const kind of ['distant','ambiguous','implausible','nonfinite']){
        const {hand,pose}=fixture(),tracker=new ForearmTracker();update(tracker,hand,pose,0);
        if(kind==='distant')pose[15].x=.95;
        if(kind==='ambiguous'){pose[16]={...pose[15]};pose[14]={...pose[13]};}
        if(kind==='implausible')pose[13].y=8;
        if(kind==='nonfinite')hand[8].x=NaN;
        assert.equal(update(tracker,hand,pose,100),null,kind);
    }
    const {hand,pose}=fixture();pose[13].visibility=NaN;
    assert.equal(matchForearm(hand,pose,500,700,bounds),null);
});

test('a consumed closest wrist is not reassigned to the second arm',()=>{
    const {hand,pose}=fixture();pose[16]={x:.64,y:.5,visibility:.95};pose[14]={x:.7,y:.85,visibility:.9};
    assert.equal(matchForearm(hand,pose,500,700,bounds,new Set([15])),null);
    assert.equal(update(new ForearmTracker(),hand,pose,0,new Set([15])),null);
});

test('large hand turns and scale changes cancel continuity',()=>{
    for(const kind of ['turn','scale','jump','offscreen']){
        const {hand,pose}=fixture(),tracker=new ForearmTracker();update(tracker,hand,pose,0);
        if(kind==='turn')hand[9]={x:.7,y:.5};
        if(kind==='scale'){hand[5].x=.25;hand[17].x=.75;}
        if(kind==='jump')hand.forEach(p=>{p.x+=.2;});
        if(kind==='offscreen')hand.forEach(p=>{p.x+=.7;});
        assert.equal(update(tracker,hand,null,100),null,kind);
    }
});

test('visible wrist supports a forearm when the full hand fails crop validation',()=>{
    const {hand,pose}=fixture();hand.forEach(p=>{p.y-=.45;});
    pose[15]={...hand[0],visibility:.9};pose[13]={x:.55,y:.5,visibility:.9};
    assert.equal(validateHandForRendering(hand,.9,500,700,bounds).valid,false);
    assert.ok(matchForearm(hand,pose,500,700,bounds));
    pose[13].visibility=.1;assert.equal(matchForearm(hand,pose,500,700,bounds),null);
});


const resolve=(tracker,hand,pose,time)=>tracker.resolve(hand,pose,500,700,bounds,new Set(),time);

test('a visible hand never invents an unmeasured elbow from palm direction',()=>{
    const {hand}=fixture(),tracker=new ForearmTracker();
    for(let time=0;time<2000;time+=33)assert.equal(resolve(tracker,hand,null,time),null);
    const rotated=hand.map(p=>({...p,x:.5-(p.y-.5),y:.5+(p.x-.5)}));
    assert.equal(resolve(tracker,rotated,null,2033),null);
});

test('short pose losses retain only a measured elbow and expire without self-renewal',()=>{
    const {hand,pose}=fixture(),tracker=new ForearmTracker();
    const measured=resolve(tracker,hand,pose,100);
    assert.equal(measured.source,'pose');assert.equal(measured.estimated,false);
    assert.deepEqual(measured.elbow,pose[13]);
    for(let time=150;time<=100+FOREARM_CONTINUITY_MS;time+=50){
        const held=resolve(tracker,hand,null,time);
        assert.equal(held.source,'held-pose');assert.equal(held.estimated,true);
        assert.deepEqual(held.elbow,measured.elbow);
    }
    assert.equal(resolve(tracker,hand,null,101+FOREARM_CONTINUITY_MS),null);
    assert.equal(resolve(tracker,null,null,1000),null);
});

test('a single elbow outlier cannot swing the overlay but a confirmed movement is accepted',()=>{
    const {hand,pose}=fixture(),tracker=new ForearmTracker();
    const first=resolve(tracker,hand,pose,100);
    const jumped=pose.map(p=>({...p}));jumped[13].x+=.2;
    const outlier=resolve(tracker,hand,jumped,133);
    assert.equal(outlier.held,true);assert.deepEqual(outlier.elbow,first.elbow);
    const recovered=resolve(tracker,hand,pose,166);
    assert.equal(recovered.held,false);assert.deepEqual(recovered.elbow,pose[13]);
    assert.equal(resolve(tracker,hand,jumped,199).held,true);
    const confirmed=resolve(tracker,hand,jumped,232);
    assert.equal(confirmed.held,false);assert.deepEqual(confirmed.elbow,jumped[13]);
});

test('reset and changed camera dimensions cannot reuse a previous camera elbow',()=>{
    const {hand,pose}=fixture(),tracker=new ForearmTracker();
    resolve(tracker,hand,pose,100);tracker.reset();
    assert.equal(resolve(tracker,hand,null,133),null);
    resolve(tracker,hand,pose,166);
    assert.equal(tracker.resolve(hand,null,700,500,{left:0,top:0,right:700,bottom:500},new Set(),199),null);
});

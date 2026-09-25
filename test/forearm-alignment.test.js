import test from 'node:test';
import assert from 'node:assert/strict';
import {alignForearmToHand} from '../src/services/forearmAlignment.js';
import {LandmarkSmoother} from '../src/services/landmarkSmoothing.js';
import {ForearmTracker, FOREARM_CONTINUITY_MS} from '../src/services/forearmTracking.js';
import {createForearmGeometry} from '../src/services/forearmGeometry.js';

const handAt = wrist => {
    const hand=Array.from({length:21},()=>({...wrist}));
    for(const [index,x] of [[5,-.1],[9,0],[13,.05],[17,.1]])hand[index]={x:wrist.x+x,y:wrist.y-.15};
    hand[2]={x:wrist.x-.15,y:wrist.y-.1};
    return hand;
};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('a selected elbow retains exact camera coordinates while using the rendered wrist',()=>{
    for(const source of ['manual-tracked','manual-pinned']){
        const smoother=new LandmarkSmoother(),rendered=handAt({x:.51,y:.41});
        smoother.smooth('arm',[{x:.4,y:.4,z:0}],0);
        const match={wrist:{x:.5,y:.4},elbow:{x:.55,y:.8},source};
        const aligned=alignForearmToHand(match,rendered,smoother,'arm',33);
        assert.equal(aligned.wrist,rendered[0]);
        assert.deepEqual(aligned.elbow,match.elbow);
    }
});

test('moving an arm preserves its elbow-to-wrist vector and the exact rendered hand connection',()=>{
    const smoother=new LandmarkSmoother();
    for(let i=0;i<15;i++){
        const rawWrist={x:.3+i*.01,y:.4};
        const rendered=handAt({x:rawWrist.x-.005,y:.402});
        const match={wrist:rawWrist,elbow:{x:rawWrist.x+.06,y:.82},held:i%2===0};
        const aligned=alignForearmToHand(match,rendered,smoother,'arm',i*33);
        assert.equal(aligned.wrist,rendered[0]);
        close(aligned.elbow.x-rendered[0].x,.06);
        close(aligned.elbow.y-rendered[0].y,.42);
        const geometry=createForearmGeometry(rendered,aligned,500,700);
        close(geometry.at(1).x,rendered[0].x*500);close(geometry.at(1).y,rendered[0].y*700);
    }
});

test('a cropped-hand continuation supplies exactly the same wrist to hand and forearm',()=>{
    const predicted=handAt({x:.46,y:.11});
    const rawMatch={wrist:{x:.45,y:.10},elbow:{x:.52,y:.61},held:false};
    const aligned=alignForearmToHand(rawMatch,predicted,new LandmarkSmoother(),'arm',100);
    const geometry=createForearmGeometry(predicted,aligned,500,700);
    close(geometry.wrist.x,predicted[0].x*500);close(geometry.wrist.y,predicted[0].y*700);
    close(aligned.elbow.x-predicted[0].x,rawMatch.elbow.x-rawMatch.wrist.x);
});

test('coasting the paired hand cannot refresh or invent a forearm measurement',()=>{
    const tracker=new ForearmTracker(),bounds={left:0,top:0,right:500,bottom:700};
    const hand=handAt({x:.5,y:.4});
    const pose=Array.from({length:33},()=>({x:0,y:0,visibility:0}));
    pose[15]={...hand[0],visibility:.9};pose[13]={x:.52,y:.8,visibility:.9};
    assert.equal(tracker.resolve(hand,null,500,700,bounds,new Set(),0),null);
    tracker.resolve(hand,pose,500,700,bounds,new Set(),100);
    for(let elapsed=33;elapsed<=165;elapsed+=33){
        const predicted=handAt({x:.5+elapsed*.00005,y:.4});
        const held=tracker.resolve(predicted,null,500,700,bounds,new Set(),100+elapsed);
        assert.equal(held.held,true);assert.equal(held.ageMs,elapsed);
        assert.equal(held.wrist,predicted[0]);
    }
    assert.equal(tracker.resolve(hand,null,500,700,bounds,new Set(),101+FOREARM_CONTINUITY_MS),null);
});

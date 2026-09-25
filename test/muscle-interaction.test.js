import test from 'node:test';
import assert from 'node:assert/strict';
import {drawHandMuscles,drawTrackedFingerAnatomy} from '../src/services/anatomyRenderer.js';
import {drawForearm,drawForearmLabels} from '../src/services/forearmAnatomy.js';
import {FOREARM_ATLAS} from '../src/services/forearmAtlasData.js';
import {getMuscleInfo} from '../src/services/muscleInfo.js';
import {findAnatomyHit} from '../src/services/anatomyHitTesting.js';

const width=390,height=844,bounds={left:18,top:18,right:372,bottom:826};
function hand(){
    const raw=[[.5,.89],[.36,.77],[.25,.67],[.19,.56],[.14,.44],[.36,.58],[.34,.40],[.34,.26],[.34,.13],
        [.51,.56],[.52,.34],[.52,.19],[.52,.06],[.65,.59],[.67,.40],[.68,.26],[.68,.13],[.78,.65],[.85,.51],[.88,.40],[.90,.29]];
    return raw.map(([x,y])=>({x:.49+(x-.5)*.65,y:.08+y*.44,z:0}));
}
function context(){
    const boxes=[],texts=[],gradient={addColorStop(){}};
    return new Proxy({globalAlpha:1,boxes,texts,
        createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,
        measureText:text=>({width:text.length*5.5}),getLineDash:()=>[],
        fillRect:(...args)=>boxes.push(args),fillText:text=>texts.push(text),
    },{get:(object,key)=>key in object?object[key]:()=>{}});
}
function checkTargets(ctx,targets){
    assert.ok(targets.length>0);
    for(const target of targets){
        assert.ok(target.name&&target.location&&target.explanation.length>15);
        const {x,y,w,h}=target.rect;
        assert.ok([x,y,w,h].every(Number.isFinite));
        assert.ok(ctx.boxes.some(box=>box.every((v,i)=>v===[x,y,w,h][i])),'hit rectangle differs from visible label');
        const hit=findAnatomyHit({x:x+w/2,y:y+h/2},targets);
        assert.equal(hit?.name,target.name);
    }
}

test('visible hand muscle labels open their corresponding details in both sides and label modes',()=>{
    for(const side of ['palm','back'])for(const labelMode of ['clean','detailed'])for(const mirror of [false,true]){
        const ctx=context(),points=hand();if(mirror)points.forEach(p=>{p.x=1-p.x;});
        const result=drawHandMuscles(ctx,points,width,height,{side,labelMode,visibleBounds:bounds});
        checkTargets(ctx,result.hitTargets);
        assert.equal(result.hitTargets.length,ctx.texts.length,'a visible label has no popup');
    }
});

test('wrapped forearm labels retain tappable full boxes and details including deep muscles',()=>{
    for(const side of ['palm','back'])for(const labelMode of ['clean','detailed']){
        const ctx=context(),requests=[];
        drawForearm(ctx,hand(),{elbow:{x:.5,y:.82}},width,height,{layer:'muscles',side,labelMode,visibleBounds:bounds,labelCollector:requests});
        const targets=drawForearmLabels(ctx,requests);
        checkTargets(ctx,targets);
        assert.equal(targets.length,requests[0].labels.length);
    }
    for(const muscle of Object.values(FOREARM_ATLAS).flat())assert.ok(getMuscleInfo(muscle.name),muscle.name);
});

test('a retained finger tendon label provides finger-specific details on each side',()=>{
    for(const side of ['palm','back']){
        const ctx=context(),finger={name:'Index',width:.14,points:[{x:.5,y:.85},{x:.5,y:.6},{x:.5,y:.35},{x:.5,y:.1}]};
        const result=drawTrackedFingerAnatomy(ctx,finger,width,height,{layer:'muscles',labelMode:'clean',side,visibleBounds:bounds});
        checkTargets(ctx,result.hitTargets);
        assert.equal(result.hitTargets.length,1);
        assert.match(result.hitTargets[0].explanation,/index finger/);
    }
});

test('turning muscle labels off leaves no invisible popup targets',()=>{
    for(const side of ['palm','back']){
        const ctx=context(),requests=[];
        assert.deepEqual(drawHandMuscles(ctx,hand(),width,height,{side,labelMode:'off',visibleBounds:bounds}).hitTargets,[]);
        drawForearm(ctx,hand(),{elbow:{x:.5,y:.82}},width,height,{layer:'muscles',side,labelMode:'off',visibleBounds:bounds,labelCollector:requests});
        assert.deepEqual(drawForearmLabels(ctx,requests),[]);
        assert.deepEqual(ctx.texts,[]);
    }
    assert.equal(getMuscleInfo('Low confidence - simplified overlay'),null);
});

test('label taps take precedence over underlying anatomy and bone taps still work',()=>{
    const bone={type:'segment',from:{x:0,y:20},to:{x:100,y:20},radius:10};
    const node={type:'node',center:{x:150,y:20},radius:15};
    const label={type:'label',rect:{x:10,y:10,w:60,h:20},name:'Lumbricals'};
    const targets=[bone,label,node];
    assert.equal(findAnatomyHit({x:20,y:20},targets),label);
    assert.equal(findAnatomyHit({x:90,y:20},targets),bone);
    assert.equal(findAnatomyHit({x:150,y:20},targets),node);
    assert.equal(findAnatomyHit({x:20,y:50},targets),null);
});

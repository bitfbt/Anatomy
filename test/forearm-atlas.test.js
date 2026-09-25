import test from 'node:test';
import assert from 'node:assert/strict';
import {drawForearm,drawForearmLabels} from '../src/services/forearmAnatomy.js';
import {FOREARM_ATLAS} from '../src/services/forearmAtlasData.js';

function context() {
    const labels=[],boxes=[];
    const gradient={addColorStop(){}};
    let depth=0;
    const calls=[];
    const ctx=new Proxy({globalAlpha:1,font:'',textAlign:'left',
        save(){depth++;},restore(){depth--;assert.ok(depth>=0);},
        createLinearGradient(){return gradient;},createRadialGradient(){return gradient;},
        measureText(text){return {width:text.length*6};},
        fillText(text){labels.push(text);},fillRect(...v){boxes.push(v);},
    },{get(obj,key){return key in obj?obj[key]:(...values)=>{assert.ok(values.every(Number.isFinite),`${key} has nonfinite values`);calls.push([key,...values]);};}});
    return {ctx,labels,boxes,calls,depth:()=>depth};
}
function hand(){
    const points=Array.from({length:21},()=>({x:.5,y:.88}));
    points[5]={x:.36,y:.93};points[17]={x:.64,y:.93};points[2]={x:.28,y:.92};return points;
}
const bounds={left:0,top:0,right:1000,bottom:1000};

test('authored forearm plates remain finite when mirrored, rotated and cropped',()=>{
    for(const side of ['palm','back'])for(const elbow of [{x:.5,y:.10},{x:.05,y:.83},{x:.55,y:-.08}])for(const mirrored of [false,true]){
        const points=hand();if(mirrored)points.forEach(p=>{p.x=1-p.x;});
        const c=context();
        assert.equal(drawForearm(c.ctx,points,{elbow},1000,1000,{layer:'muscles',side,labelMode:'off',visibleBounds:bounds}),true);
        assert.equal(c.depth(),0);assert.ok(c.calls.length>100);assert.equal(c.labels.length,0);
    }
});

test('detailed muscle labels can be deferred until after the hand and remain inside columns',()=>{
    for(const side of ['palm','back']){
        const c=context(),requests=[];
        drawForearm(c.ctx,hand(),{elbow:{x:.5,y:.08}},1000,1000,{layer:'muscles',side,labelMode:'detailed',visibleBounds:bounds,labelCollector:requests});
        assert.equal(c.labels.length,0);assert.equal(requests.length,1);
        assert.deepEqual(requests[0].labels.slice(0,-1).map(l=>l.text),FOREARM_ATLAS[side].map(r=>r.name));
        drawForearmLabels(c.ctx,requests);
        assert.equal(c.depth(),0);assert.ok(c.labels.length>=FOREARM_ATLAS[side].length);
        for(const [x,y,w,h] of c.boxes)assert.ok(x>=0&&y>=0&&x+w<=1000&&y+h<=1000);
        for(let i=0;i<c.boxes.length;i++)for(let j=i+1;j<c.boxes.length;j++){
            const [x,y,w,h]=c.boxes[i],[a,b,cw,ch]=c.boxes[j];
            assert.ok(x+w<=a||a+cw<=x||y+h<=b||b+ch<=y,'Label boxes overlap');
        }
    }
});

test('Palm and Back use distinct structures and deep regions are identified',()=>{
    assert.ok(FOREARM_ATLAS.palm.some(r=>r.name==='Pronator teres'));
    assert.ok(!FOREARM_ATLAS.back.some(r=>r.name==='Pronator teres'));
    assert.ok(FOREARM_ATLAS.back.some(r=>r.name==='Extensor pollicis longus'));
    assert.ok(FOREARM_ATLAS.palm.some(r=>r.name==='Flexor digitorum profundus (deep)'));
    for(const regions of Object.values(FOREARM_ATLAS))assert.equal(new Set(regions.map(r=>r.path)).size,regions.length);
});

test('radius and ulna render as distinct forearm bones with named labels under mirroring and rotation',()=>{
    for(const elbow of [{x:.5,y:.1},{x:.1,y:.8},{x:1.08,y:.6}])for(const mirror of [false,true]){
        const points=hand();if(mirror)points.forEach(p=>{p.x=1-p.x;});
        const c=context(),requests=[];
        assert.equal(drawForearm(c.ctx,points,{elbow},1000,1000,{layer:'skeleton',labelMode:'detailed',visibleBounds:bounds,labelCollector:requests}),true);
        assert.deepEqual(requests[0].labels.map(label=>label.text),['Ulna','Radius']);
        assert.equal(c.depth(),0);
        assert.ok(c.calls.length>50);
    }
});

test('invalid forearm endpoints do not paint bones or muscles',()=>{
    for(const layer of ['skeleton','muscles'])for(const match of [null,{elbow:{x:NaN,y:.2}},{elbow:hand()[0]}]){
        const c=context();
        assert.equal(drawForearm(c.ctx,hand(),match,1000,1000,{layer,visibleBounds:bounds}),false);
        assert.equal(c.calls.length,0);assert.equal(c.depth(),0);
    }
});

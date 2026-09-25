import test from 'node:test';
import assert from 'node:assert/strict';
import {ForearmPlacement} from '../src/services/forearmPlacement.js';
import {createForearmGeometry} from '../src/services/forearmGeometry.js';

const w=400,h=800,bounds={left:0,top:0,right:w,bottom:h};
const options=now=>({trackId:'left',w,h,bounds,now});
function handAt(x=.5,y=.4,angle=0){
    const hand=Array.from({length:21},()=>({x,y}));
    for(const [i,dx,dy] of [[2,-.12,-.06],[5,-.12,-.15],[9,0,-.16],[13,.06,-.15],[17,.12,-.13]]){
        hand[i]={x:x+dx*Math.cos(angle)-dy*h/w*Math.sin(angle),
            y:y+dx*w/h*Math.sin(angle)+dy*Math.cos(angle)};
    }
    return hand;
}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
function texture(width=100,height=160,seed=23){
    const data=new Uint8Array(width*height);
    for(let i=0;i<data.length;i++){
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        data[i]=45+(seed>>>24)%155;
    }
    return {width,height,data};
}
function translate(frame,dx,dy){
    const {width,height}=frame,data=new Uint8Array(width*height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        if(x-dx>=0&&x-dx<width&&y-dy>=0&&y-dy<height)data[y*width+x]=frame.data[(y-dy)*width+x-dx];
    }
    return {width,height,data};
}

test('a visible hand gets a connected forearm in both layers without a body detection',()=>{
    const placement=new ForearmPlacement(),hand=handAt();
    const match=placement.resolve(hand,null,options(0));
    assert.equal(match.source,'approximate');
    assert.equal(match.estimated,true);
    assert.equal(match.wrist,hand[0]);
    assert.ok(match.elbow.y>hand[0].y+.3);
    for(const layer of ['skeleton','muscles']){
        const geometry=createForearmGeometry(hand,match,w,h,{layer});
        assert.ok(geometry.length>200);
        close(geometry.at(1).x,hand[0].x*w);
        close(geometry.at(1).y,hand[0].y*h);
    }
});

test('bending the hand preserves preview direction, while moving the wrist keeps it attached',()=>{
    const placement=new ForearmPlacement(),initial=placement.resolve(handAt(),null,options(0));
    for(const angle of [-.8,.8,0]){
        const hand=handAt(.53,.45,angle),match=placement.resolve(hand,null,options(33));
        close(match.elbow.x-match.wrist.x,initial.elbow.x-initial.wrist.x);
        close(match.elbow.y-match.wrist.y,initial.elbow.y-initial.wrist.y);
        assert.equal(match.wrist,hand[0]);
    }
});

test('observed pose replaces a preview and its direction survives later pose loss',()=>{
    const placement=new ForearmPlacement(),hand=handAt();
    placement.resolve(hand,null,options(0));
    const measured={wrist:hand[0],elbow:{x:.7,y:.8},index:15,held:false};
    assert.equal(placement.resolve(hand,measured,options(33)),measured);
    const match=placement.resolve(handAt(.53,.45,.6),null,options(66));
    assert.equal(match.source,'approximate');
    close(match.elbow.x,.73);close(match.elbow.y,.85);
});

test('a selected elbow overrides pose and stays fixed when the wrist bends or moves',()=>{
    const placement=new ForearmPlacement(),hand=handAt(),elbow={x:.48,y:.78};
    const measured={wrist:hand[0],elbow:{x:.7,y:.8},index:15,held:false};
    placement.resolve(hand,measured,options(0));
    assert.equal(placement.setElbow('left',elbow,hand,w,h,bounds,10),true);
    const moved=handAt(.54,.44,.6),match=placement.resolve(moved,measured,options(33));
    assert.deepEqual(match.elbow,elbow);
    assert.equal(match.wrist,moved[0]);
    assert.equal(match.source,'manual-pinned');
    placement.clearManual();
    assert.equal(placement.resolve(moved,measured,options(66)),measured);
});

test('the selected elbow follows image-supported motion and pins when texture is lost',()=>{
    const placement=new ForearmPlacement(),frame=texture(),hand=handAt(),elbow={x:.5,y:.72};
    placement.updateFrame(frame,0);
    placement.resolve(hand,null,options(0));
    placement.setElbow('left',elbow,hand,w,h,bounds,5);
    placement.updateFrame(translate(frame,3,-2),33);
    const tracked=placement.resolve(hand,null,options(33));
    assert.equal(tracked.source,'manual-tracked');
    close(tracked.elbow.x,elbow.x+3/frame.width);
    close(tracked.elbow.y,elbow.y-2/frame.height);
    const blank={...frame,data:new Uint8Array(frame.data.length).fill(100)};
    placement.updateFrame(blank,66);
    const pinned=placement.resolve(hand,null,options(66));
    assert.equal(pinned.source,'manual-pinned');
    assert.deepEqual(pinned.elbow,tracked.elbow);
    placement.updateFrame(frame,99);
    assert.equal(placement.resolve(hand,null,options(99)).source,'manual-pinned');
});

test('frame gaps, size changes and unrelated image content stop selected-point tracking',()=>{
    for(const [nextFrame,now] of [[texture(),300],[texture(80,120),33],[texture(100,160,94),33],[null,33]]){
        const placement=new ForearmPlacement(),hand=handAt(),elbow={x:.5,y:.72};
        placement.updateFrame(texture(),0);
        placement.setElbow('left',elbow,hand,w,h,bounds,0);
        placement.updateFrame(nextFrame,now);
        const match=placement.resolve(hand,null,options(now));
        assert.equal(match.source,'manual-pinned');assert.deepEqual(match.elbow,elbow);
    }
});

test('reset, changed dimensions, stale tracks and backwards time discard calibration',()=>{
    for(const change of ['reset','dimensions','stale','time']){
        const placement=new ForearmPlacement(),hand=handAt();
        placement.setElbow('left',{x:.6,y:.75},hand,w,h,bounds,100);
        const next=options(133);
        if(change==='reset')placement.reset();
        if(change==='dimensions')next.w=390;
        if(change==='stale'){placement.updateFrame(null,1200);next.now=1200;}
        if(change==='time')next.now=50;
        assert.equal(placement.resolve(hand,null,next).source,'approximate');
    }
});

test('invalid taps, absent palms and isolated finger close-ups cannot create placements',()=>{
    const placement=new ForearmPlacement(),hand=handAt();
    for(const elbow of [hand[0],{x:-.1,y:.7},{x:.5,y:1.2},{x:NaN,y:.7}]){
        assert.equal(placement.setElbow('left',elbow,hand,w,h,bounds,0),false);
    }
    for(const badHand of [null,hand.slice(0,5),hand.map(p=>({...p,x:p.x+2})),Array(21).fill({x:.5,y:.4})]){
        assert.equal(placement.resolve(badHand,null,options(0)),null);
    }
    assert.equal(placement.entries.size,0);
});

test('existing placement coasts briefly with a predicted wrist without renewing its lifetime',()=>{
    const placement=new ForearmPlacement(),hand=handAt();
    assert.equal(placement.coast(hand,options(0)),null);
    const original=placement.resolve(hand,null,options(10));
    for(const now of [43,76,109,190]){
        const moved=handAt(.51,.41),match=placement.coast(moved,options(now));
        assert.equal(match.wrist,moved[0]);
        close(match.elbow.y-match.wrist.y,original.elbow.y-original.wrist.y);
        assert.equal(match.ageMs,now-10);
    }
    assert.equal(placement.coast(hand,options(191)),null);
    placement.setElbow('left',{x:.55,y:.8},hand,w,h,bounds,200);
    assert.deepEqual(placement.coast(handAt(.52,.42),options(233)).elbow,{x:.55,y:.8});
    assert.equal(placement.coast(hand,options(381)),null);
});

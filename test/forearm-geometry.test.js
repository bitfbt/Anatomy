import test from 'node:test';
import assert from 'node:assert/strict';
import {createForearmGeometry} from '../src/services/forearmGeometry.js';
import {createCarpalLayout} from '../src/services/carpalAnatomy.js';

const w = 1000, h = 1000;
const raw = [[500,500],[432,462],[390,419],[363,375],[339,326],
    [438,367],[428,307],[428,264],[428,221], [504,353],[507,279],[507,224],[507,181],
    [562,367],[571,310],[575,261],[575,219], [616,393],[646,350],[661,310],[671,269]];
const elbow = {x: .5, y: .88};
const close = (a, b) => assert.ok(Math.abs(a-b)<1e-7, `${a} differs from ${b}`);
function bentHand(angle) {
    return raw.map(([x,y]) => ({x:(500+(x-500)*Math.cos(angle)-(y-500)*Math.sin(angle))/w,
        y:(500+(x-500)*Math.sin(angle)+(y-500)*Math.cos(angle))/h}));
}
function carpalInput(hand) {
    return Object.fromEntries([['wrist',0],['thumbCmc',1],['indexMcp',5],['middleMcp',9],['ringMcp',13],['pinkyMcp',17]]
        .map(([name,index]) => [name,{x:hand[index].x*w,y:hand[index].y*h}]));
}

test('bending the hand keeps the exact measured wrist and elbow with a matching carpal joint plane', () => {
    for (const angle of [-1.3,-.65,0,.65,1.3]) {
        const hand = bentHand(angle);
        for (const layer of ['skeleton','muscles']) {
            const geometry = createForearmGeometry(hand, {elbow}, w, h, {layer});
            assert.deepEqual(geometry.at(0), {x:elbow.x*w,y:elbow.y*h});
            assert.deepEqual(geometry.at(1), {x:hand[0].x*w,y:hand[0].y*h});
            const axis = geometry.radialAt(1);
            const expected = layer === 'skeleton'
                ? createCarpalLayout(carpalInput(hand)).bones[0].frame.ulnar
                : {x:hand[17].x-hand[5].x,y:hand[17].y-hand[5].y};
            const size = Math.hypot(expected.x,expected.y);
            close(axis.x, -expected.x/size); close(axis.y, -expected.y/size);
            close(geometry.radialAt(.65).x, geometry.proximalRadial.x);
            close(geometry.radialAt(.65).y, geometry.proximalRadial.y);
            const before = geometry.radialAt(.999), end = geometry.radialAt(1);
            assert.ok(Math.hypot(before.x-end.x,before.y-end.y)<.0001,
                'the distal turn eases into the palm instead of making a sharp angular step');
        }
    }
});

test('forearm geometry follows rotations and mirrored camera images without changing anatomical sides', () => {
    const hand = bentHand(.8);
    for (const layer of ['skeleton','muscles']) {
        const original = createForearmGeometry(hand,{elbow},w,h,{layer});
        for (const transform of [p=>({x:1000-p.x,y:p.y}),
            p=>({x:1200+p.x*Math.cos(1.1)-p.y*Math.sin(1.1),y:-100+p.x*Math.sin(1.1)+p.y*Math.cos(1.1)})]) {
            const remap = p => {const mapped=transform({x:p.x*w,y:p.y*h});return {x:mapped.x/w,y:mapped.y/h};};
            const mapped = createForearmGeometry(hand.map(remap),{elbow:remap(elbow)},w,h,{layer});
            for (const t of [0,.2,.7,.85,1,1.02]) for (const x of [-.6,0,.6]) {
                const expected=transform(original.project(x,t)), actual=mapped.project(x,t);
                close(actual.x,expected.x);close(actual.y,expected.y);
            }
        }
    }
});

test('muscle continuation stays inside a small palm overlap and all geometry stops at the elbow', () => {
    for (const angle of [-1.3,0,1.3]) for (const layer of ['skeleton','muscles']) {
        const geometry=createForearmGeometry(bentHand(angle),{elbow},w,h,{layer});
        assert.ok(geometry.overlap>=0&&geometry.overlap<=12&&geometry.overlap<=geometry.length*.035);
        if(layer==='skeleton')assert.equal(geometry.overlap,0);
        else assert.ok(geometry.overlap>0,'the palm heel must overlap the tendon continuation');
        const beyond=geometry.at(5),end=geometry.at(1);
        close(Math.hypot(beyond.x-end.x,beyond.y-end.y),geometry.overlap);
        for(const p of geometry.clipPolygon) {
            const elbowDistance=(p.x-geometry.elbow.x)*geometry.forward.x+(p.y-geometry.elbow.y)*geometry.forward.y;
            assert.ok(elbowDistance>=-1e-7,'the clipping outline must not extend above the observed elbow');
        }
        assert.deepEqual(geometry.at(-1),geometry.elbow);
    }
});

test('missing or collapsed wrist geometry does not invent a forearm orientation', () => {
    const hand=bentHand(0);
    const missing=hand.map(p=>({...p}));missing[9].x=NaN;
    const collapsed=hand.map(p=>({...p}));collapsed[17]={...collapsed[5]};
    for(const candidate of [[],missing,collapsed])assert.equal(createForearmGeometry(candidate,{elbow},w,h),null);
});

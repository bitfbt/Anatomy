import test from 'node:test';
import assert from 'node:assert/strict';
import {matchForearm} from '../src/services/forearmAnatomy.js';
test('matches forearms by proximity and rejects duplicate, hidden and ambiguous arms',()=>{
 const hand=Array.from({length:21},()=>({x:.5,y:.5}));hand[5]={x:.4,y:.4};hand[17]={x:.6,y:.4};hand[9]={x:.5,y:.35};
 const pose=Array.from({length:33},()=>({x:0,y:0,visibility:0}));
 pose[15]={x:.51,y:.5,visibility:1};pose[13]={x:.55,y:.85,visibility:1};
 const used=new Set();assert.ok(matchForearm(hand,pose,500,700,undefined,used));
 assert.equal(matchForearm(hand,pose,500,700,undefined,used),null);
 pose[13].visibility=.1;assert.equal(matchForearm(hand,pose,500,700),null);
 pose[13].visibility=1;pose[15].x=.95;assert.equal(matchForearm(hand,pose,500,700),null);
 pose[15].x=.5;pose[16]={...pose[15]};pose[14]={...pose[13]};assert.equal(matchForearm(hand,pose,500,700),null);
});

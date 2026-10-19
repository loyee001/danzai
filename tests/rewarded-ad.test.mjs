import test from 'node:test';
import assert from 'node:assert/strict';
import {RewardedAdSession} from '../dist/rewarded-ad.js';
import {Game} from '../dist/engine.js';
import {grantItems} from '../dist/gadgets.js';
const frame=(ad,seconds,visible=true)=>{for(let i=0;i<Math.round(seconds*60);i++)ad.tick(1/60,visible);};
test('local preview must finish visibly before its reward can be claimed, exactly once',()=>{
 const ad=new RewardedAdSession();assert.equal(ad.claim(),false);frame(ad,5);assert.equal(ad.remaining,1);assert.equal(ad.ready,false);frame(ad,1);assert.equal(ad.ready,true);assert.equal(ad.claim(),true);assert.equal(ad.claim(),false);
});
test('hidden time, cancellation and stale sessions cannot produce rewards',()=>{
 const ad=new RewardedAdSession();frame(ad,3);frame(ad,60,false);assert.equal(ad.remaining,3);ad.tick(200);assert.ok(ad.elapsed<=3.25+1e-8,'a resumed frame does not count a long absence');ad.cancel();frame(ad,10);assert.equal(ad.claim(),false);const next=new RewardedAdSession();assert.equal(next.elapsed,0);assert.equal(next.claim(),false);
});
test('the first resumed frame cannot finish an almost-complete advertisement',()=>{
 const ad=new RewardedAdSession();frame(ad,5.95);ad.suspend();ad.tick(.1,true);assert.equal(ad.ready,false);assert.ok(ad.elapsed<6);frame(ad,.05);assert.equal(ad.ready,true);
});
test('an earned preview grants usable items within inventory limits without advancing a paused game',()=>{
 const g=new Game({id:1,spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[{id:0,x:0,z:0,y:0,w:40,d:40,type:'plain'}],walls:[],hazards:[],beans:[],portals:[],requiredScore:10});g.start();assert.equal(g.action('jetpack'),true);g.pause();const before=g.time,ad=new RewardedAdSession();frame(ad,6);assert.equal(ad.claim(),true);assert.deepEqual(grantItems(g,{jetpack:1,electricBox:1,grapple:2}),{jetpack:1,electricBox:1,grapple:2});assert.equal(g.gadgets.inventory.jetpack,3);assert.equal(g.time,before);g.start();for(let i=0;i<960;i++)g.step(1/120);assert.equal(g.action('electricBox'),true);grantItems(g,{jetpack:100,electricBox:100,grapple:100});assert.deepEqual(g.gadgets.inventory,{jetpack:9,electricBox:9,grapple:9});
});

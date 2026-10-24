import test from 'node:test';
import assert from 'node:assert/strict';
import {RewardedAdSession} from '../dist/rewarded-ad.js';
import {Game} from '../dist/engine.js';
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
test('a finished preview replenishes ground supplies and grants nothing until the player walks back to collect',()=>{
 const g=new Game({id:1,spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[{id:0,x:0,z:0,y:0,w:40,d:40,type:'plain'}],walls:[],hazards:[],beans:[],portals:[],requiredScore:10,gadgetPickups:[{id:'box',x:3,z:0,y:0,gadget:'crate',amount:1}]});
 g.start();assert.equal(g.gadgets.inventory.crate,0);assert.equal(g.action('crate'),false);
 for(let i=0;i<90&&g.gadgets.inventory.crate===0;i++)g.step(1/120,{x:1,z:0});
 assert.equal(g.gadgets.inventory.crate,1);assert.equal(g.gadgetPickups[0].available,false);assert(g.action('crate'));
 for(let i=0;i<90;i++)g.step(1/120,{x:-1,z:0});g.pause();const before=g.time,ad=new RewardedAdSession();frame(ad,6);assert(ad.claim());assert.equal(g.replenishGadgetPickups(),1);
 assert.equal(g.gadgets.inventory.crate,0);assert.equal(g.gadgetPickups[0].available,true);assert.equal(g.time,before);
 g.start();for(let i=0;i<180&&g.gadgets.inventory.crate===0;i++)g.step(1/120,{x:1,z:0});assert.equal(g.gadgets.inventory.crate,1);assert.equal(g.gadgetPickups[0].available,false);
});

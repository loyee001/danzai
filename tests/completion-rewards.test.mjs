import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,platformPose} from '../dist/engine.js';
import {makeLevel} from '../dist/levels.js';
import {COMPLETION_REWARD_ITEMS,grantItems,spawnCompletionReward} from '../dist/gadgets.js';
const DT=1/120;
const floor=(id=0,x=0,z=0,y=0,w=80,d=80)=>({id,x,z,y,w,d,type:'plain'});
const fixture=extra=>({id:1,code:'REWARD',mode:'arena',arena:{open:false},spawn:{x:0,y:0,z:0},spawnPlatform:0,platforms:[floor()],walls:[],hazards:[],beans:[{id:0,x:6,z:0,y:.75,value:1}],portals:[],monsters:[],shields:[],gadgetPickups:[],challengePortals:[{id:'enter-lava',challengeId:'lava',x:0,y:0,z:12,radius:1.4}],totalBeans:1,totalScore:1,requiredScore:1,bounds:{minX:-50,maxX:50,minZ:-50,maxZ:50},...extra});
const start=extra=>{const g=new Game(fixture(extra));g.start();return g;};
const movement=(g,t)=>{const dx=t.x-g.player.x,dz=t.z-g.player.z;return {x:Math.max(-1,Math.min(1,dx*2)),z:Math.max(-1,Math.min(1,dz*2))};};
function tick(g,seconds){for(let i=0;i<Math.ceil(seconds/DT);i++)g.step(DT);}
function walk(g,target,{stop=.12,until=()=>false}={}){for(let i=0;i<1600;i++){if(until()||Math.hypot(target.x-g.player.x,target.z-g.player.z)<stop)return true;if(g.status!=='playing')return false;g.step(DT,movement(g,target));if(g.respawnDelay)return false;}return false;}
function win(g){assert(walk(g,{x:6,z:0},{until:()=>g.status==='won'}));assert.equal(g.status,'won');}
const totals=g=>Object.fromEntries(Object.keys(COMPLETION_REWARD_ITEMS).map(type=>[type,g.gadgetPickups.filter(p=>p.reward&&p.available&&p.gadget===type).reduce((sum,p)=>sum+p.amount,0)]));
const rewardCount=g=>g.events.filter(e=>e.type==='rewardSpawned').length;
function jumpTo(g,target){const current=g.level.platforms.find(p=>p.id===g.player.ground),pose=platformPose(current,g.time),dx=target.x-pose.x,dz=target.z-pose.z,d=Math.hypot(dx,dz),ux=dx/d,uz=dz/d,edge=Math.min(Math.abs(ux)>.001?current.w/2/Math.abs(ux):Infinity,Math.abs(uz)>.001?current.d/2/Math.abs(uz):Infinity)-.7;assert(walk(g,{x:pose.x+ux*edge,z:pose.z+uz*edge}));assert(g.action('jump'));for(let i=0;i<600;i++){const x=target.x-g.player.x,z=target.z-g.player.z,length=Math.hypot(x,z);g.step(DT,length>.12?{x:x/length,z:z/length}:{x:0,z:0});if(g.level.mode!=='challenge')return true;if(g.respawnDelay)return false;if(g.player.ground===target.platformId&&length<.6)return true;}return false;}
function enter(g){assert(walk(g,g.level.challengePortals[0],{until:()=>g.level.mode==='challenge'}));assert.equal(g.level.mode,'challenge');}
function finish(g){let before;const route=[...g.level.routeWaypoints.slice(1)];for(const [index,target]of route.entries()){if(index===route.length-1)before={...g.gadgets.inventory};assert(jumpTo(g,target));}if(g.level.mode==='challenge')assert(walk(g,g.level.finishPortal,{until:()=>g.level.mode!=='challenge'}));assert.equal(g.level.mode,'arena');return before;}

test('ordinary completion spawns four real rewards without granting inventory, and continuation never repeats settlement',()=>{
 const g=start();assert(Object.values(g.gadgets.inventory).every(n=>n===0));assert.equal(g.lastCompletionReward,null);win(g);assert.deepEqual(totals(g),COMPLETION_REWARD_ITEMS);assert.equal(g.gadgetPickups.filter(p=>p.reward).length,4);assert(Object.values(g.gadgets.inventory).every(n=>n===0));assert.equal(rewardCount(g),1);const event=g.events.find(e=>e.type==='win');assert.equal(event.reward.remaining,5);assert.equal(event.reward.spawned,4);assert.equal(g.hasCompleted,true);const settled=g.completedElapsed;tick(g,2);assert.equal(g.elapsed,settled);assert(g.continueAfterWin());assert.equal(g.continueAfterWin(),false);tick(g,1);assert.equal(g.completedElapsed,settled);assert.equal(g.events.filter(e=>e.type==='win').length,1);assert.equal(rewardCount(g),1);
 const reward=g.gadgetPickups.find(p=>p.reward&&p.gadget==='crate');assert(walk(g,reward));assert.equal(g.gadgets.inventory.crate,2);assert.equal(reward.available,false);assert.equal(g.lastCompletionReward.remaining,3);assert(g.events.some(e=>e.type==='gadgetCollected'&&e.reward&&e.gadget==='crate'));
});

test('a full or nearly full bag leaves uncollected units in place and advertisements cannot duplicate completion gifts',()=>{
 const g=start();grantItems(g,{crate:8});win(g);assert(g.continueAfterWin());const pickup=g.gadgetPickups.find(p=>p.reward&&p.gadget==='crate');assert(walk(g,pickup));assert.equal(g.gadgets.inventory.crate,9);assert.equal(pickup.amount,1);assert.equal(pickup.available,true);assert.equal(g.lastCompletionReward.remaining,4);tick(g,.3);assert.equal(pickup.amount,1);assert.equal(g.replenishGadgetPickups(),0);assert.equal(pickup.amount,1);g.pause();tick(g,.3);assert.equal(pickup.amount,1);g.start();assert(g.action('crate'));tick(g,.02);assert.equal(g.gadgets.inventory.crate,9);assert.equal(pickup.amount,0);assert.equal(pickup.available,false);assert.equal(g.replenishGadgetPickups(),0);assert.equal(g.lastCompletionReward.remaining,3);
});

test('ordinary partial supplies keep their remainder and an ad restores their original amount',()=>{
 const g=start({beans:[],requiredScore:100,gadgetPickups:[{id:'ordinary',x:3,y:0,z:0,gadget:'fish',amount:3}]});grantItems(g,{fish:8});assert(walk(g,{x:3,z:0}));const p=g.gadgetPickups[0];assert.equal(p.amount,2);assert.equal(p.baseAmount,3);assert(p.available);assert.equal(g.gadgets.inventory.fish,9);assert.equal(g.replenishGadgetPickups(),1);assert.equal(p.amount,3);assert.equal(g.replenishGadgetPickups(),0);
});

test('pending rewards survive next-map load and restart exactly once, with zero new inventory',()=>{
 const g=start();win(g);assert(g.continueAfterWin());const crate=g.gadgetPickups.find(p=>p.reward&&p.gadget==='crate');assert(walk(g,crate));const remaining={crate:0,grapple:1,jetpack:1,fish:1};assert.deepEqual(totals(g),remaining);const id=g.lastCompletionReward.id;
 for(let n=2;n<=4;n++){g.load(fixture({id:n,code:`REWARD-${n}`,beans:[],requiredScore:100}));assert(Object.values(g.gadgets.inventory).every(x=>x===0));assert.deepEqual(totals(g),remaining);assert.equal(g.lastCompletionReward.id,id);assert.equal(g.lastCompletionReward.remaining,3);assert.equal(rewardCount(g),0);g.start();}
 g.restart();assert.deepEqual(totals(g),remaining);assert.equal(g.lastCompletionReward.remaining,3);assert.equal(rewardCount(g),0);
});

test('reward snapshots isolate both the ledger and nested pickup reward ids',()=>{
 const g=start();win(g);const snap=g.snapshot();snap.lastCompletionReward.items.crate=99;snap.lastCompletionReward.locations[0].x=999;snap.gadgetPickups.find(p=>p.reward).rewardIds.length=0;assert.equal(g.lastCompletionReward.items.crate,2);assert(g.lastCompletionReward.locations[0].x!==999);assert.equal(g.gadgetPickups.find(p=>p.reward).rewardIds.length,1);
});

test('an actual golden challenge finish pays on the restored arena, while exits/retries/repeated frame checks do not pay again',()=>{
 const g=start({beans:[],requiredScore:100});enter(g);const arenaPickups=g._arenaState.state.gadgetPickups,beforeFinish=finish(g);assert.equal(g.gadgetPickups,arenaPickups);assert.deepEqual(totals(g),COMPLETION_REWARD_ITEMS);assert.deepEqual(g.gadgets.inventory,beforeFinish,'golden completion does not grant items into the bag');assert.equal(g.events.filter(e=>e.type==='challengeComplete').length,1);assert.equal(g.events.find(e=>e.type==='challengeComplete').reward.source,'challenge');assert.equal(rewardCount(g),1);tick(g,.2);assert.equal(rewardCount(g),1);assert.equal(g.exitChallenge({completed:true}),false);
 assert(walk(g,g.level.spawn));enter(g);assert(g.retryChallenge());assert.equal(rewardCount(g),1);assert(g.exitChallenge());assert.equal(rewardCount(g),1);const beforeSecond=Object.fromEntries(Object.keys(COMPLETION_REWARD_ITEMS).map(type=>[type,totals(g)[type]+g.gadgets.inventory[type]]));assert(walk(g,g.level.spawn));enter(g);finish(g);assert.equal(rewardCount(g),2);for(const type of Object.keys(COMPLETION_REWARD_ITEMS))assert.equal(totals(g)[type]+g.gadgets.inventory[type],beforeSecond[type]+COMPLETION_REWARD_ITEMS[type]);assert.equal(g.gadgetPickups.filter(p=>p.reward).length,4,'repeated genuine completions reuse four fixed pads');
});

test('normal arena reward pads avoid beans, doors, monsters and other supplies in representative maps',()=>{
 for(const id of [1,501,1000]){const g=new Game(makeLevel(id));g.start();const inventory={...g.gadgets.inventory};const original=[...g.gadgetPickups];const record=spawnCompletionReward(g,{source:'fixture'});assert.equal(record.spawned,4);assert.deepEqual(g.gadgets.inventory,inventory);for(const p of g.gadgetPickups.filter(p=>p.reward)){assert(g.level.platforms.some(q=>q.id===p.platformId&&['plain','checkpoint'].includes(q.type)));assert(Math.hypot(p.x,p.z)>=2.4);assert(g.level.beans.every(b=>Math.hypot(p.x-b.x,p.z-b.z)>=(b.radius??.6)+1.45));assert([...g.level.portals,...g.level.challengePortals].every(q=>Math.hypot(p.x-q.x,p.z-q.z)>=q.radius+1.5));assert(original.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>=2.1));}}
});

test('a fallback supply merges without losing its original unit or duplicating it across later loads',()=>{
 const g=start({beans:[],requiredScore:100,platforms:[floor(0,0,0,0,2,2),floor(1,4,0,0,1.5,1.5)],challengePortals:[],gadgetPickups:[{id:'single-safe-crate',x:4,y:0,z:0,gadget:'crate',amount:1,platformId:1}]});
 const record=spawnCompletionReward(g,{source:'fixture'}),merged=g.gadgetPickups.find(p=>p.gadget==='crate');assert.equal(merged.id,'single-safe-crate');assert.equal(merged.amount,3);assert(merged.reward);assert.equal(record.remaining,5);assert.equal(record.spawned,1);assert.equal(g.replenishGadgetPickups(),0);assert.equal(merged.amount,3);
 g.load(fixture({id:2,beans:[],requiredScore:100}));assert.deepEqual(totals(g),{crate:3,grapple:1,jetpack:1,fish:1});assert.equal(g.lastCompletionReward.remaining,5);g.start();const crate=g.gadgetPickups.find(p=>p.reward&&p.gadget==='crate');assert(walk(g,crate));assert.equal(g.gadgets.inventory.crate,3);assert.equal(g.lastCompletionReward.remaining,3);g.load(fixture({id:3,beans:[],requiredScore:100}));assert.deepEqual(totals(g),{crate:0,grapple:1,jetpack:1,fish:1});assert.equal(g.lastCompletionReward.remaining,3);
});

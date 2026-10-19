import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {LEVELS} from '../dist/levels.js';

const bean=(id,x,value=5,extra={})=>({id,x,z:0,y:1.2,radius:1.2,value,respawn:30,...extra});
const fixture=(beans,extra={})=>({id:1,code:'REFRESH',spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[{id:0,x:0,z:0,w:120,d:40,y:0,type:'plain'}],walls:[],hazards:[],portals:[],monsters:[],beans,totalBeans:beans.length,totalScore:beans.reduce((sum,b)=>sum+Math.max(0,b.value),0),requiredScore:10000,bounds:{minX:-60,maxX:60,minZ:-20,maxZ:20},...extra});
const step=g=>g.step(1/120);
const tick=(g,seconds)=>{for(let i=0;i<Math.round(seconds*120);i++)step(g);};
const until=(g,predicate,input={x:0,z:0},seconds=40)=>{for(let i=0;i<seconds*120&&!predicate();i++)g.step(1/120,input);assert.ok(predicate(),'real movement or game time reaches the expected state');};
const start=level=>{const g=new Game(level);g.start();step(g);return g;};

test('positive beans reappear after exactly 30 game seconds and each pickup starts a new timer',()=>{
 const g=start(fixture([bean(0,0)])),deadline=g.beanRespawns.get(0);assert.equal(g.score,5);assert.equal(deadline-g.time,30);
 until(g,()=>g.player.x>4,{x:1,z:0});tick(g,.2);until(g,()=>g.time>=deadline-.02);assert.ok(g.collected.has(0));
 until(g,()=>!g.collected.has(0));assert.ok(g.time>=deadline-1e-9&&g.time<deadline+1/120);assert.equal(g.score,5);assert.equal(g.beanRespawns.size,0);assert.equal(g.snapshot().beansRemaining,1);
 until(g,()=>g.beanPickups===2,{x:-1,z:0});assert.equal(g.score,10);assert.ok(g.beanRespawns.get(0)>deadline);assert.equal(g.snapshot().beanRefreshes[0].refreshIn,30);
 assert.deepEqual(g.events.filter(e=>e.type==='beanReady').map(e=>e.ids),[[0]]);
});

test('pausing and winning freeze bean refresh timers',()=>{
 const g=start(fixture([bean(0,0)]));until(g,()=>g.player.x>4,{x:1,z:0});g.pause();const frozen=g.snapshot();tick(g,35);assert.deepEqual(g.snapshot(),frozen);g.start();until(g,()=>!g.collected.has(0));assert.equal(g.score,5);
 const won=start(fixture([bean(0,0)],{requiredScore:5})),snapshot=won.snapshot();assert.equal(won.status,'won');tick(won,35);assert.deepEqual(won.snapshot(),snapshot);
});

test('zero immediately restores positives and cancels old timers while traps remain spent',()=>{
 const g=start(fixture([bean(0,0),bean(1,6,-10,{effect:'subtract',respawn:30}),bean(2,12,0,{effect:'zero',respawn:30})]));const oldDeadline=g.beanRespawns.get(0);
 until(g,()=>g.collected.has(2),{x:1,z:0});assert.equal(g.score,0);assert.equal(g.collected.has(0),false);assert.equal(g.beanRespawns.size,0,'even explicit trap respawn fields cannot schedule a trap');
 until(g,()=>g.beanPickups===4,{x:-1,z:0});const newDeadline=g.beanRespawns.get(0);assert.equal(g.score,5);assert.ok(newDeadline>oldDeadline);until(g,()=>g.player.x>4,{x:1,z:0});tick(g,.2);
 until(g,()=>g.time>=oldDeadline+.05);assert.ok(g.collected.has(0),'the canceled original timer cannot revive the new pickup early');assert.equal(g.beanRespawns.get(0),newDeadline);
 until(g,()=>!g.collected.has(0));assert.ok(g.collected.has(1));assert.ok(g.collected.has(2));assert.equal(g.events.filter(e=>e.type==='beanReady').length,1);
});

test('manual return and portal travel preserve timers; restarting and changing maps clear them',()=>{
 const level=fixture([bean(0,0)],{portals:[{id:0,x:10,z:0,y:0,radius:1,target:1,platformId:0,label:'A'},{id:1,x:30,z:0,y:0,radius:1,target:0,platformId:0,label:'A'}]}),g=start(level),deadline=g.beanRespawns.get(0);
 until(g,()=>g.portalUses===1,{x:1,z:0});assert.equal(g.beanRespawns.get(0),deadline);assert.equal(g.score,5);g.respawn();assert.equal(g.beanRespawns.get(0),deadline);assert.equal(g.score,5);
 g.restart();assert.equal(g.time,0);assert.equal(g.beanRespawns.size,0);assert.equal(g.score,0);step(g);assert.equal(g.beanRespawns.size,1);
 g.load(fixture([bean(10,12)],{id:2,code:'REFRESH2'}));assert.equal(g.beanRespawns.size,0);assert.equal(g.collected.size,0);assert.equal(g.score,0);
});

test('a refreshed 1000-point bean awards its full value each time and can complete the goal',()=>{
 const g=start(fixture([bean(0,0,1000,{radius:2.2,y:2.2})],{requiredScore:2500}));assert.equal(g.score,1000);until(g,()=>g.status==='won',undefined,65);assert.equal(g.score,3000);assert.equal(g.beanPickups,3);assert.deepEqual(g.events.filter(e=>e.type==='bean').map(e=>e.delta),[1000,1000,1000]);assert.equal(g.events.filter(e=>e.type==='win').length,1);
});

test('1000-point beans unlock after map 500 and only positive generated beans refresh',()=>{
 for(const id of [1,100,101,500,501,910,1000]){
  const level=LEVELS[id-1],thousand=level.beans.filter(b=>b.value===1000);
  assert.equal(thousand.length,id>500?1:0,`map ${id} premium boundary`);
  for(const b of level.beans)if(b.value>0)assert.equal(b.respawn,30);else assert.equal(b.respawn,undefined);
  if(id>100){assert.equal(level.beans.filter(b=>b.value===100).length,1);assert.equal(level.beans.filter(b=>b.value===500).length,1);}
 }
});

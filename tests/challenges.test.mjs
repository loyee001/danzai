import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,platformPose} from '../dist/engine.js';
import {makeLevel} from '../dist/levels.js';
import {CHALLENGES,makeChallenge,withChallengePortals} from '../dist/challenges.js';

const DT=1/120;
function walk(game,target,{limit=1600,stop=.18,expectedMode=game.level.mode}={}){
 for(let i=0;i<limit;i++){
  if(game.level.mode!==expectedMode)return true;
  const dx=target.x-game.player.x,dz=target.z-game.player.z,d=Math.hypot(dx,dz);
  if(d<stop)return true;
  game.step(DT,{x:dx/d,z:dz/d});
  if(game.status!=='playing')return false;
 }
 return false;
}
function settle(game,seconds=.15){for(let i=0;i<seconds/DT;i++)game.step(DT,{x:0,z:0});}
function enter(game,id){
 game.start();const portal=game.level.challengePortals.find(p=>p.challengeId===id);assert(portal,'visible entrance exists');
 assert(walk(game,portal));assert.equal(game.level.mode,'challenge');assert.equal(game.level.challenge.id,id);
}
function jumpTo(game,target){
 const current=game.level.platforms.find(p=>p.id===game.player.ground);assert(current,'jump begins on a platform');
 const pose=platformPose(current,game.time),dx=target.x-pose.x,dz=target.z-pose.z,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
 const edge=Math.min(Math.abs(ux)>.001?current.w/2/Math.abs(ux):Infinity,Math.abs(uz)>.001?current.d/2/Math.abs(uz):Infinity)-.7;
 assert(walk(game,{x:pose.x+ux*edge,z:pose.z+uz*edge},{limit:500,stop:.13}));
 assert(game.action('jump'));
 for(let i=0;i<600;i++){
  const x=target.x-game.player.x,z=target.z-game.player.z,d=Math.hypot(x,z);
  game.step(DT,d>.12?{x:x/d,z:z/d}:{x:0,z:0});
  if(game.level.mode!=='challenge')return true;
  if(game.respawnDelay)return false;
  if(game.player.ground===target.platformId&&d<.6)return true;
 }
 return false;
}

test('three entrance doors decorate the runtime level without mutating ordinary maps or paired portals',()=>{
 for(const id of [1,500,501,1000]){
  const base=makeLevel(id),original=JSON.stringify(base),runtime=withChallengePortals(base);
  assert.equal(runtime.challengePortals.length,3);assert.equal(JSON.stringify(base),original);assert.equal(runtime.portals,base.portals);
  assert.deepEqual(runtime.challengePortals.map(p=>p.challengeId),CHALLENGES.map(c=>c.id));
  assert(runtime.challengePortals.every(p=>p.label.startsWith('闯关入口 · ')&&p.radius===1.4));
 }
});

test('entrance requires real proximity; challenge freezes and restores the same Game and normal runtime',()=>{
 const game=new Game(makeLevel(500)),same=game;game.start();assert.equal(game.enterChallenge('lava'),false);
 assert(walk(game,game.level.beans[0]));settle(game);assert(game.score>0);assert(game.beanRespawns.size>0);
 enter(game,'lava');const saved=game._arenaState.state,normalTime=saved.time,normalScore=saved.score,normalTimers=[...saved.beanRespawns],normalMonsterState=JSON.stringify(saved.monsters),normalGadgets=JSON.stringify(saved.gadgets);
 settle(game,2);assert.equal(saved.time,normalTime);assert.deepEqual([...saved.beanRespawns],normalTimers);
 assert.equal(game.exitChallenge(),true);assert.equal(game,same);assert.equal(game.time,normalTime);assert.equal(game.score,normalScore);assert.deepEqual([...game.beanRespawns],normalTimers);assert.equal(JSON.stringify(game.monsters),normalMonsterState);assert.equal(JSON.stringify(game.gadgets),normalGadgets);
 settle(game,.2);assert.equal(game.level.mode,'arena','standing in the return doorway does not immediately re-enter');assert(!game.events.some(e=>e.type==='win'));
});

test('lava is an actual fail surface and death restores the last physical checkpoint',()=>{
 const game=new Game(makeLevel(500));enter(game,'lava');
 for(const target of game.level.routeWaypoints.slice(1,4))assert(jumpTo(game,target));
 const checkpoint={...game.checkpoint},checkpointId=game.checkpointId;assert.equal(checkpointId,3);
 const inventory={...game.gadgets.inventory};
 for(let i=0;i<240&&!game.falls;i++)game.step(DT,{x:1,z:0});assert(game.falls>0);
 for(let i=0;i<120&&game.respawnDelay;i++)game.step(DT,{x:0,z:0});
 assert.equal(game.checkpointId,checkpointId);assert.equal(game.player.x,checkpoint.x);assert.equal(game.player.z,checkpoint.z);assert.deepEqual(game.gadgets.inventory,inventory);
});

test('lava route finishes through real jump and walk inputs, never through score or a win event',()=>{
 const game=new Game(makeLevel(500));enter(game,'lava');game.score=99999;settle(game,.1);assert.equal(game.level.mode,'challenge');
 for(const target of [...game.level.routeWaypoints.slice(1)])assert(jumpTo(game,target),`reach platform ${target.platformId}`);
 if(game.level.mode==='challenge')assert(walk(game,game.level.finishPortal));assert.equal(game.level.mode,'arena');
 assert(game.events.some(e=>e.type==='challengeComplete'&&e.challengeId==='lava'));assert(!game.events.some(e=>e.type==='win'));
});

test('moving platforms and hazards permit a real route with visible safe sides',()=>{
 const game=new Game(makeLevel(500));enter(game,'platforms');
 const route=game.level.routeWaypoints.slice(1).map(p=>({...p,...(p.platformId===1?{x:2.8}:p.platformId===5?{x:3.3}:{})}));
 for(const target of route)assert(jumpTo(game,target),`reach platform ${target.platformId}`);
 if(game.level.mode==='challenge')assert(walk(game,game.level.finishPortal));assert(game.events.some(e=>e.type==='challengeComplete'&&e.challengeId==='platforms'));
});

test('grapple islands can be crossed with three actual gadget uses and keep the cost on return',()=>{
 const game=new Game(makeLevel(500));enter(game,'grapple');assert.equal(game.gadgets.inventory.grapple,3);
 const route=[...game.level.routeWaypoints.slice(1)];
 for(const target of route){
  const dx=target.x-game.player.x,dz=target.z-game.player.z,d=Math.hypot(dx,dz);game.step(DT,{x:dx/d,z:dz/d});assert(game.action('grapple'));
  let landed=false;
  for(let i=0;i<700;i++){game.step(DT,{x:0,z:0});if(game.level.mode!=='challenge'){landed=true;break;}if(!game.gadgets.grapple&&game.player.ground===target.platformId){landed=true;break;}if(game.respawnDelay)break;}
  assert(landed,`grapple landing ${target.platformId}`);
 }
 if(game.level.mode==='challenge')assert(walk(game,game.level.finishPortal));assert(game.events.some(e=>e.type==='challengeComplete'&&e.challengeId==='grapple'));assert.equal(game.gadgets.inventory.grapple,0);
});

test('walking through the exit door returns without completion and preserves challenge item costs',()=>{
 const game=new Game(makeLevel(500));enter(game,'lava');const inventory=game._arenaState.state.gadgets.inventory;
 assert.equal(game.gadgets.inventory,inventory);assert(game.action('electricBox'));assert.equal(inventory.electricBox,2);
 assert(game.retryChallenge());assert.equal(game.gadgets.inventory,inventory);assert.equal(inventory.electricBox,2);assert.equal(game.gadgets.electricBoxes.length,0);
 assert(walk(game,game.level.exitPortal));assert.equal(game.level.mode,'arena');assert.equal(game.gadgets.inventory,inventory);assert.equal(inventory.electricBox,2);assert.equal(game.gadgets.electricBoxes.length,0);
 assert(game.events.some(e=>e.type==='challengeExit'&&!e.completed));assert(!game.events.some(e=>e.type==='challengeComplete'));
 assert(walk(game,game.level.spawn));enter(game,'lava');assert.equal(game.gadgets.inventory,inventory);assert.equal(inventory.electricBox,2);
});

test('retry resets only the challenge and ordinary loading discards the old challenge session',()=>{
 const game=new Game(makeLevel(500));enter(game,'lava');const saved=game._arenaState;game.falls=3;assert(game.retryChallenge());assert.equal(game.falls,0);assert.equal(game.checkpointId,0);assert.equal(game._arenaState,saved);
 game.load(makeLevel(501));assert.equal(game.level.id,501);assert.equal(game.exitChallenge(),false);assert.equal(game.level.mode,'arena');
});

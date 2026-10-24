import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,platformPose} from '../dist/engine.js';
import {makeLevel} from '../dist/levels.js';
import {CHALLENGES,makeChallenge,withChallengePortals} from '../dist/challenges.js';

const DT=1/120;
function movement(game,target){
 const p=game.player,support=game.level.platforms.find(q=>q.id===p.ground),accel=support?.type==='ice'?5:p.ground!==null?60:30;
 let carryX=support?.type==='conveyor'&&support.axis==='x'?support.dir*3.4:0,carryZ=support?.type==='conveyor'&&support.axis!=='x'?support.dir*3.4:0;
 const wind=game.level.platforms.find(q=>q.type==='wind'&&Math.abs(p.z-q.z)<q.d/2+2&&Math.abs(p.x-q.x)<q.w/2+3&&p.y<q.y+8);
 if(wind&&!support?.checkpoint)carryX+=wind.dir*2.9;
 const axis=(delta,carry)=>Math.max(-1,Math.min(1,(Math.sign(delta)*Math.min(7.5,Math.sqrt(2*accel*Math.abs(delta)))*.72-carry)/7.5));
 return {x:axis(target.x-p.x,carryX),z:axis(target.z-p.z,carryZ)};
}
function walk(game,target,{limit=1600,stop=.18,expectedMode=game.level.mode}={}){
 for(let i=0;i<limit;i++){
  if(game.level.mode!==expectedMode)return true;
  const dx=target.x-game.player.x,dz=target.z-game.player.z,d=Math.hypot(dx,dz);
  if(d<stop)return true;
  game.step(DT,movement(game,target));
  if(game.status!=='playing')return false;
 }
 return false;
}
function settle(game,seconds=.15){for(let i=0;i<seconds/DT;i++)game.step(DT,{x:0,z:0});}
function enter(game,id){
 game.start();if(!game.level.challengePortals.some(p=>p.challengeId===id))assert(game.chooseChallenge(id));const portal=game.level.challengePortals.find(p=>p.challengeId===id);assert(portal,'visible entrance exists');
 assert(walk(game,portal));assert.equal(game.level.mode,'challenge');assert.equal(game.level.challenge.id,id);
}
function jumpTo(game,target){
 const current=game.level.platforms.find(p=>p.id===game.player.ground);assert(current,'jump begins on a platform');
 const pose=platformPose(current,game.time),dx=target.x-pose.x,dz=target.z-pose.z,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
 const edge=Math.min(Math.abs(ux)>.001?current.w/2/Math.abs(ux):Infinity,Math.abs(uz)>.001?current.d/2/Math.abs(uz):Infinity)-.7;
 assert(walk(game,{x:pose.x+ux*edge,z:pose.z+uz*edge},{limit:500,stop:.13}),`${game.level.challenge?.id} cannot approach jump ${current.id} to ${target.platformId}: ${JSON.stringify({x:game.player.x,z:game.player.z,ground:game.player.ground})}`);
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
  assert.deepEqual(runtime.challengePortals.map(p=>p.challengeId),CHALLENGES.slice(0,3).map(c=>c.id));
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

test('grapple islands start with zero inventory and each crossing uses a real floor pickup',()=>{
 const game=new Game({...makeLevel(500),gadgetPickups:[]});assert.deepEqual(game.gadgets.inventory,{jetpack:0,crate:0,grapple:0,fish:0});enter(game,'grapple');
 for(const segment of [...game.level.routeSegments])assert(crossGrapple(game,segment));
 if(game.level.mode==='challenge')assert(walk(game,game.level.finishPortal));assert(game.events.some(e=>e.type==='challengeComplete'&&e.challengeId==='grapple'));assert.equal(game.gadgets.inventory.grapple,0);
});

function crossGrapple(game,segment){
 const pickup=game.gadgetPickups.find(p=>p.platformId===segment.from&&p.gadget==='grapple'&&p.available);assert(pickup,'a safe island supplies the required grapple');
 assert(walk(game,pickup));assert(!pickup.available);assert(game.gadgets.inventory.grapple>=1);
 const target=game.level.routeWaypoints.find(p=>p.platformId===segment.to),dx=target.x-game.player.x,dz=target.z-game.player.z,d=Math.hypot(dx,dz);game.step(DT,{x:dx/d,z:dz/d});assert(game.action('grapple'));
 for(let i=0;i<700;i++){game.step(DT,{x:0,z:0});if(game.level.mode!=='challenge')return true;if(!game.gadgets.grapple&&game.player.ground===target.platformId)return true;if(game.respawnDelay)return false;}
 return false;
}

test('walking through the exit preserves consumed pickups and inventory across retry and reentry',()=>{
 const game=new Game({...makeLevel(500),gadgetPickups:[]});enter(game,'lava');const inventory=game._arenaState.state.gadgets.inventory,pickup=game.gadgetPickups.find(p=>p.gadget==='crate');
 assert.equal(inventory.crate,0);assert(walk(game,pickup));assert.equal(inventory.crate,1);assert(!pickup.available);assert(walk(game,game.level.spawn));assert(game.action('crate'));assert.equal(inventory.crate,0);
 assert(game.retryChallenge());assert.equal(game.gadgets.inventory,inventory);assert.equal(inventory.crate,0);assert.equal(game.gadgets.crates.length,0);assert(!game.gadgetPickups.find(p=>p.id===pickup.id).available);
 assert(walk(game,game.level.exitPortal));assert.equal(game.level.mode,'arena');assert.equal(game.gadgets.inventory,inventory);assert.equal(inventory.crate,0);assert.equal(game.gadgets.crates.length,0);
 assert(game.events.some(e=>e.type==='challengeExit'&&!e.completed));assert(!game.events.some(e=>e.type==='challengeComplete'));
 assert(walk(game,game.level.spawn));enter(game,'lava');assert.equal(game.gadgets.inventory,inventory);assert.equal(inventory.crate,0);assert(!game.gadgetPickups.find(p=>p.id===pickup.id).available);
});

test('retry resets only the challenge and ordinary loading discards the old challenge session',()=>{
 const game=new Game(makeLevel(500));enter(game,'lava');const saved=game._arenaState;game.falls=3;assert(game.retryChallenge());assert.equal(game.falls,0);assert.equal(game.checkpointId,0);assert.equal(game._arenaState,saved);
 game.load(makeLevel(501));assert.equal(game.level.id,501);assert.equal(game.exitChallenge(),false);assert.equal(game.level.mode,'arena');
});


test('fifty numbered challenges have distinct route geometry, safe landings and enough reachable grapple pickups',()=>{
 const base=makeLevel(1),signatures=new Set(),themes=new Set();assert.equal(CHALLENGES.length,50);assert.equal(new Set(CHALLENGES.map(c=>c.id)).size,50);assert.equal(new Set(CHALLENGES.map(c=>c.name)).size,50);
 assert.deepEqual(CHALLENGES.slice(0,3).map(c=>c.id),['lava','platforms','grapple']);
 for(const [index,definition]of CHALLENGES.entries()){
  assert.equal(definition.number,index+1);themes.add(definition.theme);assert(definition.instruction);const level=makeChallenge(base,definition.id);assert.deepEqual(level,makeChallenge(base,definition.id),'generation is deterministic');
  const byId=new Map(level.platforms.map(p=>[p.id,p]));assert.equal(byId.size,level.platforms.length);assert.equal(level.routeSegments.length,level.platforms.length-1);assert(level.platforms.filter(p=>p.checkpoint).length>=2);
  signatures.add(JSON.stringify({platforms:level.platforms.map(p=>[p.x,p.y,p.z,p.w,p.d,p.type,p.amp,p.dir]),hazards:level.hazards.map(h=>[h.type,h.x,h.z,h.w,h.speed])}));
  const reached=new Set([level.spawnPlatform]);let grapples=0;
  for(const step of level.routeSegments){
   assert(reached.has(step.from));const a=byId.get(step.from),b=byId.get(step.to);assert(a&&b);reached.add(step.to);
   if(step.kind==='grapple'){
    grapples++;assert(a.checkpoint);assert(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<27);assert(level.grappleAnchors.some(anchor=>anchor.platformId===b.id));assert(level.gadgetPickups.some(p=>p.gadget==='grapple'&&p.platformId===a.id&&p.amount>=1));assert(!['moving','collapse'].includes(b.type));
   }else{
    const dx=Math.max(0,Math.abs(a.x-b.x)-(a.w+b.w)/2),dz=Math.max(0,Math.abs(a.z-b.z)-(a.d+b.d)/2);assert(Math.hypot(dx,dz)<=4.8,`${definition.id}: jump gap`);assert(b.y-a.y<=.65,`${definition.id}: reachable rise`);
   }
  }
  assert(reached.has(level.platforms.at(-1).id));assert.equal(level.gadgetPickups.filter(p=>p.gadget==='grapple').length,grapples);
  assert.equal(new Set(level.gadgetPickups.map(p=>p.id)).size,level.gadgetPickups.length);
  for(const pickup of level.gadgetPickups){const floor=byId.get(pickup.platformId);assert(floor);assert.equal(pickup.y,floor.y);assert.equal(pickup.amount,1);assert(['grapple','crate','jetpack','fish'].includes(pickup.gadget));assert(Math.abs(pickup.x-floor.x)<floor.w/2-.7&&Math.abs(pickup.z-floor.z)<floor.d/2-.7);assert(!['collapse','moving','ice','wind','conveyor'].includes(floor.type));assert(Math.hypot(pickup.x,pickup.z)>=1.5);assert(Math.hypot(pickup.x-level.exitPortal.x,pickup.z-level.exitPortal.z)>level.exitPortal.radius+1);}
  const final=level.platforms.at(-1);assert.equal(level.finishPortal.y,final.y);assert(Math.abs(level.finishPortal.x-final.x)<final.w/2&&Math.abs(level.finishPortal.z-final.z)<final.d/2);assert(level.bounds.maxZ>level.finishPortal.z);
 }
 assert.equal(themes.size,10);assert.equal(signatures.size,50,'every challenge changes actual terrain or mechanisms');
});

test('the lobby can target any three challenges without adding more entrance doors or changing their safe positions',()=>{
 const base=makeLevel(500),ordinary=withChallengePortals(base),ids=[CHALLENGES[49].id,CHALLENGES[28].id,CHALLENGES[12].id],selected=withChallengePortals(ordinary,{challengeIds:ids});
 assert.equal(selected.challengePortals.length,3);assert.deepEqual(selected.challengePortals.map(p=>p.challengeId),ids);assert.deepEqual(selected.challengePortals.map(({x,y,z})=>({x,y,z})),ordinary.challengePortals.map(({x,y,z})=>({x,y,z})));assert.equal(selected.portals,base.portals);assert.equal(withChallengePortals(selected),selected);
 assert.throws(()=>withChallengePortals(base,{challengeIds:['missing']}),RangeError);
 const game=new Game({...base,gadgetPickups:[]});game.start();const position={x:game.player.x,z:game.player.z};assert(game.chooseChallenge(ids[0]));assert.equal(game.level.mode,'arena');assert.deepEqual({x:game.player.x,z:game.player.z},position);assert.equal(game.enterChallenge(ids[0]),false);enter(game,ids[0]);assert.equal(game.level.challenge.number,50);
});

test('representative routes from all ten themes and the last chapter finish using real movement and floor supplies',()=>{
 for(const number of [4,5,6,7,8,9,10,13,22,29,40,43,49,50]){
  const definition=CHALLENGES[number-1],game=new Game({...makeLevel(500),gadgetPickups:[]});enter(game,definition.id);
  for(const segment of [...game.level.routeSegments]){
   if(game.level.mode!=='challenge')break;
   const target=game.level.routeWaypoints.find(p=>p.platformId===segment.to);
   assert(segment.kind==='grapple'?crossGrapple(game,segment):jumpTo(game,target),`${definition.id}: reach ${segment.to}`);
  }
  if(game.level.mode==='challenge')assert(walk(game,game.level.finishPortal));assert(game.events.some(e=>e.type==='challengeComplete'&&e.challengeId===definition.id),`${definition.id}: real finish`);assert(!game.events.some(e=>e.type==='win'));assert.equal(game.falls,0);
 }
});

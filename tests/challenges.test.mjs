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
function jumpTo(game,target,{portalBefore}={}){
 const current=game.level.platforms.find(p=>p.id===game.player.ground);assert(current,'jump begins on a platform');
 const pose=platformPose(current,game.time),dx=target.x-pose.x,dz=target.z-pose.z,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
 const edge=Math.min(Math.abs(ux)>.001?current.w/2/Math.abs(ux):Infinity,Math.abs(uz)>.001?current.d/2/Math.abs(uz):Infinity)-.7;
 assert(walk(game,{x:pose.x+ux*edge,z:pose.z+uz*edge},{limit:500,stop:.13}),`${game.level.challenge?.id} cannot approach jump ${current.id} to ${target.platformId}: ${JSON.stringify({x:game.player.x,z:game.player.z,ground:game.player.ground})}`);
 assert(game.action('jump'));
 for(let i=0;i<600;i++){
  const x=target.x-game.player.x,z=target.z-game.player.z,d=Math.hypot(x,z);
  game.step(DT,d>.12?{x:x/d,z:z/d}:{x:0,z:0});
  if(game.level.mode!=='challenge')return true;
  if(portalBefore!==undefined&&game.portalUses>portalBefore)return true;
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
 const pickup=game.gadgetPickups.find(p=>p.platformId===segment.from&&p.gadget==='grapple');assert(pickup,'a safe island supplies the required grapple');
 if(pickup.available)assert(walk(game,pickup));assert(!pickup.available);assert(game.gadgets.inventory.grapple>=1);
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
  const byId=new Map(level.platforms.map(p=>[p.id,p]));assert.equal(byId.size,level.platforms.length);assert.equal(level.routeSegments.length,level.routeWaypoints.length-1);assert(level.platforms.filter(p=>p.checkpoint).length>=2);
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
  assert(reached.has(level.platforms.at(-1).id));assert.equal(level.gadgetPickups.filter(p=>p.gadget==='grapple'&&!p.shortcut).length,grapples);
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

test('every sky challenge has a separate floating wooden-box route and three walkable crate supplies',()=>{
 const base=makeLevel(1),skies=CHALLENGES.filter(c=>c.theme==='sky');assert.deepEqual(skies.map(c=>c.number),[3,13,23,33,43]);
 for(const definition of skies){
  const level=makeChallenge(base,definition.id),boxes=level.platforms.filter(p=>p.type==='airCrate'),primaryIds=new Set(level.routeWaypoints.map(p=>p.platformId));
  assert.equal(boxes.length,2);assert.match(level.challenge.instruction,/空中垫箱 · 跳起按 X/);assert.match(level.hint,/空中垫箱/);
  assert.equal(level.platforms.at(-1).id,level.routeWaypoints.at(-1).platformId,'original finish stays the final platform');
  for(const box of boxes){
   assert(Number.isInteger(box.id));assert.equal(box.optional,true);assert.equal(box.w,2);assert.equal(box.d,2);assert.equal(box.h,1.25);assert(Math.abs(box.y-box.baseY-box.h)<1e-9);assert(box.baseY>0);assert(!primaryIds.has(box.id));assert(!level.routeSegments.some(s=>s.from===box.id||s.to===box.id));
   assert(level.grappleAnchors.some(a=>a.platformId===box.id));assert(level.platforms.filter(p=>primaryIds.has(p.id)).every(p=>Math.abs(p.x-box.x)>=(p.w+box.w)/2||Math.abs(p.z-box.z)>=(p.d+box.d)/2),'floating boxes do not replace or cover a primary island');
  }
  const pickups=level.gadgetPickups.filter(p=>p.gadget==='crate');assert.equal(pickups.length,3);assert.equal(pickups.filter(p=>p.platformId===level.spawnPlatform).length,2);
  for(const pickup of pickups){assert.equal(pickup.amount,1);assert(primaryIds.has(pickup.platformId));const floor=level.platforms.find(p=>p.id===pickup.platformId);assert.equal(floor.type,'checkpoint');assert.equal(pickup.y,floor.y);assert(Math.abs(pickup.x-floor.x)<floor.w/2-1&&Math.abs(pickup.z-floor.z)<floor.d/2-1);}
  const route=level.optionalRoutes.find(r=>r.id==='air-crate-detour');assert.deepEqual(route.platformIds,[0,...boxes.map(p=>p.id),1]);
 }
});

test('all five sky detours can be reached by a picked-up grapple, stood on and jumped back to the primary checkpoint',()=>{
 for(const definition of CHALLENGES.filter(c=>c.theme==='sky')){
  const game=new Game({...makeLevel(500),gadgetPickups:[]});enter(game,definition.id);assert.equal(game.gadgets.inventory.crate,0);assert.equal(game.gadgets.inventory.grapple,0);
  for(const pickup of game.gadgetPickups.filter(p=>p.gadget==='crate'&&p.platformId===0))assert(walk(game,pickup));assert.equal(game.gadgets.inventory.crate,2);
  assert(walk(game,game.gadgetPickups.find(p=>p.gadget==='grapple'&&p.platformId===0)));assert.equal(game.gadgets.inventory.grapple,1);
  const ids=game.level.optionalRoutes[0].platformIds,boxes=ids.slice(1,3).map(id=>game.level.platforms.find(p=>p.id===id)),first=boxes[0],dx=first.x-game.player.x,dz=first.z-game.player.z,d=Math.hypot(dx,dz);
  game.step(DT,{x:dx/d,z:dz/d});assert(game.action('grapple'));assert.equal(game.gadgets.grapple.target.platformId,first.id,`${definition.id}: grapple selects the wooden box`);
  for(let i=0;i<700&&(game.gadgets.grapple||game.player.ground!==first.id)&&!game.respawnDelay;i++)game.step(DT);
  assert.equal(game.player.ground,first.id);settle(game,.4);assert.equal(game.player.ground,first.id);assert.equal(game.player.y,first.y);assert.equal(game.gadgets.inventory.grapple,0);
  assert(jumpTo(game,{...boxes[1],platformId:boxes[1].id}),`${definition.id}: jump between floating boxes`);settle(game,.3);assert.equal(game.player.ground,boxes[1].id);assert.equal(game.player.y,boxes[1].y);
  const island=game.level.platforms.find(p=>p.id===ids.at(-1));assert(jumpTo(game,{...island,platformId:island.id}),`${definition.id}: rejoin the normal island`);assert.equal(game.checkpointId,island.id);
  const supply=game.gadgetPickups.find(p=>p.gadget==='crate'&&p.platformId===island.id);assert(walk(game,supply));assert.equal(game.gadgets.inventory.crate,3);assert.equal(game.falls,0);
 }
});

test('all fifty challenges keep unlabelled dead ends that can be jumped back without altering the main route',()=>{
 const base=makeLevel(1);
 for(const definition of CHALLENGES){
  const level=makeChallenge(base,definition.id),primaryIds=new Set(level.routeWaypoints.map(p=>p.platformId)),byId=new Map(level.platforms.map(p=>[p.id,p]));
  assert(level.decoyRoutes.length>=1&&level.decoyRoutes.length<=2);assert.equal(level.signs.length,0);assert.doesNotMatch(level.hint,/真正捷径|近路？|断头路|回跳/);
  assert.equal(level.platforms.at(-1).id,level.routeWaypoints.at(-1).platformId);
  for(const route of level.decoyRoutes){
   const [source,first,last]=route.platformIds.map(id=>byId.get(id));assert(source.checkpoint);assert(primaryIds.has(source.id));assert.equal(route.returnPlatformId,source.id);assert(route.deadEnd);
   assert.equal(first.type,'plain');assert.equal(last.type,'collapse');
   for(const p of [first,last]){
    assert(p.optional&&p.decoy);assert(!p.checkpoint);assert(!primaryIds.has(p.id));assert(!level.routeSegments.some(s=>s.from===p.id||s.to===p.id));assert(!level.gadgetPickups.some(g=>g.platformId===p.id));
    assert(level.platforms.filter(q=>!q.decoy).every(q=>Math.abs(q.x-p.x)>=(q.w+p.w)/2||Math.abs(q.z-p.z)>=(q.d+p.d)/2),`${definition.id}: false trail does not cover a primary/wooden-box landing`);
   }
   for(const [a,b]of [[source,first],[first,last]]){const dx=Math.max(0,Math.abs(a.x-b.x)-(a.w+b.w)/2),dz=Math.max(0,Math.abs(a.z-b.z)-(a.d+b.d)/2);assert(Math.hypot(dx,dz)<=1.8);assert(Math.abs(a.y-b.y)<=.2);}
  }
  for(const hazard of level.hazards.filter(h=>h.decoy))assert(level.platforms.filter(p=>primaryIds.has(p.id)).every(p=>Math.hypot(Math.max(0,Math.abs(hazard.x-p.x)-p.w/2),Math.max(0,Math.abs(hazard.z-p.z)-p.d/2))>hazard.w/2+1),'optional sweeper cannot reach the primary route');
 }
});

test('the sky false trail can be abandoned, really collapses underfoot and still allows finishing from its checkpoint',()=>{
 const game=new Game({...makeLevel(500),gadgetPickups:[]});enter(game,'grapple');assert(crossGrapple(game,game.level.routeSegments[0]));
 const route=game.level.decoyRoutes[0],[source,first,last]=route.platformIds.map(id=>game.level.platforms.find(p=>p.id===id)),target=p=>({...p,platformId:p.id});
 const starts=game.events.filter(e=>e.type==='gadgetStart').length;
 assert(jumpTo(game,target(first)));assert(jumpTo(game,target(last)));assert(game.collapse.has(last.id),'stepping on the false ending starts collapse');
 assert(jumpTo(game,target(first)),'recognizing the cracks permits an immediate escape');assert(jumpTo(game,target(source)));assert.equal(game.falls,0);assert.equal(game.checkpointId,source.id);
 settle(game,9.2);assert(jumpTo(game,target(first)));assert(jumpTo(game,target(last)));
 const crackedAt=game.collapse.get(last.id);for(let i=0;i<600&&game.time-crackedAt<4.9;i++)game.step(DT);
 assert.equal(game.player.ground,last.id,'the cracked floor still supports players before five seconds');assert.equal(game.falls,0);
 for(let i=0;i<900&&!game.falls;i++)game.step(DT);assert.equal(game.falls,1);assert.equal(game.surface(last),false,'the fake floor disappears before the fall');
 assert(game.time-crackedAt>=5&&game.time-crackedAt<6.5);
 for(let i=0;i<120&&game.respawnDelay;i++)game.step(DT);assert.equal(game.player.ground,source.id);assert.equal(game.checkpointId,source.id);assert.equal(game.events.filter(e=>e.type==='gadgetStart').length,starts,'exploration and recovery consume no tools');
 for(const segment of [...game.level.routeSegments.filter(s=>s.from>=source.id)])assert(crossGrapple(game,segment));
 if(game.level.mode==='challenge')assert(walk(game,game.level.finishPortal));assert(game.events.some(e=>e.type==='challengeComplete'&&e.challengeId==='grapple'));
});

test('all fifty green shortcuts skip at least two main crossings and shorten physical travel by over a quarter',()=>{
 const base=makeLevel(1);let decoys=0;
 for(const definition of CHALLENGES){
  const level=makeChallenge(base,definition.id),route=level.shortcutRoutes[0],byId=new Map(level.platforms.map(p=>[p.id,p])),primaryIds=new Set(level.routeWaypoints.map(p=>p.platformId));
  assert.equal(level.shortcutRoutes.length,1);assert(route.skippedSegments>=2);assert(route.distanceRatio<=.75);assert.equal(route.skippedSegments,level.routeWaypoints.findIndex(p=>p.platformId===route.to)-level.routeWaypoints.findIndex(p=>p.platformId===route.from));
  const [source,gateway,arrival,target]=route.platformIds.map(id=>byId.get(id));assert.equal(source.id,route.from);assert.equal(target.id,route.to);assert(target.checkpoint);assert(target.id!==level.routeWaypoints.at(-1).platformId);
  assert.equal(route.segments[1].kind,'portal');assert.equal(route.segments[2].kind,'jump');assert.deepEqual(route.portalIds,level.portals.map(p=>p.id));
  for(const p of [gateway,arrival]){assert(p.shortcut&&p.optional);assert(!p.decoy);assert(!primaryIds.has(p.id));assert(!level.routeSegments.some(s=>s.from===p.id||s.to===p.id));assert(level.platforms.filter(q=>!q.shortcut).every(q=>Math.abs(q.x-p.x)>=(q.w+p.w)/2||Math.abs(q.z-p.z)>=(q.d+p.d)/2),`${definition.id}: shortcut stays clear of original platforms`);}
  for(const portal of level.portals){const floor=byId.get(portal.platformId);assert.equal(floor.y,portal.y);assert.equal(portal.x,floor.x);assert.equal(portal.z,floor.z);assert.equal(portal.color,'#63dfa0');assert(level.portals.some(other=>other.id===portal.target&&other.target===portal.id));}
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y),main=level.routeWaypoints.slice(0,route.skippedSegments+1).map(p=>byId.get(p.platformId));
  const mainDistance=main.slice(1).reduce((sum,p,i)=>sum+distance(main[i],p),0);assert(Math.abs(mainDistance-route.mainDistance)<.001);
  let travel=distance(source,gateway)+distance(arrival,target);const supplies=level.gadgetPickups.filter(p=>p.shortcut);
  if(route.segments[0].kind==='grapple'){assert.equal(supplies.length,1);const pickup=supplies[0];assert.equal(pickup.gadget,'grapple');assert.equal(pickup.platformId,source.id);assert(distance(pickup,gateway)<30);assert(level.grappleAnchors.some(a=>a.shortcut&&a.platformId===gateway.id));travel=distance(source,pickup)+distance(pickup,gateway)+distance(arrival,target);}else assert.equal(supplies.length,0);
  assert(Math.abs(travel-route.travelDistance)<.001);assert(Math.abs(travel/mainDistance-route.distanceRatio)<.001);
  assert.equal(level.signs.length,0);assert(level.portals.every(p=>p.label==='C'),'portal names do not reveal whether a path is a shortcut');
  decoys+=level.decoyRoutes.length;
 }
 assert.equal(decoys,75,'all existing false trails remain available');
});

test('green shortcuts across every theme work through actual jumps or picked-up grapples and lead to a real finish',()=>{
 for(const number of [1,2,3,4,5,6,7,8,9,10,13,23,43,50]){
  const definition=CHALLENGES[number-1],game=new Game({...makeLevel(500),gadgetPickups:[]});enter(game,definition.id);
  const shortcut=game.level.shortcutRoutes[0],byId=new Map(game.level.platforms.map(p=>[p.id,p])),gateway=byId.get(shortcut.platformIds[1]),arrival=byId.get(shortcut.platformIds[2]),target=byId.get(shortcut.to),portalBefore=game.portalUses;
  assert.equal(game.gadgets.inventory.grapple,0);
  if(shortcut.segments[0].kind==='grapple'){
   const pickup=game.gadgetPickups.find(p=>p.shortcut);assert(walk(game,pickup));assert.equal(game.gadgets.inventory.grapple,1);
   const dx=gateway.x-game.player.x,dz=gateway.z-game.player.z,d=Math.hypot(dx,dz);game.step(DT,{x:dx/d,z:dz/d});assert(game.action('grapple'));assert.equal(game.gadgets.grapple.target.platformId,gateway.id);
   for(let i=0;i<700&&game.portalUses===portalBefore&&!game.respawnDelay;i++)game.step(DT);
   assert.equal(game.gadgets.inventory.grapple,0);
  }else assert(jumpTo(game,{...gateway,platformId:gateway.id},{portalBefore}),`${definition.id}: narrow shortcut approach`);
  assert.equal(game.portalUses,portalBefore+1,`${definition.id}: physical entrance activates teleport`);assert.equal(game.player.ground,arrival.id);settle(game,.2);assert.equal(game.player.ground,arrival.id);assert.equal(game.checkpointId,arrival.id);
  assert(jumpTo(game,{...target,platformId:target.id}),`${definition.id}: return from shortcut to main path`);assert.equal(game.checkpointId,target.id);
  for(const segment of [...game.level.routeSegments.filter(s=>s.from>=shortcut.to)]){
   if(game.level.mode!=='challenge')break;const next=game.level.routeWaypoints.find(p=>p.platformId===segment.to);
   assert(segment.kind==='grapple'?crossGrapple(game,segment):jumpTo(game,next),`${definition.id}: complete remaining main route`);
  }
  if(game.level.mode==='challenge')assert(walk(game,game.level.finishPortal));assert(game.events.some(e=>e.type==='challengeComplete'&&e.challengeId===definition.id));assert.equal(game.falls,0);assert(!game.events.some(e=>e.type==='win'));
 }
});

test('an elevated shortcut exit can be walked back through after leaving its lock radius',()=>{
 const game=new Game({...makeLevel(500),gadgetPickups:[]});enter(game,'challenge-50');
 const route=game.level.shortcutRoutes[0],gateway=game.level.platforms.find(p=>p.id===route.platformIds[1]),arrival=game.level.platforms.find(p=>p.id===route.platformIds[2]);
 assert(arrival.y>1.4,'this return door is above the former absolute portal-height limit');
 assert(jumpTo(game,{...gateway,platformId:gateway.id},{portalBefore:0}));assert.equal(game.portalUses,1);assert.equal(game.player.ground,arrival.id);settle(game,.2);
 assert(walk(game,{x:arrival.x+1.6,z:arrival.z-1.6},{stop:.06}));settle(game,1.2);assert.equal(game.portalLock,null);assert.equal(game.portalUses,1);
 for(let i=0;i<400&&game.portalUses===1;i++)game.step(DT,movement(game,arrival));
 assert.equal(game.portalUses,2,'actual movement into the high return door travels back');assert.equal(game.player.ground,gateway.id);assert.equal(game.player.y,gateway.y);assert.equal(game.falls,0);
});

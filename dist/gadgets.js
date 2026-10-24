import {fishStrike} from './combat.js';
export const GADGETS=Object.freeze({
  jetpack:Object.freeze({name:'喷气背包',icon:'🚀',initial:0,max:9,duration:5,lift:6.5,maxHeight:12}),
  crate:Object.freeze({name:'垫脚箱',icon:'📦',initial:0,max:9,w:2,d:2,h:1.25,maxStack:3,maxActive:9}),
  grapple:Object.freeze({name:'钩爪',icon:'🪝',initial:0,max:9,range:30,speed:18,duration:3}),
  fish:Object.freeze({name:'咸鱼打击',icon:'🐟',initial:0,max:9,range:4.2})
});
const RADIUS=.43,GRAVITY=25,EPS=1e-8,lavaFloors=new WeakMap();
const isGadget=type=>Object.hasOwn(GADGETS,type);
const keys=Object.keys(GADGETS),distance=(a,b)=>Math.hypot(a.x-b.x,(a.y??0)-(b.y??0),a.z-b.z);
const point=p=>({x:p.x,y:p.y??0,z:p.z});
const emit=(game,type,data)=>game.emit?.(type,data);
const facing=p=>{const n=Math.hypot(p.faceX||0,p.faceZ||0);return n>.01?{x:p.faceX/n,z:p.faceZ/n}:{x:0,z:1};};

export function initGadgets(game,level=game.level){
  game.gadgets={inventory:Object.fromEntries(keys.map(k=>[k,GADGETS[k].initial])),selected:'jetpack',jetpack:null,grapple:null,crates:[],nextCrateId:0,fishSwing:0};
  game._gadgetPickupStates??=new Map();
  const scene=level.mode==='challenge'?`challenge:${level.challenge.id}`:'arena';
  if(!game._gadgetPickupStates.has(scene)){
    const source=level.gadgetPickups??generateGadgetPickups(game);
    game._gadgetPickupStates.set(scene,source.filter(p=>isGadget(p.gadget)&&Number.isFinite(p.x)&&Number.isFinite(p.z)).map((p,i)=>({...p,id:p.id??`${scene}-gadget-${i}`,y:p.y??0,amount:Math.max(1,Math.floor(p.amount??1)),available:true})));
  }
  game.gadgetPickups=game._gadgetPickupStates.get(scene);
  return game.gadgets;
}
export function cratePlatforms(game){return (game.gadgets?.crates||[]).map(c=>({id:c.id,x:c.x,z:c.z,y:c.y+c.h,w:c.w,d:c.d,type:'crate',checkpoint:false,baseY:c.y,crateId:c.id}));}
const platforms=game=>[...(game.level.platforms||[]),...cratePlatforms(game)];
const stateOf=game=>game.gadgets??initGadgets(game);

export function grantItems(game,items={}){
  const state=stateOf(game),added={};
  for(const key of keys){const n=Number.isFinite(items[key])?Math.max(0,Math.floor(items[key])):0;added[key]=Math.min(n,GADGETS[key].max-state.inventory[key]);state.inventory[key]+=added[key];}
  if(Object.values(added).some(Boolean))emit(game,'itemsGranted',{items:{...added},inventory:{...state.inventory}});
  return added;
}

// Pickups are world objects, not spawn gifts. Their availability is shared by
// all visits to a scene; retrying a challenge cannot duplicate its supplies.
export function collectGadgetPickups(game){
  if(game.status!=='playing'||game.respawnDelay)return;
  const state=stateOf(game),p=game.player;
  for(const pickup of game.gadgetPickups||[]){
    if(!pickup.available||Math.hypot(p.x-pickup.x,p.z-pickup.z)>=1||Math.abs(p.y-pickup.y)>=1.3)continue;
    const amount=Math.min(pickup.amount,GADGETS[pickup.gadget].max-state.inventory[pickup.gadget]);
    if(amount<=0)continue;
    state.inventory[pickup.gadget]+=amount;pickup.available=false;
    emit(game,'gadgetCollected',{id:pickup.id,gadget:pickup.gadget,amount,x:pickup.x,y:pickup.y,z:pickup.z});
  }
}
export function replenishGadgetPickups(game){
  let count=0;for(const pickup of game.gadgetPickups||[])if(!pickup.available){pickup.available=true;count++;}
  if(count)emit(game,'gadgetSuppliesReplenished',{count});return count;
}
function generateGadgetPickups(game){
  if(game.level.mode==='challenge')return [];
  const level=game.level,spawn=level.spawn,result=[],doors=[...(level.portals||[]),...(level.challengePortals||[]),level.exitPortal,level.finishPortal].filter(Boolean);
  const safe=point=>{
    const floor=(level.platforms||[]).find(q=>['plain','checkpoint'].includes(q.type)&&fits(point,q,.65)&&usableSurface(game,q));
    if(!floor)return null;const p={x:point.x,y:floor.y,z:point.z};
    if(Math.hypot(p.x-spawn.x,p.z-spawn.z)<2.4||inLava(game,p)||blocked(game,p,p,.75,1.6))return null;
    if(doors.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<(q.radius??1.4)+1.5)||(level.monsters||[]).some(q=>Math.hypot(p.x-q.x,p.z-q.z)<3))return null;
    if((level.hazards||[]).some(q=>Math.hypot(p.x-q.x,p.z-q.z)<Math.max(2.5,(q.w??0)/2+1.5,(q.range??0)+1.5)))return null;
    if((level.beans||[]).some(q=>Math.hypot(p.x-q.x,p.z-q.z)<(q.radius??.6)+.9)||(level.shields||[]).some(q=>Math.hypot(p.x-q.x,p.z-q.z)<1.8)||result.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<2.1))return null;
    return {...p,platformId:floor.id};
  };
  const near=[];
  for(let z=-6.8;z<=10.2;z+=1.7)for(let x=-10.2;x<=10.2;x+=1.7){const d=Math.hypot(x,z);if(d>=3&&d<=12)near.push({x:spawn.x+x,z:spawn.z+z,d,front:z>=0?0:1});}
  near.sort((a,b)=>a.front-b.front||a.d-b.d||Math.abs(a.x-spawn.x)-Math.abs(b.x-spawn.x)||a.x-b.x);
  const far=(level.platforms||[]).map(q=>({x:q.x,z:q.z,d:Math.hypot(q.x-spawn.x,q.z-spawn.z)})).sort((a,b)=>a.d-b.d||a.x-b.x||a.z-b.z);
  for(let n=0;n<12;n++){
    const candidates=n<4?near:far.filter(q=>q.d>=14+(n-4)*2);
    let p=null;for(const candidate of candidates){p=safe(candidate);if(p)break;}if(!p)continue;
    result.push({id:`arena-gadget-${n}`,gadget:keys[n%keys.length],amount:1,...p});
  }
  return result;
}

function segmentBox(a,b,box,padding=0,height=0){
  let near=0,far=1;
  for(const [origin,delta,min,max]of [[a.x,b.x-a.x,box.x-box.w/2-padding,box.x+box.w/2+padding],[a.z,b.z-a.z,box.z-box.d/2-padding,box.z+box.d/2+padding],[(a.y??0),(b.y??0)-(a.y??0),(box.y??0)-height,(box.y??0)+(box.h??2.65)]]){
    if(Math.abs(delta)<EPS){if(origin<min||origin>max)return false;continue;}
    let lo=(min-origin)/delta,hi=(max-origin)/delta;if(lo>hi)[lo,hi]=[hi,lo];near=Math.max(near,lo);far=Math.min(far,hi);if(near>far)return false;
  }
  return true;
}
function blocked(game,a,b,padding=RADIUS,height=1.6){
  for(const wall of game.level.walls||[])if(segmentBox(a,b,wall,padding,height))return true;
  for(const box of game.gadgets?.crates||[]){
    if(Math.min(a.y??0,b.y??0)>=box.y+box.h-EPS||Math.max(a.y??0,b.y??0)+height<=box.y+EPS)continue;
    if(segmentBox(a,b,box,padding,height))return true;
  }
  for(const h of game.level.hazards||[]){
    if(h.type!=='gate'||Math.sin(((game.time||0)*(h.speed??0)+(h.phase??0))*1.6)>.15)continue;
    if(segmentBox(a,b,{x:h.x,z:h.z,y:h.y??0,w:h.axis==='x'?.4:h.w,d:h.axis==='x'?h.w:.4,h:3.2},padding,height))return true;
  }
  return false;
}
function inLava(game,p){
  let floors=lavaFloors.get(game.level);if(!floors){floors=(game.level.platforms||[]).filter(f=>f.type==='lava');lavaFloors.set(game.level,floors);}
  const zones=game.level.lavaZones||[];if(!zones.length&&!floors.length)return false;
  return [...zones,...floors].some(zone=>(p.y??0)<=(zone.y??0)+.22&&(zone.radius!==undefined?Math.hypot(p.x-zone.x,p.z-zone.z)<=zone.radius:Math.abs(p.x-zone.x)<=zone.w/2&&Math.abs(p.z-zone.z)<=zone.d/2));
}
function usableSurface(game,p){return !['lava','void','collapse','moving'].includes(p.type)&&(!game.surface||game.surface(p));}
function fits(p,q,margin=.55){return Math.abs(p.x-q.x)<=q.w/2-margin&&Math.abs(p.z-q.z)<=q.d/2-margin;}
function supportAt(game,p){return platforms(game).filter(q=>usableSurface(game,q)&&fits(p,q)&&q.y<=(p.y??0)+.6).sort((a,b)=>b.y-a.y)[0];}
function safeTarget(game,p,platformId){
  const floor=platforms(game).find(q=>q.id===platformId);
  return floor&&usableSurface(game,floor)&&fits(p,floor)&&!inLava(game,{...p,y:floor.y+.08})?floor:null;
}
function route(game,target){
  const start=point(game.player),height=Math.max(start.y,target.y)+1.4;
  return [{x:start.x,y:height,z:start.z},{x:target.x,y:height,z:target.z},{...target}];
}
function routeClear(game,start,path){
  let from=start;
  for(const to of path){
    if(blocked(game,from,to))return false;
    const count=Math.max(1,Math.ceil(distance(from,to)/.35));
    for(let i=0;i<=count;i++){const t=i/count;if(inLava(game,{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t}))return false;}
    from=to;
  }
  return true;
}
function grappleTarget(game){
  const p=game.player,f=facing(p),candidates=[];
  const add=(x,z,floor,anchor,priority)=>{
    const target={x,y:floor.y+.08,z,platformId:floor.id},dx=x-p.x,dz=z-p.z,horizontal=Math.hypot(dx,dz),dot=horizontal?((dx*f.x+dz*f.z)/horizontal):-1;
    if(horizontal<4||distance(p,target)>GADGETS.grapple.range||Math.abs(target.y-p.y)>12||dot<.4||!safeTarget(game,target,floor.id))return;
    const path=route(game,target);if(!routeClear(game,point(p),path))return;
    candidates.push({target,anchor:anchor?{x:anchor.x,y:anchor.y??floor.y+3.5,z:anchor.z}:{x,y:floor.y+2,z},path,priority,score:(1-dot)*40+Math.abs(horizontal-20)*.2});
  };
  for(const anchor of game.level.grappleAnchors||[]){const floor=platforms(game).find(q=>q.id===anchor.platformId);if(floor)add(anchor.x,anchor.z,floor,anchor,0);}
  for(const n of [26,22,18,14,10,6]){const x=p.x+f.x*n,z=p.z+f.z*n;for(const floor of platforms(game))if(fits({x,z},floor))add(x,z,floor,null,1);}
  for(const floor of platforms(game))add(floor.x,floor.z,floor,null,1);
  candidates.sort((a,b)=>a.priority-b.priority||a.score-b.score);return candidates[0]??null;
}
function stopGrapple(game,reason){
  const state=stateOf(game);if(!state.grapple)return;
  state.grapple=null;game.player.vx=0;game.player.vz=0;game.player.vy=Math.min(0,game.player.vy||0);
  emit(game,'gadgetEnd',{gadget:'grapple',reason});
}

function overlap(a,b){return Math.abs(a.x-b.x)<(a.w+b.w)/2-EPS&&Math.abs(a.z-b.z)<(a.d+b.d)/2-EPS&&a.y<b.y+b.h-EPS&&a.y+a.h>b.y+EPS;}
function gateBox(h){return {x:h.x,z:h.z,y:h.y??0,w:h.axis==='x'?.4:h.w,d:h.axis==='x'?h.w:.4,h:3.2};}
function actorOverlap(box,p,radius){
  if((p.y??0)>=box.y+box.h-EPS||(p.y??0)+1.6<=box.y+EPS)return false;
  const dx=Math.max(Math.abs(p.x-box.x)-box.w/2,0),dz=Math.max(Math.abs(p.z-box.z)-box.d/2,0);return dx*dx+dz*dz<radius*radius-EPS;
}
function lavaOverlap(game,box){
  const zones=[...(game.level.lavaZones||[]),...(game.level.platforms||[]).filter(q=>q.type==='lava')];
  return zones.some(q=>box.y<=(q.y??0)+.22&&(q.radius!==undefined?Math.hypot(Math.max(Math.abs(box.x-q.x)-box.w/2,0),Math.max(Math.abs(box.z-q.z)-box.d/2,0))<q.radius:Math.abs(box.x-q.x)<(box.w+q.w)/2-EPS&&Math.abs(box.z-q.z)<(box.d+q.d)/2-EPS));
}
// Check the union of coplanar floor rectangles, so a crate can span tile seams
// without accepting even a small unsupported hole beneath its footprint.
function floorSupport(game,box,y){
  const left=box.x-box.w/2,right=box.x+box.w/2,back=box.z-box.d/2,front=box.z+box.d/2;
  const floors=(game.level.platforms||[]).filter(q=>usableSurface(game,q)&&Math.abs(q.y-y)<.025&&q.x+q.w/2>left+EPS&&q.x-q.w/2<right-EPS&&q.z+q.d/2>back+EPS&&q.z-q.d/2<front-EPS);
  if(!floors.length)return null;
  const xs=[...new Set([left,right,...floors.flatMap(q=>[Math.max(left,q.x-q.w/2),Math.min(right,q.x+q.w/2)])])].sort((a,b)=>a-b);
  const zs=[...new Set([back,front,...floors.flatMap(q=>[Math.max(back,q.z-q.d/2),Math.min(front,q.z+q.d/2)])])].sort((a,b)=>a-b);
  for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2;if(!floors.some(q=>Math.abs(x-q.x)<=q.w/2+EPS&&Math.abs(z-q.z)<=q.d/2+EPS))return null;}
  return floors.find(q=>Math.abs(box.x-q.x)<=q.w/2+EPS&&Math.abs(box.z-q.z)<=q.d/2+EPS)??floors[0];
}
function clearPlacement(game,box){
  const doors=[...(game.level.portals||[]),...(game.level.challengePortals||[]),game.level.exitPortal,game.level.finishPortal].filter(Boolean);
  if(doors.some(door=>{const dx=Math.max(Math.abs(box.x-door.x)-box.w/2,0),dz=Math.max(Math.abs(box.z-door.z)-box.d/2,0);return box.y<(door.y??0)+4.2&&box.y+box.h>(door.y??0)-.2&&dx*dx+dz*dz<((door.radius??1.4)+.1)**2;}))return false;
  if(lavaOverlap(game,box)||actorOverlap(box,game.player,RADIUS)||(game.monsters||[]).some(m=>!m.defeated&&actorOverlap(box,m,.65)))return false;
  const solids=[...(game.level.walls||[]).map(w=>({...w,y:w.y??0})),...(game.level.hazards||[]).filter(h=>h.type==='gate').map(gateBox),...(game.gadgets?.crates||[])];
  if(solids.some(q=>overlap(box,q)))return false;
  // The crate must also be reachable from the player's hand; closed or open gate
  // frames are not valid placement corridors. Lower boxes in its own stack are allowed.
  const hand={x:game.player.x,y:game.player.y+1,z:game.player.z},aim={x:box.x,y:box.y+box.h/2,z:box.z};
  for(const solid of solids){if(solid.id?.startsWith?.('crate-')&&Math.abs(solid.x-box.x)<EPS&&Math.abs(solid.z-box.z)<EPS)continue;if(segmentBox(hand,aim,solid,.05,0))return false;}
  return true;
}
function placeCrate(game){
  const state=stateOf(game),p=game.player,f=facing(p),spec=GADGETS.crate,ideal={x:p.x+f.x*2.3,z:p.z+f.z*2.3};
  const tops=state.crates.filter(c=>!state.crates.some(above=>above.platformId===c.id)).map(c=>({c,d:Math.hypot(c.x-p.x,c.z-p.z)})).filter(({c,d})=>d>spec.w/2+RADIUS+.04&&d<=4.2&&Math.hypot(c.x-ideal.x,c.z-ideal.z)<=1&&(c.x-p.x)*f.x+(c.z-p.z)*f.z>d*.65).sort((a,b)=>Math.hypot(a.c.x-ideal.x,a.c.z-ideal.z)-Math.hypot(b.c.x-ideal.x,b.c.z-ideal.z));
  if(tops.length){const top=tops[0].c;if(top.stackLevel>=spec.maxStack)return null;const box={id:`crate-${state.nextCrateId}`,x:top.x,z:top.z,y:top.y+top.h,w:spec.w,d:spec.d,h:spec.h,platformId:top.id,stackLevel:top.stackLevel+1};return clearPlacement(game,box)?box:null;}
  const choices=[ideal,...(game.level.platforms||[]).map(q=>({x:q.x,z:q.z}))].filter(q=>{const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);return d>=1.5&&d<=4.2&&Math.hypot(q.x-ideal.x,q.z-ideal.z)<=1.7&&(dx*f.x+dz*f.z)/d>.65;}).sort((a,b)=>Math.hypot(a.x-ideal.x,a.z-ideal.z)-Math.hypot(b.x-ideal.x,b.z-ideal.z));
  for(const q of choices){
    const heights=[...new Set((game.level.platforms||[]).filter(floor=>usableSurface(game,floor)&&floor.y<=p.y+.1&&p.y-floor.y<=4&&Math.abs(q.x-floor.x)<floor.w/2+spec.w/2&&Math.abs(q.z-floor.z)<floor.d/2+spec.d/2).map(floor=>floor.y))].sort((a,b)=>b-a);
    for(const y of heights){const box={id:`crate-${state.nextCrateId}`,x:q.x,z:q.z,y,w:spec.w,d:spec.d,h:spec.h,platformId:null,stackLevel:1},support=floorSupport(game,box,y);if(support){box.platformId=support.id;if(clearPlacement(game,box))return box;}}
  }
  return null;
}

export function useGadget(game,type){
  if(!isGadget(type)||game.status!=='playing'||game.respawnDelay||game.player.health<=0)return false;
  const state=stateOf(game),p=game.player;state.selected=type;
  if(type==='grapple'&&state.grapple){stopGrapple(game,'cancelled');return true;}
  if(state.inventory[type]<=0||inLava(game,p))return false;
  if(type==='jetpack'){
    if(state.jetpack||state.grapple)return false;
    const floor=platforms(game).find(q=>q.id===p.ground)??supportAt(game,p),baseY=floor?.y??0;
    state.jetpack={remaining:GADGETS.jetpack.duration,baseY,maxY:baseY+GADGETS.jetpack.maxHeight};
  }else if(type==='crate'){
    if(p.ground===null||p.ground===undefined||state.jetpack||state.grapple||state.crates.length>=GADGETS.crate.maxActive)return false;
    const placed=placeCrate(game);if(!placed)return false;
    state.crates.push(placed);state.nextCrateId++;
  }else if(type==='fish'){
    if(!fishStrike(game))return false;
    state.fishSwing=.42;
  }else{
    const selected=grappleTarget(game);if(!selected)return false;
    if(state.jetpack){state.jetpack=null;emit(game,'gadgetEnd',{gadget:'jetpack',reason:'grapple'});}
    state.grapple={state:'pulling',start:point(p),target:selected.target,anchor:selected.anchor,path:selected.path,pathIndex:0,remaining:GADGETS.grapple.duration};
    p.ground=null;p.roll=0;p.dive=0;p.coyote=0;p.jumpBuffer=0;
  }
  state.inventory[type]--;emit(game,'gadgetStart',{gadget:type,inventory:state.inventory[type]});return true;
}
export function gadgetAction(game,name){return isGadget(name)?useGadget(game,name):undefined;}

// Call after jump processing and before ordinary velocity acceleration. A controlled
// grapple already supplies velocity, including this step's gravity compensation;
// still run normal position integration, walls, gravity, landing and lava checks.
export function stepGadgets(game,dt){
  if(!Number.isFinite(dt)||dt<=0||game.status!=='playing'||game.respawnDelay)return {controlled:false};
  const state=stateOf(game),p=game.player;
  state.fishSwing=Math.max(0,state.fishSwing-dt);
  if(state.jetpack){
    const jet=state.jetpack;jet.remaining-=dt;
    if(jet.remaining<=EPS||inLava(game,p)){state.jetpack=null;p.vy=Math.min(0,p.vy||0);emit(game,'gadgetEnd',{gadget:'jetpack',reason:jet.remaining<=EPS?'expired':'lava'});}
    else{p.ground=null;p.coyote=0;p.roll=0;p.dive=0;p.vy=Math.max(-6,Math.min(GADGETS.jetpack.lift,(jet.maxY-p.y)/dt))+GRAVITY*dt;}
  }
  const hook=state.grapple;if(!hook)return {controlled:false};
  hook.remaining-=dt;
  if(hook.remaining<=EPS||!safeTarget(game,hook.target,hook.target.platformId)||!routeClear(game,point(p),hook.path.slice(hook.pathIndex))){stopGrapple(game,hook.remaining<=EPS?'expired':'blocked');return {controlled:false};}
  while(hook.pathIndex<hook.path.length&&distance(p,hook.path[hook.pathIndex])<.1)hook.pathIndex++;
  if(hook.pathIndex===hook.path.length){stopGrapple(game,'arrived');return {controlled:false};}
  const aim=hook.path[hook.pathIndex],d=distance(p,aim),speed=Math.min(GADGETS.grapple.speed,d/dt);
  p.vx=(aim.x-p.x)/d*speed;p.vz=(aim.z-p.z)/d*speed;p.vy=(aim.y-p.y)/d*speed+GRAVITY*dt;p.ground=null;p.coyote=0;p.roll=0;p.dive=0;p.jumpBuffer=0;
  return {controlled:true};
}
export function resetGadgetEffects(game){
  const state=game.gadgets;if(!state)return;
  if(state.grapple)stopGrapple(game,'reset');
  if(state.jetpack){state.jetpack=null;game.player.vy=Math.min(0,game.player.vy||0);emit(game,'gadgetEnd',{gadget:'jetpack',reason:'reset'});}
  if(state.crates.some(c=>c.id===game.player.ground)){game.player.ground=null;game.player.coyote=0;}
  state.crates=[];
  state.fishSwing=0;
}
export function snapshotGadgets(game){const state=stateOf(game);return {inventory:{...state.inventory},limits:Object.fromEntries(keys.map(k=>[k,GADGETS[k].max])),selected:state.selected,jetpack:state.jetpack?{...state.jetpack}:null,grapple:state.grapple?structuredClone(state.grapple):null,fishSwing:state.fishSwing,crates:state.crates.map(box=>({...box}))};}

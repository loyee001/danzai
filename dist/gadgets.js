export const GADGETS=Object.freeze({
  jetpack:Object.freeze({name:'喷气背包',icon:'🚀',initial:3,max:9,duration:5,lift:6.5,maxHeight:12}),
  electricBox:Object.freeze({name:'电箱',icon:'⚡',initial:3,max:9,duration:8,radius:5,pulseInterval:1,damage:1,maxActive:3}),
  grapple:Object.freeze({name:'钩爪',icon:'🪝',initial:3,max:9,range:30,speed:18,duration:3})
});
const RADIUS=.43,GRAVITY=25,EPS=1e-8,lavaFloors=new WeakMap();
const isGadget=type=>Object.hasOwn(GADGETS,type);
const keys=Object.keys(GADGETS),distance=(a,b)=>Math.hypot(a.x-b.x,(a.y??0)-(b.y??0),a.z-b.z);
const point=p=>({x:p.x,y:p.y??0,z:p.z});
const emit=(game,type,data)=>game.emit?.(type,data);
const facing=p=>{const n=Math.hypot(p.faceX||0,p.faceZ||0);return n>.01?{x:p.faceX/n,z:p.faceZ/n}:{x:0,z:1};};

export function initGadgets(game){
  game.gadgets={inventory:Object.fromEntries(keys.map(k=>[k,GADGETS[k].initial])),selected:'jetpack',jetpack:null,grapple:null,electricBoxes:[],nextBoxId:0};
  return game.gadgets;
}
const stateOf=game=>game.gadgets??initGadgets(game);

export function grantItems(game,items={}){
  const state=stateOf(game),added={};
  for(const key of keys){const n=Number.isFinite(items[key])?Math.max(0,Math.floor(items[key])):0;added[key]=Math.min(n,GADGETS[key].max-state.inventory[key]);state.inventory[key]+=added[key];}
  if(Object.values(added).some(Boolean))emit(game,'itemsGranted',{items:{...added},inventory:{...state.inventory}});
  return added;
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
function supportAt(game,p){return (game.level.platforms||[]).filter(q=>usableSurface(game,q)&&fits(p,q)&&q.y<=(p.y??0)+.6).sort((a,b)=>b.y-a.y)[0];}
function safeTarget(game,p,platformId){
  const floor=(game.level.platforms||[]).find(q=>q.id===platformId);
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
  for(const anchor of game.level.grappleAnchors||[]){const floor=(game.level.platforms||[]).find(q=>q.id===anchor.platformId);if(floor)add(anchor.x,anchor.z,floor,anchor,0);}
  for(const n of [26,22,18,14,10,6]){const x=p.x+f.x*n,z=p.z+f.z*n;for(const floor of game.level.platforms||[])if(fits({x,z},floor))add(x,z,floor,null,1);}
  for(const floor of game.level.platforms||[])add(floor.x,floor.z,floor,null,1);
  candidates.sort((a,b)=>a.priority-b.priority||a.score-b.score);return candidates[0]??null;
}
function stopGrapple(game,reason){
  const state=stateOf(game);if(!state.grapple)return;
  state.grapple=null;game.player.vx=0;game.player.vz=0;game.player.vy=Math.min(0,game.player.vy||0);
  emit(game,'gadgetEnd',{gadget:'grapple',reason});
}

export function useGadget(game,type){
  if(!isGadget(type)||game.status!=='playing'||game.respawnDelay||game.player.health<=0)return false;
  const state=stateOf(game),p=game.player;state.selected=type;
  if(type==='grapple'&&state.grapple){stopGrapple(game,'cancelled');return true;}
  if(state.inventory[type]<=0||inLava(game,p))return false;
  if(type==='jetpack'){
    if(state.jetpack||state.grapple)return false;
    const floor=(game.level.platforms||[]).find(q=>q.id===p.ground)??supportAt(game,p),baseY=floor?.y??0;
    state.jetpack={remaining:GADGETS.jetpack.duration,baseY,maxY:baseY+GADGETS.jetpack.maxHeight};
  }else if(type==='electricBox'){
    if(p.ground===null||p.ground===undefined||state.jetpack||state.grapple||state.electricBoxes.length>=GADGETS.electricBox.maxActive)return false;
    const f=facing(p),ideal={x:p.x+f.x*1.8,y:p.y,z:p.z+f.z*1.8};
    const choices=[ideal,...(game.level.platforms||[]).map(q=>({x:q.x,y:p.y,z:q.z}))].filter(q=>{const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);return d>=1&&d<=4.2&&Math.hypot(q.x-ideal.x,q.z-ideal.z)<=2&&(dx*f.x+dz*f.z)/d>.4;}).sort((a,b)=>distance(a,ideal)-distance(b,ideal));
    let place,floor;
    for(const q of choices){const candidate=supportAt(game,q);if(candidate&&Math.abs(candidate.y-p.y)<=.6&&!inLava(game,{...q,y:candidate.y+.05})&&!blocked(game,point(p),{...q,y:candidate.y+.05})){place=q;floor=candidate;break;}}
    if(!floor)return false;
    state.electricBoxes.push({id:state.nextBoxId++,x:place.x,y:floor.y+.05,z:place.z,platformId:floor.id,remaining:GADGETS.electricBox.duration,radius:GADGETS.electricBox.radius,nextPulse:0});
  }else{
    const selected=grappleTarget(game);if(!selected)return false;
    if(state.jetpack){state.jetpack=null;emit(game,'gadgetEnd',{gadget:'jetpack',reason:'grapple'});}
    state.grapple={state:'pulling',start:point(p),target:selected.target,anchor:selected.anchor,path:selected.path,pathIndex:0,remaining:GADGETS.grapple.duration};
    p.ground=null;p.roll=0;p.dive=0;p.coyote=0;p.jumpBuffer=0;
  }
  state.inventory[type]--;emit(game,'gadgetStart',{gadget:type,inventory:state.inventory[type]});return true;
}
export function gadgetAction(game,name){return isGadget(name)?useGadget(game,name):undefined;}

function damageEnemy(game,enemy){
  const shieldDamage=Math.min(enemy.shieldHP||0,GADGETS.electricBox.damage),damage=GADGETS.electricBox.damage-shieldDamage;
  enemy.shieldHP=(enemy.shieldHP||0)-shieldDamage;enemy.hp=Math.max(0,enemy.hp-damage);enemy.hitFlash=.25;enemy.provoked=4;
  emit(game,'monsterHit',{id:enemy.id,x:enemy.x,z:enemy.z,damage,shieldDamage,source:'electricBox'});
  if(enemy.hp===0&&!enemy.defeated){enemy.defeated=true;enemy.state='defeated';game.defeatedMonsters=(game.defeatedMonsters||0)+1;emit(game,'monsterDefeated',{id:enemy.id,rank:enemy.rank,tier:enemy.tier,enemyName:enemy.enemyName,x:enemy.x,z:enemy.z,source:'electricBox'});}
}

// Call after jump processing and before ordinary velocity acceleration. A controlled
// grapple already supplies velocity, including this step's gravity compensation;
// still run normal position integration, walls, gravity, landing and lava checks.
export function stepGadgets(game,dt){
  if(!Number.isFinite(dt)||dt<=0||game.status!=='playing'||game.respawnDelay)return {controlled:false};
  const state=stateOf(game),p=game.player;
  state.electricBoxes=state.electricBoxes.filter(box=>{
    box.remaining-=dt;const floor=safeTarget(game,box,box.platformId);
    if(box.remaining<=EPS||!floor){emit(game,'gadgetEnd',{gadget:'electricBox',id:box.id,reason:floor?'expired':'surface'});return false;}
    const nearby=(game.monsters||[]).filter(m=>!m.defeated&&Math.hypot(m.x-box.x,m.z-box.z)<=box.radius&&Math.abs((m.y??0)-box.y)<2.5&&!blocked(game,{x:box.x,y:box.y+.6,z:box.z},{x:m.x,y:(m.y??0)+.8,z:m.z},0,0));
    for(const enemy of nearby){enemy.stun=Math.max(enemy.stun||0,dt+.12);enemy.windup=0;enemy.dash=0;enemy.dashCooldown=Math.max(enemy.dashCooldown||0,1);enemy.state='stunned';}
    box.nextPulse-=dt;
    if(box.nextPulse<=EPS){box.nextPulse+=GADGETS.electricBox.pulseInterval;for(const enemy of nearby)damageEnemy(game,enemy);emit(game,'gadgetPulse',{id:box.id,x:box.x,y:box.y,z:box.z,radius:box.radius,hitIds:nearby.map(m=>m.id)});}
    return true;
  });
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
  state.electricBoxes=[];
}
export function snapshotGadgets(game){const state=stateOf(game);return {inventory:{...state.inventory},limits:Object.fromEntries(keys.map(k=>[k,GADGETS[k].max])),selected:state.selected,jetpack:state.jetpack?{...state.jetpack}:null,grapple:state.grapple?structuredClone(state.grapple):null,electricBoxes:state.electricBoxes.map(box=>({...box}))};}

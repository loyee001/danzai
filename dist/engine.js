import {initShields,refreshShields,collectShield} from './shields.js';
import {WEAPONS,initCombat,setWeapon,attack,updateCombat} from './combat.js';
import {makeChallenge,withChallengePortals} from './challenges.js';
import {initGadgets,gadgetAction,stepGadgets,resetGadgetEffects,snapshotGadgets} from './gadgets.js';
export {WEAPONS};
export const PHYSICS={walk:7.5,roll:14,jump:10.5,gravity:25,rollDuration:.85,rollCooldown:2.8,diveDuration:.3,diveCooldown:1.35,radius:.43};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const approach=(v,target,delta)=>v<target?Math.min(v+delta,target):Math.max(v-delta,target);
export function beanEffect(bean){return bean.effect==='zero'?'zero':bean.effect==='subtract'||bean.value<0?'subtract':'add';}
export function beanContact(player,bean){
 if(bean.radius>0){
  const base=bean.baseY??0;
  return Math.hypot(player.x-bean.x,player.z-bean.z)<bean.radius+PHYSICS.radius&&player.y+1.6>base&&player.y<base+bean.radius*2.5;
 }
 return Math.hypot(player.x-bean.x,player.z-bean.z)<.98&&Math.abs(player.y+.75-bean.y)<1.6;
}
export function platformPose(p,t){return {x:p.x+(p.type==='moving'?Math.sin(t*p.speed+p.phase)*p.amp:0),z:p.z,y:p.y};}
export function hazardPose(h,t){const q=t*h.speed+h.phase;return {x:h.x+(h.type==='pendulum'?Math.sin(q*1.8)*h.range:h.type==='bumper'?Math.sin(q)*h.range*.65:0),z:h.z,y:h.y,angle:q,open:h.type==='gate'&&Math.sin(q*1.6)>.15,extension:h.type==='pusher'?(Math.sin(q*1.5)+1)*.5:0};}
export class Game {
 constructor(level){this.load(level);}
 load(level,{preserveChallenge=false}={}){if(!preserveChallenge)delete this._arenaState;level=withChallengePortals(level);this.level=level;this.time=0;this.elapsed=0;this.status='ready';this.falls=0;this.collected=new Set();this.beanRespawns=new Map();this.beanPickups=0;this.score=0;this.switches=new Set();this.collapse=new Map();this.events=[];this.checkpoint={...level.spawn};this.checkpointId=level.spawnPlatform??0;this.respawnDelay=0;this.portalLock=null;this._challengeEntryLock=null;this.portalUses=0;this.lastGateTip=undefined;this.actionCounts={jump:0,roll:0,dive:0,attack:0};this.player={x:0,z:0,y:0,vx:0,vz:0,vy:0,faceX:0,faceZ:1,ground:0,coyote:.1,roll:0,rollCd:0,dive:0,diveCd:0,airDive:false,invuln:0,jumpBuffer:0,portalCd:0};initCombat(this,level);initShields(this,level);initGadgets(this,level);if(preserveChallenge&&this._arenaState?.state.gadgets)this.gadgets.inventory=this._arenaState.state.gadgets.inventory;this.respawn(true);}
 emit(type,data={}){this.events.push({type,...data});}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 enterChallenge(id){
  if(this.status!=='playing'||this.respawnDelay||this._arenaState||this.level.mode==='challenge')return false;
  const source=(this.level.challengePortals||[]).find(portal=>portal.challengeId===id),p=this.player;
  if(!source||this._challengeEntryLock===source.id||Math.hypot(p.x-source.x,p.z-source.z)>=source.radius||Math.abs(p.y-source.y)>1.3)return false;
  resetGadgetEffects(this);
  const pending=this.events,base=this.level,state={};for(const [key,value]of Object.entries(this))if(key!=='events'&&key!=='_arenaState')state[key]=value;
  state._challengeEntryLock=source.id;this._arenaState={state,challengeId:id};
  this.load(makeChallenge(base,id),{preserveChallenge:true});this.start();this.events=pending;
  this.emit('challengeEnter',{challengeId:id,name:this.level.challenge.name});return true;
 }
 exitChallenge({completed=false}={}){
  if(!this._arenaState)return false;
  const session=this._arenaState,challenge=this.level.challenge,pending=this.events;resetGadgetEffects(this);
  for(const key of Object.keys(this))delete this[key];Object.assign(this,session.state);this.events=pending;
  this.emit('challengeExit',{challengeId:challenge.id,name:challenge.name,completed});return true;
 }
 retryChallenge(){
  if(!this._arenaState)return false;
  resetGadgetEffects(this);
  const session=this._arenaState,pending=this.events,level=makeChallenge(session.state.level,session.challengeId);
  this.load(level,{preserveChallenge:true});this.start();this.events=pending;this.emit('challengeEnter',{challengeId:level.challenge.id,name:level.challenge.name,retry:true});return true;
 }
 respawn(initial=false){resetGadgetEffects(this);const p=this.player;Object.assign(p,{...this.checkpoint,vx:0,vz:0,vy:0,roll:0,dive:0,rollCd:0,diveCd:0,airDive:false,invuln:1,coyote:.12,jumpBuffer:0,portalCd:0,ground:this.checkpointId,health:3,attack:0,attackCd:0,shield:0});this.respawnDelay=0;this.projectiles=[];this.portalLock=null;this.collapse.clear();if(!initial)this.emit('respawn');}
 setWeapon(type){return setWeapon(this,type);}
 restart(){if(this.level.mode==='challenge')return this.retryChallenge();this.load(this.level);this.start();}
 action(action){if(this.status!=='playing'||this.respawnDelay)return false;const p=this.player;
  const gadget=gadgetAction(this,action);if(gadget!==undefined)return gadget;
  if(action==='attack')return attack(this);
  if(action==='jump'){p.jumpBuffer=.13;this.actionCounts.jump++;return true;}
  if(action==='roll'&&p.rollCd<=0&&p.ground!==null){this.actionCounts.roll++;p.roll=PHYSICS.rollDuration;p.rollCd=PHYSICS.rollCooldown;this.emit('roll');return true;}
  if(action==='dive'&&p.diveCd<=0&&!p.airDive){this.actionCounts.dive++;p.dive=PHYSICS.diveDuration;p.diveCd=PHYSICS.diveCooldown;p.airDive=true;p.vy=Math.max(p.vy,p.ground!==null?4:2.5);p.ground=null;p.coyote=0;this.emit('dive');return true;}
  return false;
 }
 fail(){if(this.respawnDelay)return;resetGadgetEffects(this);this.falls++;this.respawnDelay=.7;this.emit('fall');}
 refreshBeans(){
  const ids=[];
  for(const [id,at]of this.beanRespawns)if(this.time+1e-9>=at){this.beanRespawns.delete(id);if(this.collected.delete(id))ids.push(id);}
  if(ids.length)this.emit('beanReady',{ids});
 }
 surface(p,t=this.time){if(p.type==='bridge'&&!this.switches.has(p.switchId))return false;const c=this.collapse.get(p.id);return !(c!==undefined&&t-c>.85&&t-c<4.5);}
 step(dt,input={x:0,z:0}){if(this.status!=='playing')return;dt=Math.min(dt,1/30);this.time+=dt;this.elapsed+=dt;refreshShields(this);this.refreshBeans();const p=this.player;
  if(this.respawnDelay){this.respawnDelay-=dt;p.y-=dt*9;if(this.respawnDelay<=0)this.respawn();return;}
  for(const k of ['roll','rollCd','dive','diveCd','invuln','jumpBuffer','portalCd','attack','attackCd'])p[k]=Math.max(0,p[k]-dt);
  let support=this.level.platforms.find(q=>q.id===p.ground);
  if(support&&!this.surface(support)){p.ground=null;support=null;}
  if(support&&support.type==='moving'){const prev=platformPose(support,this.time-dt),now=platformPose(support,this.time);p.x+=now.x-prev.x;}
  p.coyote=p.ground!==null?.11:Math.max(0,p.coyote-dt);
  if(p.jumpBuffer>0&&p.coyote>0){p.vy=PHYSICS.jump;p.ground=null;p.coyote=0;p.jumpBuffer=0;this.emit('jump');}
  const gadgetStep=stepGadgets(this,dt);
  let ix=clamp(input.x||0,-1,1),iz=clamp(input.z||0,-1,1),mag=Math.hypot(ix,iz);if(mag>1){ix/=mag;iz/=mag;}
  if(mag>.08){p.faceX=ix/(mag>1?1:mag);p.faceZ=iz/(mag>1?1:mag);}
  let speed=p.roll>0?PHYSICS.roll:PHYSICS.walk;
  let tx=ix*speed,tz=iz*speed;
  if(p.roll>0&&mag<.08){tx=p.faceX*speed;tz=p.faceZ*speed;}
  if(p.dive>0){tx=p.faceX*17;tz=p.faceZ*17;}
  const accel=support?.type==='ice'?5:p.roll>0?30:p.ground!==null?60:30;
  if(!gadgetStep?.controlled){p.vx=approach(p.vx,tx,accel*dt);p.vz=approach(p.vz,tz,accel*dt);}
  let carryX=0,carryZ=0;
  if(support?.type==='conveyor'){if(support.axis==='x')carryX=support.dir*3.4;else carryZ=support.dir*3.4;}
  if(support?.type==='boost')carryZ=4.5;
  const wind=this.level.platforms.find(q=>q.type==='wind'&&Math.abs(p.z-q.z)<q.d/2+2&&Math.abs(p.x-q.x)<q.w/2+3&&p.y<q.y+8);const safeZone=support?.checkpoint||(this.level.portals||[]).some(q=>Math.hypot(p.x-q.x,p.z-q.z)<2.1);if(wind&&!safeZone)carryX=wind.dir*2.9;
  const old={x:p.x,z:p.z,y:p.y};p.x+=(p.vx+carryX)*dt;p.z+=(p.vz+carryZ)*dt;
  this.collideWalls(old);
  p.vy-=PHYSICS.gravity*dt;p.y+=p.vy*dt;p.ground=null;
  let landing=null;
  for(const q of this.level.platforms){if(!this.surface(q))continue;const pos=platformPose(q,this.time),inside=Math.abs(p.x-pos.x)<q.w/2+.12&&Math.abs(p.z-pos.z)<q.d/2+.12;
    if(inside&&p.vy<=0&&old.y>=q.y-.06&&p.y<=q.y){if(!landing||q.y>landing.y)landing=q;}
    else if(inside&&p.y<q.y-.2&&p.y>q.y-1.5&&old.y<q.y-.1){p.x=old.x;p.z=old.z;p.vx*=.2;p.vz*=.2;}
  }
  if(landing){p.y=landing.y;p.vy=0;p.ground=landing.id;p.airDive=false;p.coyote=.11;
   if(landing.type==='collapse'&&!this.collapse.has(landing.id)){this.collapse.set(landing.id,this.time);this.emit('crack');}
   if(landing.type==='switch'&&!this.switches.has(landing.switchId)){this.switches.add(landing.switchId);this.emit('switch');}
   if(landing.type==='bounce'&&Math.abs(p.x-landing.x)<1.6&&Math.abs(p.z-landing.z)<1.5){p.vy=14;p.ground=null;p.coyote=0;this.emit('bounce');}
   if(landing.checkpoint&&landing.id!==this.checkpointId&&landing.type!=='finish'){this.checkpointId=landing.id;this.checkpoint={x:landing.x,z:landing.z,y:landing.y};this.emit('checkpoint');}
  }
  for(const [id,t]of this.collapse){if(this.time-t>4.5)this.collapse.delete(id);}
  for(const h of this.level.hazards){const q=hazardPose(h,this.time);let hit=false;let nx=0,nz=0;
   if(h.type==='sweeper'&&p.y<h.y+1.12&&p.y>h.y-.7){const dx=p.x-h.x,dz=p.z-h.z,along=dx*Math.cos(q.angle)+dz*Math.sin(q.angle),across=-dx*Math.sin(q.angle)+dz*Math.cos(q.angle);hit=Math.abs(along)<h.w/2+.35&&Math.abs(across)<.63;nx=-Math.sin(q.angle)*Math.sign(across||1);nz=Math.cos(q.angle)*Math.sign(across||1);}
   if(['bumper','pendulum'].includes(h.type)&&p.y<h.y+(h.type==='pendulum'?2.5:1.8)&&p.y>h.y-.8){const dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz);hit=d<h.radius+.48;nx=dx/(d||1);nz=dz/(d||1);}
   if(h.type==='gate'&&!q.open&&(h.axis==='x'?Math.abs(p.z-h.z)<h.w/2+.4&&Math.abs(p.x-h.x)<.7:Math.abs(p.x-h.x)<h.w/2+.4&&Math.abs(p.z-h.z)<.7)&&p.y<h.y+3.2&&p.y>h.y-1){if(h.axis==='x'){p.x=old.x<h.x?h.x-.72:h.x+.72;p.vx=0;}else{p.z=old.z<h.z?h.z-.72:h.z+.72;p.vz=0;}if(this.time-(this.lastGateTip||-10)>3){this.emit('gate');this.lastGateTip=this.time;}}
   if(h.type==='pusher'&&p.y<h.y+1.7&&p.y>h.y-.7&&Math.abs(p.z-h.z)<1){const side=Math.sin(h.phase)>0?1:-1;const edge=h.x+side*(h.w/2-q.extension*(h.w*.7));hit=side>0?p.x>edge&&p.x<h.x+h.w/2+1:p.x<edge&&p.x>h.x-h.w/2-1;nx=-side;nz=.25;}
   if(hit&&p.invuln<=0){p.vx=nx*12;p.vz=nz*12;p.vy=5;p.ground=null;p.coyote=0;p.invuln=1;p.roll=0;p.dive=0;p.x+=nx*.22;p.z+=nz*.22;this.emit('hit');}
  }
  if(this.level.mode==='challenge'&&(this.level.lavaZones||[]).some(zone=>Math.abs(p.x-zone.x)<zone.w/2&&Math.abs(p.z-zone.z)<zone.d/2&&p.y<=zone.y+.22)){this.fail();return;}
  this.checkPortals();if(this.checkChallengePortals())return;collectShield(this);
  updateCombat(this,dt);if(this.respawnDelay){resetGadgetEffects(this);return;}
  // Resolve every contact before checking the goal, so a simultaneous trap cannot be skipped by winning.
  const order={add:0,subtract:1,zero:2};
  const touching=(this.level.beans||[]).filter(bean=>!this.collected.has(bean.id)&&beanContact(p,bean)).sort((a,b)=>order[beanEffect(a)]-order[beanEffect(b)]);
  for(const bean of touching){
   const effect=beanEffect(bean),value=effect==='zero'?0:effect==='subtract'?-Math.abs(bean.value??10):bean.value??1,beforeScore=this.score;
   this.collected.add(bean.id);this.beanPickups++;
   const resetPositiveBeans=[];
   if(effect==='zero'){
    this.score=0;
    for(const positive of this.level.beans||[])if(beanEffect(positive)==='add'&&(positive.value??1)>0){if(this.collected.delete(positive.id))resetPositiveBeans.push(positive.id);this.beanRespawns.delete(positive.id);}
   }else{
    this.score+=value;
    if(effect==='add'&&value>0&&Number.isFinite(bean.respawn)&&bean.respawn>0)this.beanRespawns.set(bean.id,this.time+bean.respawn);
   }
   this.emit('bean',{id:bean.id,effect,value,delta:this.score-beforeScore,beforeScore,score:this.score,...(effect==='zero'?{resetPositiveBeans}:{})});
  }
  const b=this.level.bounds;if(p.y<-7||(b&&(p.x<b.minX-3||p.x>b.maxX+3||p.z<b.minZ-3||p.z>b.maxZ+3)))this.fail();
  if(this.level.mode!=='challenge'&&this.score>=this.level.requiredScore){this.status='won';this.emit('win');}
 }
 collideWalls(old){const p=this.player,r=PHYSICS.radius;
  for(const w of this.level.walls||[]){if(p.y>=w.h||p.y<-2)continue;const minX=w.x-w.w/2-r,maxX=w.x+w.w/2+r,minZ=w.z-w.d/2-r,maxZ=w.z+w.d/2+r;
   if(p.x>minX&&p.x<maxX&&old.z>minZ&&old.z<maxZ){p.x=old.x<=minX?minX:old.x>=maxX?maxX:Math.abs(p.x-minX)<Math.abs(maxX-p.x)?minX:maxX;if((p.x===minX&&p.vx>0)||(p.x===maxX&&p.vx<0))p.vx=0;}
   if(p.z>minZ&&p.z<maxZ&&p.x>minX&&p.x<maxX){p.z=old.z<=minZ?minZ:old.z>=maxZ?maxZ:Math.abs(p.z-minZ)<Math.abs(maxZ-p.z)?minZ:maxZ;if((p.z===minZ&&p.vz>0)||(p.z===maxZ&&p.vz<0))p.vz=0;}
  }
 }
 checkPortals(){const p=this.player,portals=this.level.portals||[];
  if(this.portalLock!==null){const locked=portals.find(q=>q.id===this.portalLock);if(!locked||Math.hypot(p.x-locked.x,p.z-locked.z)>2.1)this.portalLock=null;}
  if(p.portalCd>0||this.portalLock!==null||p.y>1.4||p.y<-.3)return;
  const source=portals.find(q=>Math.hypot(p.x-q.x,p.z-q.z)<q.radius);
  if(!source)return;const target=portals.find(q=>q.id===source.target);if(!target)return;
  resetGadgetEffects(this);Object.assign(p,{x:target.x,z:target.z,y:target.y,vx:0,vz:0,vy:0,ground:target.platformId,roll:0,dive:0,coyote:.11,airDive:false,invuln:1,portalCd:1.15});this.projectiles=[];this.portalLock=target.id;this.portalUses++;this.emit('portal',{source:source.id,target:target.id,label:target.label});
 }
 checkChallengePortals(){
  const p=this.player,touches=portal=>portal&&Math.hypot(p.x-portal.x,p.z-portal.z)<portal.radius&&Math.abs(p.y-portal.y)<1.3;
  if(this.level.mode==='challenge'){
   if(touches(this.level.finishPortal)){const result={challengeId:this.level.challenge.id,name:this.level.challenge.name,time:this.elapsed,falls:this.falls};this.exitChallenge({completed:true});this.emit('challengeComplete',result);return true;}
   if(touches(this.level.exitPortal)){this.exitChallenge();return true;}return false;
  }
  if(this._challengeEntryLock!==null){const portal=(this.level.challengePortals||[]).find(q=>q.id===this._challengeEntryLock);if(!portal||Math.hypot(p.x-portal.x,p.z-portal.z)>portal.radius+1)this._challengeEntryLock=null;}
  const portal=(this.level.challengePortals||[]).find(touches);return portal?this.enterChallenge(portal.challengeId):false;
 }
 snapshot(){return {mode:this.level.mode??'arena',challenge:this.level.challenge?{...this.level.challenge}:null,challengePortals:(this.level.challengePortals||[]).map(p=>({...p})),gadgets:snapshotGadgets(this),level:this.level.id,mapCode:this.level.code,enemyTier:this.level.enemyTier,status:this.status,time:Number(this.elapsed.toFixed(2)),beans:this.beanPickups,collectedBeans:this.collected.size,beansRemaining:(this.level.beans||[]).length-this.collected.size,score:this.score,beanRefreshes:[...this.beanRespawns].map(([id,at])=>({id,refreshIn:Math.max(0,Math.ceil(at-this.time))})),target:this.level.requiredScore,totalBeans:this.level.totalBeans,totalScore:this.level.totalScore,falls:this.falls,portalUses:this.portalUses,checkpoint:this.checkpointId,actions:{...this.actionCounts},weapon:this.weapon,shield:this.player.shield,shieldsCollected:this.shieldsCollected,shieldsUsed:this.shieldsUsed,shieldPickups:this.shieldPickups.map(s=>({...s,refreshIn:s.available?0:Math.max(0,Math.ceil(s.respawnAt-this.time))})),health:this.player.health,maxHealth:3,defeatedMonsters:this.defeatedMonsters,combatRespawns:this.combatRespawns,monsters:this.monsters.map(({id,type,typeId,tier,enemyName,hitsToDefeat,rank,rankName,x,z,hp,maxHp,shieldHP,shieldMax,contactDamage,windup,dash,state,defeated})=>({id,type,typeId,tier,enemyName,hitsToDefeat,remainingHits:hp+shieldHP,rank,rankName,x,z,hp,maxHp,shieldHP,shieldMax,contactDamage,windup,dash,state,defeated})),projectiles:this.projectiles.map(s=>({...s})),player:{...this.player},progress:this.level.mode==='challenge'?clamp(this.player.z/this.level.finishPortal.z,0,1):clamp(this.score/this.level.requiredScore,0,1)};}
}

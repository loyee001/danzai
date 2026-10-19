import {LEVELS,TOTAL_LEVELS,CELL} from '../dist/levels.js';
import {Game} from '../dist/engine.js';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const args=process.argv.slice(2),explicit=args.filter(a=>!a.startsWith('--')).map(Number),range=args.find(a=>a.startsWith('--range='))?.slice(8).split(':').map(Number),shard=args.find(a=>a.startsWith('--shard='))?.slice(8).split('/').map(Number),results=[];
const hz=Number(args.find(a=>a.startsWith('--hz='))?.slice(5)||30),dt=1/hz;if(![30,60,120].includes(hz))throw Error('Choose --hz=30, 60 or 120');
const ids=(explicit.length?explicit:Array.from({length:TOTAL_LEVELS},(_,i)=>i+1)).filter(id=>(!range||id>=range[0]&&id<=range[1])&&(!shard||(id-1)%shard[1]===shard[0]-1));
if(ids.some(id=>!Number.isInteger(id)||id<1||id>TOTAL_LEVELS)||!ids.length)throw Error('Choose valid map ids or --range=1:1000 / --shard=1/2');
const started=performance.now();
for(const id of ids){
 const l=LEVELS[id-1],levelStarted=performance.now();
 const g=new Game(l);g.start();g.setWeapon('launcher');const mid=(l.size-1)/2,key=(x,z)=>`${x},${z}`,posToCell=(x,z)=>[Math.round(x/CELL+mid),Math.round(z/CELL+mid)];
 const platformByCell=new Map(l.platforms.map(p=>[key(p.cx,p.cz),p]));
 const hazardCells=new Set(l.hazards.map(h=>key(...posToCell(h.x,h.z))));
 const dangerousByCell=new Map(l.beans.filter(b=>b.effect==='subtract'||b.effect==='zero').map(b=>[key(...posToCell(b.x,b.z)),b]));
 const positive=b=>b.value>0&&b.effect!=='subtract'&&b.effect!=='zero';
 const portalByCell=new Map(l.portals.map(p=>[key(...posToCell(p.x,p.z)),p]));
 // Runtime entrances are added by Game.load rather than stored in the cached level.
 // Reserve their cells and neighboring approach cells so ordinary bean routes cannot enter them.
 const challengePortals=g.level.challengePortals||[],challengeCells=new Set();
 for(const platform of l.platforms)if(challengePortals.some(portal=>Math.hypot(platform.x-portal.x,platform.z-portal.z)<portal.radius+CELL/Math.SQRT2+.8))challengeCells.add(key(platform.cx,platform.cz));
 let path=[],targetBean=null,lastProgress=0,trace=[],nextJump=0,recovery=null,lastRecovery=-10,recoveryCount=0,eventScore=0;
 let challengeEntries=0;
 const scoreLedger=[],scoreMismatches=[];
 function processEvents(){
  for(const e of g.events.splice(0)){
   if(e.type==='challengeEnter'){challengeEntries++;trace.push({event:e.type,challengeId:e.challengeId});}
   if(e.type==='bean'){
    if(!Number.isFinite(e.delta)||e.beforeScore!==eventScore)scoreMismatches.push({event:e.id,expectedBefore:eventScore,beforeScore:e.beforeScore,delta:e.delta});
    eventScore+=e.delta;if(eventScore!==e.score)scoreMismatches.push({event:e.id,eventScore,score:e.score});
    scoreLedger.push({id:e.id,effect:e.effect,value:e.value,delta:e.delta,beforeScore:e.beforeScore,score:e.score,...(e.resetPositiveBeans?{resetPositiveBeans:e.resetPositiveBeans}:{})});
    lastProgress=g.time;if(e.effect==='zero'){path=[];targetBean=null;}
   }
   if(['portal','respawn'].includes(e.type)){path=[];lastProgress=g.time;}
   if(['hit','fall','portal','win','monsterHit','monsterDefeated','damage'].includes(e.type)){trace.push({event:e.type,t:+g.time.toFixed(2),x:+g.player.x.toFixed(1),z:+g.player.z.toFixed(1),beans:g.beanPickups,score:g.score,health:g.player.health});if(trace.length>10)trace.shift();}
  }
  if(eventScore!==g.score)scoreMismatches.push({time:g.time,eventScore,score:g.score});
 }
 const nearestFloor=()=>{const c=posToCell(g.player.x,g.player.z);if(l.grid[c[1]]?.[c[0]])return c;const p=[...l.platforms].sort((a,b)=>Math.hypot(a.x-g.player.x,a.z-g.player.z)-Math.hypot(b.x-g.player.x,b.z-g.player.z))[0];return[p.cx,p.cz];};
 function makePath(){
  const start=nearestFloor(),sk=key(...start),uncollected=new Map(l.beans.filter(b=>positive(b)&&!g.collected.has(b.id)).map(b=>[key(b.cx,b.cz),b]));
  const maxValue=Math.max(...[...uncollected.values()].map(b=>b.value),1);
  const queue=[{c:start,d:0}],dist=new Map([[sk,0]]),prev=new Map();let goal=null,bestCost=Infinity;
  while(queue.length){queue.sort((a,b)=>b.d-a.d);const {c:[x,z],d}=queue.pop(),k=key(x,z);if(d!==dist.get(k))continue;if((d+3)/maxValue>bestCost)break;if(uncollected.has(k)){const bean=uncollected.get(k),cost=(d+3)/bean.value;if(cost<bestCost){goal=[x,z];targetBean=bean.id;bestCost=cost;}}
   const ns=dirs.map(([dx,dz])=>[x+dx,z+dz]);const portal=portalByCell.get(k);if(portal&&g.portalLock!==portal.id){const exit=l.portals.find(p=>p.id===portal.target);ns.push(posToCell(exit.x,exit.z));}
   for(const [nx,nz]of ns){if(!l.grid[nz]?.[nx])continue;const nk=key(nx,nz),trap=dangerousByCell.get(nk);if(challengeCells.has(nk)||trap&&!g.collected.has(trap.id))continue;const type=platformByCell.get(nk)?.type;const cost=1+(hazardCells.has(nk)?3:0)+(['collapse','ice','wind','bounce'].includes(type)?2:0),nd=d+cost;if(nd<(dist.get(nk)??Infinity)){dist.set(nk,nd);prev.set(nk,[x,z]);queue.push({c:[nx,nz],d:nd});}}
  }
  if(!goal)return[];const out=[goal];let cursor=goal;while(key(...cursor)!==sk){cursor=prev.get(key(...cursor));if(!cursor)return[];out.push(cursor);}return out.reverse();
 }
 for(let frame=0;frame<hz*900&&g.status==='playing'&&g.falls<30;frame++){
  const p=g.player;if(g.respawnDelay){path=[];recovery=null;g.step(dt);processEvents();continue;}
  if(targetBean!==null&&g.collected.has(targetBean))path=[];
  if(!path.length)path=makePath();
  if(!path.length)break;
  let [cx,cz]=path[0],tx=(cx-mid)*CELL,tz=(cz-mid)*CELL;
  if(path.length>1&&Math.hypot(p.x-tx,p.z-tz)<.42){path.shift();[cx,cz]=path[0];tx=(cx-mid)*CELL;tz=(cz-mid)*CELL;}
  // Sparse arena beans have physical radii and need not lie exactly at a navigation-cell center.
  // Aim at the actual bean on the final leg; the engine decides when its outer surface is touched.
  if(path.length===1){const bean=l.beans.find(b=>b.id===targetBean);if(bean){tx=bean.x;tz=bean.z;}}
  const support=l.platforms.find(q=>q.id===p.ground),next=platformByCell.get(key(cx,cz));let carryX=0,carryZ=0;
  if(support?.type==='conveyor'){if(support.axis==='x')carryX=support.dir*3.4;else carryZ=support.dir*3.4;}
  const wind=l.platforms.find(q=>q.type==='wind'&&Math.abs(p.z-q.z)<q.d/2+2&&Math.abs(p.x-q.x)<q.w/2+3&&p.y<q.y+8);if(wind&&!support?.checkpoint&&!l.portals.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<2.1))carryX=wind.dir*2.9;
  if(p.ground!==null&&g.time>nextJump){
   const hazard=l.hazards.find(h=>h.type!=='gate'&&Math.hypot(h.x-p.x,h.z-p.z)<2.5);
   if(hazard||support?.type==='collapse'||(next?.type==='collapse'&&Math.hypot(tx-p.x,tz-p.z)<3)){g.action('jump');nextJump=g.time+.88;}
  }
  if(p.ground!==null&&p.rollCd<=0&&path.length>=4&&support?.type==='plain'){
   const a=path.slice(0,4),straight=a.every(c=>c[0]===a[0][0])||a.every(c=>c[1]===a[0][1]);if(straight&&a.every(c=>platformByCell.get(key(...c))?.type==='plain')&&frame%30===0)g.action('roll');
  }
  const accel=support?.type==='ice'?5:p.ground!==null?60:30,speed=p.roll>0?14:7.5;
  const control=(delta,carry)=>clamp((Math.sign(delta)*Math.min(speed,Math.sqrt(2*accel*Math.abs(delta))*.72)-carry)/speed,-1,1);
  // A wind can pin the player against a wall while they try to center a waypoint.
  // Escape along a real neighboring corridor, then plan again; never alter player coordinates.
  if(!l.arena?.open&&!args.includes('--no-recovery')&&!recovery&&g.time-lastProgress>8&&g.time-lastRecovery>6){
   const [px,pz]=nearestFloor(),nearWind=l.platforms.find(q=>q.type==='wind'&&Math.hypot(q.x-p.x,q.z-p.z)<9),options=[];
   for(const [dx,dz]of dirs){if(!l.grid[pz+dz]?.[px+dx])continue;let nx=px+dx,nz=pz+dz;if(l.grid[nz+dz]?.[nx+dx]){nx+=dx;nz+=dz;}const ex=(nx-mid)*CELL,ez=(nz-mid)*CELL;options.push({axis:dz?'z':'x',target:dz?ez:ex,rank:(dz?20:0)+(nearWind?Math.hypot(ex-nearWind.x,ez-nearWind.z):0)});}
   options.sort((a,b)=>b.rank-a.rank);if(options.length){recovery={...options[recoveryCount%Math.min(options.length,2)],until:g.time+2.5};recoveryCount++;lastRecovery=g.time;trace.push({event:'recovery',x:p.x,z:p.z,axis:recovery.axis,target:recovery.target});if(trace.length>10)trace.shift();}
  }
  let movement={x:control(tx-p.x,carryX),z:control(tz-p.z,carryZ)};
  if(recovery){if(Math.abs(p[recovery.axis]-recovery.target)<.35||g.time>recovery.until){recovery=null;path=[];}else movement=recovery.axis==='z'?{x:0,z:Math.sign(recovery.target-p.z)}:{x:Math.sign(recovery.target-p.x),z:0};}
  // Use normal weapon selection and attack inputs: hammer nearby enemies, shoot at distant enemies.
  if(p.attackCd<=0){const nearby=g.monsters.filter(m=>!m.defeated).map(m=>({m,d:Math.hypot(m.x-p.x,m.z-p.z)})).sort((a,b)=>a.d-b.d)[0];if(nearby&&nearby.d<12){g.setWeapon(nearby.d<=3.1?'hammer':'launcher');g.action('attack');}}
  g.step(dt,movement);
  processEvents();
  if(g.level.mode==='challenge')break;
  if(g.time-lastProgress>18){if(g.time-lastProgress>40){trace.push({event:'stuck',path:path.slice(0,4),targetBean,x:p.x,z:p.z,ground:p.ground,roll:p.roll,dive:p.dive,vx:p.vx,vz:p.vz,tx,tz,carryX,carryZ});break;}path=[];}
 }
 const scoreMatchesEvents=g.score===eventScore&&scoreMismatches.length===0;
 results.push({id:l.id,code:l.code,arenaOpen:l.arena?.open===true,layout:l.layout,status:g.status,challengeEntries,challengeDoors:challengePortals.length,avoidedChallengeCells:challengeCells.size,beans:g.beanPickups,collectedBeans:g.collected.size,beansRemaining:l.totalBeans-g.collected.size,score:g.score,target:l.requiredScore,totalScore:l.totalScore,penaltyTotal:l.penaltyTotal,scoreMatchesEvents,scoreLedger,scoreMismatches,time:+g.time.toFixed(1),wallSeconds:+((performance.now()-levelStarted)/1000).toFixed(3),falls:g.falls,combatRespawns:g.combatRespawns,recoveryInputs:recoveryCount,portals:g.portalUses,weapon:g.weapon,health:g.player.health,shield:g.player.shield,shieldsCollected:g.shieldsCollected,shieldsUsed:g.shieldsUsed,monsters:l.monsters.length,enemyTier:l.enemyTier,typeIds:[...new Set(l.monsters.map(m=>m.typeId))],ranks:[...new Set(l.monsters.map(m=>m.rank))],defeatedMonsters:g.defeatedMonsters,actions:g.actionCounts,position:{x:+g.player.x.toFixed(2),z:+g.player.z.toFixed(2),y:+g.player.y.toFixed(2),ground:g.player.ground},pathHead:path.slice(0,4),trace:g.status==='won'?undefined:trace});
 if(results.length%25===0)console.error(`autoplay ${results.length}/${ids.length}: map ${l.id}, ${((performance.now()-started)/1000).toFixed(1)}s elapsed`);
}
const passed=results.filter(r=>r.status==='won'&&r.score>=r.target&&r.scoreMatchesEvents&&r.challengeEntries===0).length;
const sourceSha256=Object.fromEntries(['levels','engine','combat','enemies','shields','challenges','gadgets'].map(name=>[name,createHash('sha256').update(readFileSync(new URL(`../dist/${name}.js`,import.meta.url))).digest('hex')]));
console.log(JSON.stringify({version:'Open grass arenas with timed bean refresh, high-value beans, combat and challenge-door avoidance',passed,total:results.length,sampledLevelIds:ids,frameHz:hz,wallSeconds:+((performance.now()-started)/1000).toFixed(2),sourceSha256,coverage:'Only the listed maps were played using Game.step movement and explicit ordinary actions. No R rescue, position, score or monster state edits. Only positive beans are chosen as goals; live trap cells and runtime challenge entrances with neighboring approach cells are avoided. No remote challenge entry is used. Scores are checked against every actual bean-event delta, including zero resets and recollection, rather than the current collected-ID set. The engine handles physical bean-radius contact.',results},null,2));
if(passed!==results.length)process.exitCode=1;

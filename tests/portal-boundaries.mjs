import {LEVELS,TOTAL_LEVELS} from '../dist/levels.js';
import {Game} from '../dist/engine.js';
const teleportFailures=[],idleReturn=[],idleFalls=[],idleDrift=[],idleDamage=[],cpFailures=[],checkpointPortals=[],safeDistanceFailures=[];
const sampleIds=new Set([1,10,11,199,200,201,399,400,401,599,600,601,799,800,801,991,1000]);for(let chapter=0;chapter<10;chapter++){sampleIds.add(chapter*100+1);sampleIds.add((chapter+1)*100);}
const override=process.argv.find(a=>a.startsWith('--samples='));if(override){sampleIds.clear();for(const id of override.slice(10).split(',').map(Number)){if(!Number.isInteger(id)||id<1||id>TOTAL_LEVELS)throw Error('Invalid sample map');sampleIds.add(id);}}
let portalLocationsValidated=0,monsterPatrolPointsValidated=0;
// Check all 1000 maps as data; run expensive 60-second simulation only for the published stratified sample.
for(const l of LEVELS){
 portalLocationsValidated+=l.portals.length;
 for(const cp of l.platforms.filter(p=>p.checkpoint))if(l.portals.some(p=>p.platformId===cp.id))checkpointPortals.push({level:l.id,checkpoint:cp.id});
 for(const m of l.monsters)for(const point of [{x:m.x,z:m.z},...m.patrol]){monsterPatrolPointsValidated++;if(Math.hypot(point.x-l.spawn.x,point.z-l.spawn.z)<4.6-1e-6||l.platforms.some(p=>p.checkpoint&&Math.hypot(point.x-p.x,point.z-p.z)<4.6-1e-6)||l.portals.some(p=>Math.hypot(point.x-p.x,point.z-p.z)<2.6-1e-6))safeDistanceFailures.push({level:l.id,monster:m.id,point});}
}
const sampledLevelIds=[...sampleIds].sort((a,b)=>a-b);let teleportDirectionsTested=0;
for(const id of sampledLevelIds){const l=LEVELS[id-1];
 for(const source of l.portals){const g=new Game(l);g.start();Object.assign(g.player,{x:source.x,z:source.z,y:0,ground:source.platformId});g.step(1/60);const target=l.portals.find(p=>p.id===source.target);
  teleportDirectionsTested++;
  if(g.portalUses!==1||Math.hypot(g.player.x-target.x,g.player.z-target.z)>.001)teleportFailures.push({level:l.id,source:source.id});
  for(let f=0;f<1800;f++)g.step(1/30);
  if(g.portalUses!==1)idleReturn.push({level:l.id,source:source.id,uses:g.portalUses});
  if(g.falls)idleFalls.push({level:l.id,source:source.id,falls:g.falls});
  if(g.player.health!==g.player.maxHealth)idleDamage.push({level:l.id,source:source.id,health:g.player.health});
  if(Math.hypot(g.player.x-target.x,g.player.z-target.z)>.5)idleDrift.push({level:l.id,source:source.id,drift:+Math.hypot(g.player.x-target.x,g.player.z-target.z).toFixed(2)});
 }
 for(const cp of l.platforms.filter(p=>p.checkpoint)){const g=new Game(l);g.start();g.checkpoint={x:cp.x,z:cp.z,y:cp.y};g.checkpointId=cp.id;g.respawn();for(let f=0;f<600;f++)g.step(1/30);const dist=Math.hypot(g.player.x-cp.x,g.player.z-cp.z);if(g.falls||g.portalUses||dist>.1||g.player.health!==g.player.maxHealth)cpFailures.push({level:l.id,checkpoint:cp.id,falls:g.falls,portals:g.portalUses,health:g.player.health,drift:+dist.toFixed(2)});}
 console.error(`portal sample map ${id} (${sampledLevelIds.indexOf(id)+1}/${sampledLevelIds.length})`);
}
// Controlled scoring fixtures use spaced beans on an open floor; movement still goes through Game.step.
const base={id:901,code:'FIXTURE',platforms:[{id:0,x:0,z:0,y:0,w:40,d:40,type:'plain',checkpoint:true}],spawnPlatform:0,spawn:{x:0,y:0,z:0},beans:[{id:0,x:0,y:.8,z:0,value:1},{id:1,x:4,y:.8,z:0,value:5},{id:2,x:8,y:.8,z:0,value:10}],requiredScore:6,totalBeans:3,totalScore:16,walls:[],hazards:[],portals:[],bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20}};
const a=new Game(base);a.start();a.step(1/60);const thresholdBefore=a.collected.size===1&&a.score===1&&a.status==='playing';for(let i=0;i<60&&a.status==='playing';i++)a.step(1/60,{x:1,z:0});const thresholdExact=a.collected.size===2&&a.score===6&&a.status==='won';
const over=new Game({...base,requiredScore:12});over.start();for(let i=0;i<150&&over.status==='playing';i++)over.step(1/60,{x:1,z:0});const thresholdExceeded=over.collected.size===3&&over.score===16&&over.status==='won';
const b=new Game({...base,beans:[{...base.beans[0],value:10}],requiredScore:30,totalBeans:1,totalScore:10});b.start();b.step(1/60);const count=b.collected.size,score=b.score;b.player.y=-8;b.player.ground=null;b.step(1/60);for(let i=0;i<60;i++)b.step(1/60);const deathPreserves=b.falls===1&&b.collected.size===count&&b.score===score;b.step(1/60);const noBeanRespawn=b.collected.size===count&&b.score===10;b.restart();const restartClears=b.collected.size===0&&b.score===0&&b.elapsed===0;
const portFixture={...base,spawn:{x:-4,y:0,z:0},beans:[{id:0,x:-4,y:.8,z:0,value:5},{id:1,x:8,y:.8,z:0,value:10}],requiredScore:30,totalBeans:2,totalScore:15,portals:[{id:0,pair:0,target:1,x:0,z:0,y:0,radius:1,platformId:0,label:'A'},{id:1,pair:0,target:0,x:8,z:0,y:0,radius:1,platformId:0,label:'A'}]};const c=new Game(portFixture);c.start();c.step(1/60);const scoreBeforePortal=c.score;for(let i=0;i<120&&c.portalUses===0;i++)c.step(1/60,{x:1,z:0});const portalScorePreserved=scoreBeforePortal===5&&c.score===15&&c.collected.size===2;for(let i=0;i<90;i++)c.step(1/60,{x:1,z:0});for(let i=0;i<240&&c.portalUses===1;i++)c.step(1/60,{x:-1,z:0});const reenterReturns=c.portalUses===2;const noPortalRecollection=c.score===15&&c.collected.size===2;
const result={version:'100 catalogue enemy types',dataMapsValidated:TOTAL_LEVELS,portalLocationsValidated,monsterPatrolPointsValidated,sampledLevelIds,samplePolicy:override?'Explicit --samples map list. Each sampled portal direction idle-tested for 60 simulated seconds; other portals have data checks only.':'100-level chapter first/last maps, 20-tier behavior-family boundaries and the final enemy-tier unlock. Each sampled portal direction idle-tested for 60 simulated seconds; other portals have data checks only.',teleportDirectionsTested,teleportFailures,idleReturnAfter60Seconds:idleReturn,idleFalls,idleDrift,idleDamage,checkpointPortals,cpFailures,safeDistanceFailures,thresholdBefore,thresholdExact,thresholdExceeded,deathPreserves,noBeanRespawn,restartClears,portalScorePreserved,reenterReturns,noPortalRecollection};
console.log(JSON.stringify(result,null,2));
if([teleportFailures,idleReturn,idleFalls,idleDrift,idleDamage,checkpointPortals,cpFailures,safeDistanceFailures].some(list=>list.length)||Object.values(result).some(value=>value===false))process.exitCode=1;

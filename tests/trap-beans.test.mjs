import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {makeLevel,CELL} from '../dist/levels.js';
import {Game} from '../dist/engine.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('all 1000 maps progressively add avoidable traps without changing any previous positive bean or map geometry',()=>{
 const positives=[],geometry=[],counts={negative10:0,negative100:0,zero:0},samples=[];let minMargin=Infinity,minToolClearance=Infinity;
 for(let id=1;id<=1000;id++){
  const l=makeLevel(id),positive=l.beans.filter(b=>b.value>0),negative=l.beans.filter(b=>b.effect==='subtract'),zero=l.beans.filter(b=>b.effect==='zero'),traps=[...negative,...zero],runtime=new Game(l),cells=new Map(l.platforms.map(p=>[`${p.cx},${p.cz}`,p]));
  assert.equal(negative.length,id<=300?2:id<=600?3:4);assert.equal(zero.length,id<=500?1:2);assert.equal(l.penaltyTotal,negative.reduce((s,b)=>s-b.value,0));assert(l.totalScore-l.penaltyTotal>=l.requiredScore);minMargin=Math.min(minMargin,l.totalScore-l.penaltyTotal-l.requiredScore);
  assert.deepEqual([...new Set(positive.map(b=>b.value))].sort((a,b)=>a-b),id<=100?[1,5,10]:id<=500?[1,5,10,100,500]:[1,5,10,100,500,1000]);
  assert.equal(l.totalBeans,l.beans.length);assert.deepEqual(l.beans.map(b=>b.id),Array.from({length:l.beans.length},(_,i)=>i));assert.equal(runtime.level.challengePortals.length,3);
  const seen=new Set([`${(l.size-1)/2},${(l.size-1)/2}`]),queue=[l.platforms.find(p=>p.id===l.spawnPlatform)];for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const key=`${p.cx+dx},${p.cz+dz}`,next=cells.get(key);if(next&&!seen.has(key)){seen.add(key);queue.push(next);}}}
  for(const b of traps){
   assert(seen.has(`${b.cx},${b.cz}`));assert.equal(b.respawn,undefined);assert([-100,-10,0].includes(b.value));if(b.value===-100){assert(id>100);counts.negative100++;}else if(b.value===-10)counts.negative10++;else counts.zero++;
   assert(distance(b,l.spawn)>=16);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)assert.equal(cells.get(`${b.cx+dx},${b.cz+dz}`)?.type,'plain','a complete grass ring lets the player walk around each trap');
   for(const other of l.beans)if(other!==b)assert(distance(b,other)>=Math.max(6.8-1e-6,b.radius+other.radius+1.26)-1e-6);
   for(const p of [...l.portals,...runtime.level.challengePortals])assert(distance(b,p)>b.radius+(p.challengeId?2:4.6),'door contact zones never require touching a trap');
   for(const p of [...l.shields,...l.platforms.filter(p=>p.checkpoint)])assert(distance(b,p)>b.radius+4.6);
   for(const p of l.platforms.filter(p=>!['plain','checkpoint'].includes(p.type)))assert(distance(b,p)>b.radius+CELL*1.5);
   for(const p of runtime.gadgetPickups){const clearance=distance(b,p)-b.radius-1.43;assert(clearance>0,'tool pickup circles are outside trap contact circles');minToolClearance=Math.min(minToolClearance,clearance);}
   if(b.baitId!==undefined)assert(positive[b.baitId]?.value>=5,'new bait traps identify a real visible higher-value bean');
  }
  positives.push(hash(positive));geometry.push(hash({grid:l.grid,platforms:l.platforms,portals:l.portals,monsters:l.monsters,shields:l.shields,landmarks:l.landmarks,arena:l.arena}));
  if([1,100,101,300,301,500,501,600,601,1000].includes(id))samples.push({id,target:l.requiredScore,totalScore:l.totalScore,penaltyTotal:l.penaltyTotal,negativeBeans:negative.length,zeroBeans:zero.length,traps:traps.map(({id,x,z,value,effect,baitId})=>({id,x,z,value,effect,baitId}))});
 }
 // Captured before this change: all existing positive objects and all map
 // geometry must stay byte-for-byte equivalent across the entire catalogue.
 assert.equal(hash(positives),'c63b853fe9d066766ff7cba01ee4342f6d145466d187a9b1e7845a6d53bd9af8');assert.equal(hash(geometry),'43bcafd3f5e600ef304387cb341b58f8c530f815999b793bb3d21d7e762b8fb6');assert.equal(counts.negative10+counts.negative100,3100);assert.equal(counts.zero,1500);
 if(process.env.TRAP_AUDIT_OUTPUT)writeFileSync(process.env.TRAP_AUDIT_OUTPUT,JSON.stringify({version:'Progressive grass-map trap beans',maps:1000,coverage:'Generated-data audit only. All 1000 maps retain their original positive bean objects, positive capacity, target scores and geometry. Each trap has a full clear grass ring, safe bean spacing, reachable ground, and protected portals, shields and world gadget pickup circles. Separate Game.step contact tests cover new subtract and zero beans; no 1000-map autoplay or enemy hit-count sweep was run.',rules:[{from:1,to:300,negative:2},{from:301,to:600,negative:3},{from:601,to:1000,negative:4},{from:1,to:500,zero:1},{from:501,to:1000,zero:2}],counts,minScoreMargin:minMargin,minToolClearance,positiveDigest:hash(positives),geometryDigest:hash(geometry),samples},null,2)+'\n');
});

test('real walking into newly appended generated subtract and second-zero beans applies their effects once',()=>{
 for(const [id,effect]of [[1,'subtract'],[1000,'zero']]){
  const base=makeLevel(id),trap=base.beans.filter(b=>b.effect===effect).at(-1),approach=base.platforms.find(p=>p.cx===trap.cx+1&&p.cz===trap.cz),initial={id:base.beans.length,x:approach.x,z:approach.z,y:1,radius:1,value:5,respawn:30};
  // Isolate contact rules from patrol combat and portal transitions, retaining
  // the generated grass, trap coordinates, radii and all previous bean objects.
  const game=new Game({...base,spawn:{x:approach.x,y:0,z:approach.z},spawnPlatform:approach.id,arena:{...base.arena,open:false},monsters:[],hazards:[],portals:[],shields:[],gadgetPickups:[],beans:[...base.beans,initial],requiredScore:10000});game.start();game.step(1/120);assert.equal(game.score,5);
  for(let i=0;i<240&&!game.collected.has(trap.id);i++)game.step(1/120,{x:-1,z:0});assert(game.collected.has(trap.id));assert.equal(game.score,effect==='zero'?0:5+trap.value);
  for(let i=0;i<60;i++)game.step(1/120);assert.equal(game.events.filter(e=>e.type==='bean'&&e.id===trap.id).length,1);assert(!game.beanRespawns.has(trap.id));if(effect==='zero'){assert(!game.collected.has(initial.id));assert(!game.beanRespawns.has(initial.id));}
 }
});

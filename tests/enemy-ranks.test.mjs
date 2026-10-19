import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {ENEMY_RANKS,ENEMY_TYPES,rankMonster} from '../dist/enemies.js';
import {LEVELS,TOTAL_LEVELS} from '../dist/levels.js';

const tick=(g,seconds,input={x:0,z:0})=>{for(let i=0;i<seconds*120;i++)g.step(1/120,input);};
const enemy=(rank,x=0)=>rankMonster({id:0,type:'beetle',x,z:0,y:0,hp:3,speed:0,chaseSpeed:0,patrol:[{x,z:0}]},rank);
const fixture=(monsters,extra={})=>({id:999,code:'RANKS',spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[{id:0,x:0,z:0,y:0,w:100,d:100,type:'plain',checkpoint:false}],beans:[],requiredScore:100,totalScore:0,totalBeans:0,walls:[],hazards:[],portals:[],bounds:{minX:-50,maxX:50,minZ:-50,maxZ:50},monsters,...extra});
const toward=(g,m)=>{const dx=m.x-g.player.x,dz=m.z-g.player.z,d=Math.hypot(dx,dz);return d>.01?{x:dx/d,z:dz/d}:{x:0,z:0};};
const waitWindup=g=>{for(let i=0;i<1200&&g.monsters[0].state!=='windup';i++){const m=g.monsters[0],d=Math.hypot(g.player.x-m.x,g.player.z-m.z);g.step(1/120,d>3?toward(g,m):{x:0,z:0});}assert.equal(g.monsters[0].state,'windup');};

test('five behavior families retain their strengths and the legacy rankMonster API',()=>{
 assert.deepEqual(Object.keys(ENEMY_RANKS),['normal','swift','armored','elite','boss']);
 const base={id:0,type:'slime',hp:2,speed:2,chaseSpeed:3},original={...base},normal=rankMonster(base,'normal'),swift=rankMonster(base,'swift'),armored=rankMonster(base,'armored'),elite=rankMonster(base,'elite'),boss=rankMonster(base,'boss');
 assert.deepEqual(base,original);assert.equal(normal.hp,2);assert.ok(swift.speed>normal.speed);assert.ok(swift.chaseSpeed>normal.chaseSpeed);assert.equal(armored.shieldHP,2);assert.equal(armored.shieldMax,2);assert.ok(elite.hp>normal.hp);assert.ok(boss.hp>elite.hp);assert.equal(boss.contactDamage,2);assert.equal(normal.contactDamage,1);assert.throws(()=>rankMonster(base,'unknown'));
});

test('each ten-map group unlocks one catalogue tier and the first monster uses the highest available type',()=>{
 const seen=new Set();for(let id=1;id<=TOTAL_LEVELS;id++){const l=LEVELS[id-1],highest=Math.ceil(id/10);assert.equal(l.enemyTier,highest);assert.equal(l.monsters[0].tier,highest);for(const m of l.monsters){assert.ok(Number.isInteger(m.tier)&&m.tier>=1&&m.tier<=highest);const type=ENEMY_TYPES[m.tier-1];assert.equal(m.typeId,type.id);assert.equal(m.hitsToDefeat,type.hitsToDefeat);assert.equal(m.hp+m.shieldHP,m.hitsToDefeat);assert.equal(m.rank,type.rank);seen.add(m.tier);}}
 assert.equal(seen.size,100);assert.deepEqual([...seen].sort((a,b)=>a-b),Array.from({length:100},(_,i)=>i+1));
});

test('armor absorbs sword damage, hammer breaks the remainder and overflow reaches health',()=>{
 const g=new Game(fixture([enemy('armored',2.4)]));g.start();g.setWeapon('sword');const m=g.monsters[0],hp=m.hp;assert.equal(m.shieldHP,2);assert.equal(g.action('attack'),true);assert.equal(m.shieldHP,1);assert.equal(m.hp,hp);tick(g,.35);g.setWeapon('hammer');assert.equal(g.action('attack'),true);assert.equal(m.shieldHP,0);assert.equal(m.hp,hp-1);assert.equal(g.score,0);
 g.restart();assert.equal(g.monsters[0].shieldHP,2);assert.equal(g.monsters[0].hp,hp);
});

test('boss contact removes two hearts and still grants a shared invulnerability window',()=>{
 const g=new Game(fixture([enemy('boss',0)],{spawn:{x:-8,z:0,y:0}}));g.start();for(let i=0;i<1800&&g.player.health===3;i++)g.step(1/120,toward(g,g.monsters[0]));assert.equal(g.player.health,1);assert.ok(g.player.invuln>1);tick(g,.4,toward(g,g.monsters[0]));assert.equal(g.player.health,1);
});

test('elite and boss telegraphs freeze when paused and a side-step evades their locked dash',()=>{
 for(const rank of ['elite','boss']){const g=new Game(fixture([enemy(rank,0)],{spawn:{x:-8,z:0,y:0}}));g.start();waitWindup(g);g.pause();const paused=structuredClone(g.monsters[0]);tick(g,2,{x:0,z:1});assert.deepEqual(g.monsters[0],paused);g.start();const states=new Set([g.monsters[0].state]);for(let i=0;i<192;i++){g.step(1/120,{x:0,z:1});states.add(g.monsters[0].state);}assert.ok(states.has('dash'),`${rank} actually dashed`);assert.equal(g.player.health,3,`${rank} can be dodged`);assert.ok(Math.abs(g.monsters[0].z)<1,`${rank} did not steer toward the new position`);}
});

test('a hammer hit interrupts an elite windup before the dash',()=>{
 const g=new Game(fixture([enemy('elite',0)],{spawn:{x:-8,z:0,y:0}}));g.start();waitWindup(g);for(let i=0;i<100&&Math.hypot(g.player.x-g.monsters[0].x,g.player.z-g.monsters[0].z)>3;i++)g.step(1/120,toward(g,g.monsters[0]));assert.equal(g.monsters[0].state,'windup');assert.equal(g.action('attack'),true);assert.ok(g.monsters[0].stun>0);assert.equal(g.monsters[0].state,'stunned');tick(g,.25);assert.notEqual(g.monsters[0].state,'dash');
});

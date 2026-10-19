import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Game} from '../dist/engine.js';
import {ENEMY_TYPES,ENEMY_RANKS,getEnemyType,tierMonster} from '../dist/enemies.js';

const base=(x=6)=>({id:17,type:'beetle',x,z:0,y:0,hp:3,speed:0,chaseSpeed:0,patrol:[{x,z:0}]});
const fixture=monster=>({id:999,code:'TYPE-HITS',spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[{id:0,x:0,z:0,y:0,w:40,d:40,type:'plain',checkpoint:false}],beans:[],totalBeans:0,totalScore:0,requiredScore:100,walls:[{x:7,z:0,w:.4,d:6,h:2.65}],hazards:[],portals:[],monsters:[monster],bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20}});
const tick=(g,t)=>{for(let i=0;i<t*30;i++)g.step(1/30);};
const hitResults=[];

test('the catalogue contains 100 distinct ordered types with one-to-1000-hit endpoints',()=>{
 assert.equal(ENEMY_TYPES.length,100);assert.equal(new Set(ENEMY_TYPES.map(t=>t.id)).size,100);let previous=0;
 for(let i=0;i<100;i++){const type=ENEMY_TYPES[i];assert.equal(type.id,`E${String(i+1).padStart(3,'0')}`);assert.equal(type.tier,i+1);assert.ok(type.name);assert.ok(ENEMY_RANKS[type.rank]);assert.ok(Number.isInteger(type.hitsToDefeat)&&type.hitsToDefeat>previous);assert.equal(type.hp+type.shieldHP,type.hitsToDefeat,'armor is part of the advertised bubble count');assert.equal(getEnemyType(i+1),type);previous=type.hitsToDefeat;}
 assert.equal(ENEMY_TYPES[0].hitsToDefeat,1);assert.equal(ENEMY_TYPES[99].hitsToDefeat,1000);assert.throws(()=>getEnemyType(0));assert.throws(()=>getEnemyType(101));
 for(const [tier,rank]of [[1,'normal'],[20,'normal'],[21,'swift'],[40,'swift'],[41,'armored'],[60,'armored'],[61,'elite'],[80,'elite'],[81,'boss'],[100,'boss']])assert.equal(getEnemyType(tier).rank,rank);
 const source=base(),m=tierMonster(source,100);assert.equal(m.id,17);assert.equal(m.typeId,'E100');assert.equal(m.tier,100);assert.equal(m.hitsToDefeat,1000);assert.equal(source.hp,3,'catalogue assignment does not mutate the fixture');
});

// The player stays in a safe, open firing lane. A wall behind the target stops knockback
// from carrying it out of range; each shot still travels through normal projectile collision.
for(const type of ENEMY_TYPES)test(`${type.id}: alive after ${type.hitsToDefeat-1} real bubble hits, defeated on hit ${type.hitsToDefeat}`,()=>{
 const g=new Game(fixture(tierMonster(base(),type.tier)));g.start();assert.equal(g.setWeapon('launcher'),true);const m=g.monsters[0];assert.equal(m.hp+m.shieldHP,type.hitsToDefeat);assert.equal(m.defeated,false);let hitCount=0,beforeLast=null;
 for(let shot=1;shot<=type.hitsToDefeat;shot++){
  while(g.player.attackCd>0)g.step(1/30);g.events.length=0;
  if(shot===type.hitsToDefeat){assert.equal(m.defeated,false);assert.equal(m.hp+m.shieldHP,1);beforeLast={hp:m.hp,shield:m.shieldHP};}
  assert.equal(g.action('attack'),true);assert.equal(g.projectiles.length,1);let hit=null;
  for(let frame=0;frame<90&&!hit;frame++){g.step(1/30);hit=g.events.find(e=>e.type==='monsterHit'&&e.id===17);}
  assert.ok(hit,`${type.id} shot ${shot} actually reached its target`);assert.equal(hit.damage+hit.shieldDamage,1);hitCount++;
  if(shot<type.hitsToDefeat)assert.equal(m.defeated,false);else{assert.equal(m.defeated,true);assert.equal(m.hp,0);assert.equal(m.shieldHP,0);assert.equal(g.defeatedMonsters,1);}
 }
 assert.equal(g.score,0);assert.equal(g.collected.size,0);assert.equal(g.status,'playing');
 hitResults.push({id:type.id,tier:type.tier,name:type.name,rank:type.rank,expectedHits:type.hitsToDefeat,actualProjectileHits:hitCount,aliveBeforeFinalHit:beforeLast,defeated:m.defeated,score:g.score});
});

test('catalogue enemies still receive two damage from hammer and one from sword, including armor',()=>{
 for(const tier of [41,100]){const type=getEnemyType(tier),g=new Game(fixture(tierMonster(base(2.4),tier)));g.start();const m=g.monsters[0];assert.equal(g.action('attack'),true);assert.equal(m.hp+m.shieldHP,type.hitsToDefeat-2);if(tier===41)assert.equal(m.shieldHP,0,'hammer breaks a fresh two-point shield');tick(g,.7);assert.equal(g.setWeapon('sword'),true);assert.equal(g.action('attack'),true);assert.equal(m.hp+m.shieldHP,type.hitsToDefeat-3);}
});

after(()=>{if(hitResults.length!==100)return;fs.writeFileSync(new URL('./enemy-types-hit-results.json',import.meta.url),JSON.stringify({version:'100 catalogue enemy types',passed:100,total:100,method:'Normal launcher actions, flight and collision events; stationary legal fixtures with an obstacle behind each target. No health, shield or position edits during shooting.',totalProjectileHits:hitResults.reduce((sum,r)=>sum+r.actualProjectileHits,0),results:hitResults},null,2)+'\n');});

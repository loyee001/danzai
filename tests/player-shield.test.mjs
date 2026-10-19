import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {LEVELS} from '../dist/levels.js';
import {rankMonster} from '../dist/enemies.js';

const tick=(g,t,input={x:0,z:0})=>{for(let i=0;i<t*120;i++)g.step(1/120,input);};
const fixture=(extra={})=>({id:999,code:'SHIELD',spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[{id:0,x:0,z:0,y:0,w:80,d:80,type:'plain',checkpoint:false}],beans:[],requiredScore:100,totalScore:0,totalBeans:0,walls:[],hazards:[],portals:[],monsters:[],shields:[{id:0,x:0,z:0,y:.8,respawn:100}],bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40},...extra});
const target=rank=>rankMonster({id:0,type:'beetle',x:8,z:0,y:0,hp:3,speed:0,chaseSpeed:0,patrol:[{x:8,z:0}]},rank);

test('each of the 1000 maps offers one reachable player shield',()=>{
 for(const l of LEVELS){assert.equal(l.shields.length,1,`map ${l.id} has one pickup`);const s=l.shields[0];assert.ok(l.platforms.some(p=>Math.abs(s.x-p.x)<=p.w/2-.43&&Math.abs(s.z-p.z)<=p.d/2-.43),`map ${l.id} pickup is on walkable ground with room for the player`);}
});

test('picking up a shield schedules a 100-second refresh, pause freezes time, holding one does not consume a refreshed pickup',()=>{
 const g=new Game(fixture());assert.equal(g.player.shield,0);g.start();g.step(1/120);assert.equal(g.player.shield,1);const pickup=g.shieldPickups[0],at=pickup.respawnAt;assert.equal(pickup.available,false);assert.ok(Math.abs(at-g.time-100)<1e-6);
 g.pause();const before=structuredClone({time:g.time,pickup,shield:g.player.shield});tick(g,20);assert.deepEqual({time:g.time,pickup,shield:g.player.shield},before);g.start();
 while(g.time<at-.0100001)g.step(Math.min(1/30,at-.01-g.time));assert.equal(pickup.available,false,'99.99 elapsed seconds is too soon');g.step(at-g.time);assert.equal(pickup.available,true,'refresh happens after 100 elapsed seconds');assert.equal(g.player.shield,1);const refreshedAt=pickup.respawnAt;tick(g,1);assert.equal(pickup.available,true,'holding one leaves the pickup for later');assert.equal(pickup.respawnAt,refreshedAt);assert.equal(g.player.shield,1);
});

test('a shield blocks exactly one ordinary or boss contact without damage or knockback',()=>{
 for(const rank of ['normal','boss']){const g=new Game(fixture({monsters:[target(rank)]}));g.start();g.step(1/120);assert.equal(g.player.shield,1);for(let i=0;i<1200&&g.player.shield===1;i++)g.step(1/120,{x:1,z:0});assert.equal(g.player.shield,0);assert.equal(g.player.health,3,`${rank} blocked fully`);assert.equal(g.player.vy,0,'block does not launch player');assert.equal(g.player.ground,0);assert.ok(g.player.vx>0,'block does not reverse movement');assert.ok(g.player.invuln>0&&g.player.invuln<=.65+1e-6);
  for(let i=0;i<1800&&g.player.health===3;i++){const m=g.monsters[0],dx=m.x-g.player.x,dz=m.z-g.player.z,d=Math.hypot(dx,dz);g.step(1/120,{x:d?dx/d:0,z:d?dz/d:0});}assert.equal(g.player.health,rank==='boss'?1:2,'next contact is no longer protected');
 }
});

test('manual return and falling clear the shield while preserving bean score; restart resets pickups',()=>{
 const g=new Game(fixture({beans:[{id:0,x:0,z:0,y:.8,value:5}],totalScore:5,totalBeans:1}));g.start();g.step(1/120);assert.equal(g.player.shield,1);const at=g.shieldPickups[0].respawnAt;g.respawn();assert.equal(g.player.shield,0);assert.equal(g.score,5);assert.equal(g.shieldPickups[0].available,false);assert.equal(g.shieldPickups[0].respawnAt,at);g.restart();assert.equal(g.player.shield,0);assert.equal(g.score,0);assert.equal(g.shieldPickups[0].available,true);g.step(1/120);assert.equal(g.player.shield,1);
 const f=new Game(fixture({platforms:[{id:0,x:0,z:0,y:0,w:12,d:12,type:'plain',checkpoint:false}],beans:[{id:0,x:0,z:0,y:.8,value:5}],totalScore:5,totalBeans:1}));f.start();f.step(1/120);tick(f,3,{x:1,z:0});assert.ok(f.falls>0);assert.equal(f.player.shield,0);assert.equal(f.score,5);
});

test('teleportation retains the equipped one-hit shield',()=>{
 const g=new Game(fixture({portals:[{id:0,x:6,z:0,y:0,radius:1,target:1,platformId:0,label:'A'},{id:1,x:20,z:0,y:0,radius:1,target:0,platformId:0,label:'A'}]}));g.start();g.step(1/120);for(let i=0;i<300&&g.portalUses===0;i++)g.step(1/120,{x:1,z:0});assert.equal(g.portalUses,1);assert.equal(g.player.shield,1);assert.equal(g.shieldPickups[0].available,false);
});

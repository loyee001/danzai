import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,WEAPONS} from '../dist/engine.js';
import {LEVELS} from '../dist/levels.js';
import {ENEMY_RANKS,rankMonster} from '../dist/enemies.js';

const tick=(game,seconds,input={x:0,z:0})=>{for(let i=0;i<seconds*120;i++)game.step(1/120,input);};
const monster=(id,type,x,z=0)=>({id,type,x,z,y:0,hp:type==='beetle'?3:2,speed:0,patrol:[{x,z},{x,z}]});
const fixture=(extra={})=>{const beans=extra.beans??[];return {id:901,code:'COMBAT',spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[{id:0,x:0,z:0,w:80,d:80,y:0,type:'plain',checkpoint:false}],walls:[],hazards:[],beans,monsters:[],portals:[],requiredScore:100,totalBeans:beans.length,totalScore:beans.reduce((n,b)=>n+b.value,0),bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40},...extra};};
// Face the opponent through real movement input, then brake rather than changing player coordinates.
const faceRight=game=>{tick(game,.02,{x:1,z:0});tick(game,.12);};
const toward=(game,target)=>{const dx=target.x-game.player.x,dz=target.z-game.player.z,d=Math.hypot(dx,dz);return d>.01?{x:dx/d,z:dz/d}:{x:0,z:0};};

test('all 1000 maps contain patrol monsters on reachable walkable cells',()=>{
 for(const level of LEVELS){
  assert.ok(level.monsters.length>=3&&level.monsters.length<=10,`map ${level.id} monster count`);
  assert.equal(new Set(level.monsters.map(m=>m.id)).size,level.monsters.length);
  for(const m of level.monsters){
   assert.ok(['slime','beetle'].includes(m.type));
   assert.ok(Array.isArray(m.patrol)&&m.patrol.length>=2);
   for(const p of [{x:m.x,z:m.z},...m.patrol])assert.ok(level.platforms.some(f=>Math.abs(f.x-p.x)<.01&&Math.abs(f.z-p.z)<.01),`map ${level.id} patrol remains on map`);
   for(let i=1;i<m.patrol.length;i++){const a=m.patrol[i-1],b=m.patrol[i];assert.ok(Math.abs(Math.hypot(a.x-b.x,a.z-b.z)-level.cellSize)<.01,`map ${level.id} patrol uses neighboring cells`);assert.ok(Math.abs(a.x-b.x)<.01||Math.abs(a.z-b.z)<.01);}
  }
 }
});

test('three weapons are selectable and unknown choices leave the equipped weapon unchanged',()=>{
 const game=new Game(fixture());assert.equal(game.weapon,'hammer');
 for(const type of ['hammer','launcher','sword']){assert.ok(WEAPONS[type].name);for(const key of ['damage','range','duration'])assert.ok(WEAPONS[type][key]>0);assert.equal(WEAPONS[type].cooldown,0);assert.equal(game.setWeapon(type),true);assert.equal(game.weapon,type);}
 assert.equal(game.setWeapon('not-a-weapon'),false);assert.equal(game.weapon,'sword');
});

test('hammer defeats a two-heart slime in front and combat never supplies bean score',()=>{
 const game=new Game(fixture({monsters:[monster(0,'slime',2.4)]}));game.start();faceRight(game);
 assert.equal(game.action('attack'),true);tick(game,.12);
 assert.equal(game.monsters[0].hp,0);assert.equal(game.monsters[0].defeated,true);assert.equal(game.defeatedMonsters,1);assert.equal(game.score,0);assert.equal(game.collected.size,0);assert.equal(game.status,'playing');
 tick(game,1);assert.equal(game.defeatedMonsters,1);
});

test('sword can deal three consecutive real hits while its first attack animation is still running',()=>{
 const game=new Game(fixture({monsters:[monster(0,'beetle',3)]}));game.start();game.setWeapon('sword');faceRight(game);
 assert.equal(game.action('attack'),true);assert.equal(game.monsters[0].hp,2);assert.ok(game.player.attack>0);assert.equal(game.player.attackCd,0);
 assert.equal(game.action('attack'),true);assert.equal(game.monsters[0].hp,1);assert.equal(game.player.attackCd,0);
 assert.equal(game.action('attack'),true);assert.equal(game.monsters[0].hp,0);assert.equal(game.defeatedMonsters,1);assert.equal(game.actionCounts.attack,3);tick(game,.3);assert.equal(game.monsters[0].hp,0);assert.equal(game.defeatedMonsters,1);
});

test('attacks aim at the nearest exposed opponent while a distant opponent remains out of reach',()=>{
 const game=new Game(fixture({monsters:[monster(0,'slime',-2.4),monster(1,'slime',7)]}));game.start();faceRight(game);game.action('attack');tick(game,.05);
 assert.equal(game.monsters[0].hp,0);assert.ok(game.player.faceX<0);assert.equal(game.monsters[1].hp,2);
});

test('weapon switching is immediate during attack animations and the next attack uses the new weapon',()=>{
 const game=new Game(fixture({monsters:[{...monster(0,'beetle',2.4),hp:8}]}));game.start();faceRight(game);assert.equal(game.action('attack'),true);assert.equal(game.monsters[0].hp,6);assert.ok(game.player.attack>0);assert.equal(game.player.attackCd,0);
 assert.equal(game.setWeapon('launcher'),true);assert.equal(game.weapon,'launcher');assert.equal(game.player.attack,0);assert.equal(game.action('attack'),true);assert.equal(game.projectiles.length,1);assert.ok(game.player.attack>0);assert.equal(game.player.attackCd,0);
 assert.equal(game.setWeapon('sword'),true);assert.equal(game.weapon,'sword');assert.equal(game.player.attack,0);assert.equal(game.action('attack'),true);assert.equal(game.monsters[0].hp,5);assert.equal(game.player.attackCd,0);tick(game,.2);assert.equal(game.monsters[0].hp,4,'the in-flight bubble still does one damage');assert.equal(game.actionCounts.attack,3);
});

test('eight explicit attack actions emit eight real bubbles without waiting for animation or cooldown',()=>{
 const guard=rankMonster(monster(0,'beetle',6),'armored'),game=new Game(fixture({walls:[{x:7,z:0,w:.4,d:6,h:2.65}],monsters:[guard]}));game.start();game.setWeapon('launcher');faceRight(game);const total=game.monsters[0].hp+game.monsters[0].shieldHP;assert.equal(total,8);
 for(let frame=0;frame<total;frame++){assert.equal(game.action('attack'),true);assert.equal(game.player.attackCd,0);game.step(1/120);}
 assert.equal(game.projectiles.length,8,'all eight bubbles exist before reaching the target');assert.equal(game.monsters[0].hp+game.monsters[0].shieldHP,8);tick(game,.5);const hits=game.events.filter(e=>e.type==='monsterHit');assert.equal(hits.length,8);assert.equal(hits.reduce((sum,e)=>sum+e.damage+e.shieldDamage,0),8);assert.equal(game.monsters[0].defeated,true);assert.equal(game.projectiles.length,0);assert.equal(game.actionCounts.attack,8);assert.equal(game.score,0);
});

test('melee attacks and launcher shots are blocked by walls',()=>{
 for(const weapon of ['hammer','sword','launcher']){
  const game=new Game(fixture({walls:[{x:1.3,z:0,w:.4,d:12,h:2.65}],monsters:[monster(0,'slime',2.6)]}));game.start();game.setWeapon(weapon);faceRight(game);assert.equal(game.action('attack'),true);tick(game,.5);
  assert.equal(game.monsters[0].hp,2,`${weapon} does not penetrate a wall`);assert.equal(game.defeatedMonsters,0);assert.equal(game.projectiles.length,0);
 }
});

test('launcher projectiles travel before hitting and two separate shots defeat a slime',()=>{
 const game=new Game(fixture({monsters:[monster(0,'slime',7)]}));game.start();game.setWeapon('launcher');faceRight(game);
 assert.equal(game.action('attack'),true);assert.equal(game.monsters[0].hp,2);assert.equal(game.projectiles.length,1);tick(game,.04);assert.equal(game.monsters[0].hp,2);
 tick(game,.35);assert.equal(game.monsters[0].hp,1);assert.equal(game.projectiles.length,0);assert.equal(game.action('attack'),true);tick(game,.4);assert.equal(game.monsters[0].hp,0);assert.equal(game.defeatedMonsters,1);
});

test('a launcher shot retains its damage and light knockback after switching to hammer in flight',()=>{
 const game=new Game(fixture({monsters:[monster(0,'slime',12)]}));game.start();game.setWeapon('launcher');faceRight(game);assert.equal(game.action('attack'),true);tick(game,.2);
 assert.equal(game.projectiles.length,1);assert.equal(game.monsters[0].hp,2);assert.equal(game.setWeapon('hammer'),true);const before={x:game.monsters[0].x,z:game.monsters[0].z};
 tick(game,.5);assert.equal(game.weapon,'hammer');assert.equal(game.projectiles.length,0);assert.equal(game.monsters[0].hp,1);assert.equal(game.monsters[0].defeated,false);const knockback=Math.hypot(game.monsters[0].x-before.x,game.monsters[0].z-before.z);assert.ok(knockback>0&&knockback<=.300001,`launcher knockback remains light: ${knockback}`);
});

test('a thin wall prevents contact damage even when player and monster are within collision distance',()=>{
 const game=new Game(fixture({spawn:{x:-8,z:0,y:0},walls:[{x:-.2,z:0,w:.2,d:6,h:2.65}],monsters:[monster(0,'slime',.2)]}));game.start();tick(game,3,{x:1,z:0});
 assert.ok(game.player.x<-.7,'walking stops on the near side of the wall');assert.ok(Math.hypot(game.player.x-game.monsters[0].x,game.player.z-game.monsters[0].z)<1.03,'opponents are close enough for ordinary contact damage');assert.equal(game.player.invuln,0);assert.equal(game.player.health,3);assert.equal(game.events.filter(e=>e.type==='damage').length,0);
});

test('ready and pause freeze AI, projectiles, health and attack timers',()=>{
 const game=new Game(fixture({monsters:[{...monster(0,'slime',6),speed:2,patrol:[{x:6,z:0},{x:10,z:0}]}]}));
 const ready=structuredClone({monsters:game.monsters,player:game.player});assert.equal(game.action('attack'),false);tick(game,2);assert.deepEqual({monsters:game.monsters,player:game.player},ready);
 game.start();game.setWeapon('launcher');faceRight(game);game.action('attack');game.pause();const before=structuredClone({snapshot:game.snapshot(),monsters:game.monsters,projectiles:game.projectiles});assert.equal(game.action('attack'),false);tick(game,3,{x:1,z:0});assert.deepEqual({snapshot:game.snapshot(),monsters:game.monsters,projectiles:game.projectiles},before);
});

test('monster contact costs one heart, grants invulnerability and automatic recovery preserves score and defeated monsters',()=>{
 const game=new Game(fixture({spawn:{x:-6,z:0,y:0},beans:[{id:0,x:-6,z:0,y:.8,value:5}],monsters:[monster(0,'slime',-3.6),monster(1,'beetle',0)]}));game.start();faceRight(game);game.action('attack');tick(game,.12);assert.equal(game.defeatedMonsters,1);assert.equal(game.score,5);
 const target=game.monsters[1];for(let i=0;i<1200&&game.player.health===3;i++)game.step(1/120,toward(game,target));assert.equal(game.player.health,2);assert.ok(game.player.invuln>1);const hitPosition={x:game.player.x,z:game.player.z};tick(game,.45,toward(game,target));assert.equal(game.player.health,2);assert.ok(Math.hypot(game.player.x-hitPosition.x,game.player.z-hitPosition.z)>.01);
 for(let i=0;i<2400&&game.respawnDelay===0;i++)game.step(1/120,toward(game,target));assert.ok(game.respawnDelay>0,'third contact triggers recovery');assert.equal(game.score,5);assert.equal(game.defeatedMonsters,1);
 for(let i=0;i<240&&game.respawnDelay>0;i++)game.step(1/120);assert.equal(game.player.health,3);assert.equal(game.player.maxHealth,3);assert.ok(Math.abs(game.player.x+6)<.01);assert.equal(game.collected.size,1);assert.equal(game.score,5);assert.equal(game.monsters[0].defeated,true);
 game.setWeapon('launcher');faceRight(game);game.action('attack');assert.ok(game.projectiles.length>0);game.restart();assert.equal(game.score,0);assert.equal(game.collected.size,0);assert.equal(game.defeatedMonsters,0);assert.equal(game.projectiles.length,0);assert.equal(game.player.health,3);assert.deepEqual(game.monsters.map(m=>m.hp),[2,3]);assert.ok(game.monsters.every(m=>!m.defeated));
});

test('teleport keeps health, score and defeated state while removing active projectiles',()=>{
 const game=new Game(fixture({spawn:{x:-8,z:0,y:0},beans:[{id:0,x:-8,z:0,y:.8,value:5}],monsters:[monster(0,'slime',-5.6),monster(1,'beetle',0)],portals:[{id:0,x:6,z:0,y:0,radius:1,target:1,platformId:0,label:'A'},{id:1,x:20,z:0,y:0,radius:1,target:0,platformId:0,label:'A'}]}));game.start();faceRight(game);game.action('attack');tick(game,.12);assert.equal(game.defeatedMonsters,1);
 for(let i=0;i<1200&&game.player.health===3;i++)game.step(1/120,toward(game,game.monsters[1]));assert.equal(game.player.health,2);
 for(let i=0;i<1200&&game.player.x<4.3;i++)game.step(1/120,{x:1,z:0});assert.equal(game.portalUses,0);assert.equal(game.setWeapon('launcher'),true);assert.equal(game.action('attack'),true);assert.equal(game.projectiles.length,1);const health=game.player.health;assert.ok(health<3);
 for(let i=0;i<300&&game.portalUses===0;i++)game.step(1/120,{x:1,z:0});assert.equal(game.portalUses,1);assert.equal(game.player.health,health);assert.equal(game.score,5);assert.equal(game.defeatedMonsters,1);assert.equal(game.projectiles.length,0);
});

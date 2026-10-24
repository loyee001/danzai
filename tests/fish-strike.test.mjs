import test from 'node:test';
import assert from 'node:assert/strict';
import {fishStrike,FISH_RANGE,FISH_SWING_DURATION} from '../dist/combat.js';
import {Game} from '../dist/engine.js';
import {grantItems} from '../dist/gadgets.js';

const enemy=(id,x,z=0,extra={})=>({id,x,z,y:0,hp:998,maxHp:998,shieldHP:2,shieldMax:2,rank:'boss',state:'windup',windup:.4,dash:.3,defeated:false,...extra});
function fixture(monsters=[],extra={}){
 const game={player:{x:0,y:0,z:0,faceX:1,faceZ:0,health:3,attack:.12},level:{walls:[],hazards:[]},gadgets:{crates:[]},monsters,time:0,weapon:'launcher',score:17,collected:new Set([4]),defeatedMonsters:0,projectiles:[{id:3}],events:[],...extra};
 game.emit=(type,data)=>game.events.push({type,...data});return game;
}

test('one fish strike knocks out high-health and shielded enemies only inside its forward reach',()=>{
 assert.equal(FISH_RANGE,4.2);assert.ok(FISH_SWING_DURATION>0);
 const game=fixture([enemy(0,3),enemy(1,2,2),enemy(2,-2),enemy(3,4.21),enemy(4,2,0,{y:2.5})]);
 assert.equal(fishStrike(game),true);assert.deepEqual(game.monsters.map(m=>m.defeated),[true,true,false,false,false]);assert.equal(game.defeatedMonsters,2);
 for(const m of game.monsters.slice(0,2)){assert.equal(m.hp,0);assert.equal(m.shieldHP,0);assert.equal(m.state,'defeated');assert.equal(m.windup,0);assert.equal(m.dash,0);assert.ok(Math.abs(Math.hypot(m.fishKnockback.x,m.fishKnockback.z)-1)<1e-9);}
 assert.equal(game.weapon,'launcher');assert.equal(game.player.attack,.12);assert.deepEqual(game.projectiles,[{id:3}]);assert.equal(game.score,17);assert.deepEqual([...game.collected],[4]);
 assert.equal(game.events.filter(e=>e.type==='fishStrike').length,1);assert.deepEqual(game.events.find(e=>e.type==='fishStrike'),{type:'fishStrike',x:0,y:0,z:0,faceX:1,faceZ:0,range:4.2});
 for(const type of ['monsterHit','monsterDefeated'])assert.deepEqual(game.events.filter(e=>e.type===type).map(e=>e.source),['fish','fish']);
 assert.equal(fishStrike(game),true);assert.equal(game.defeatedMonsters,2);assert.equal(game.events.filter(e=>e.type==='monsterDefeated').length,2,'defeated monsters cannot count twice');
});

test('fish attacks do not penetrate walls, closed gates or placed boxes',()=>{
 const cases=[
  {level:{walls:[{x:1.4,z:0,w:.3,d:6,h:3}],hazards:[]}},
  {level:{walls:[],hazards:[{type:'gate',x:1.4,z:0,y:0,w:6,axis:'x',phase:0,speed:0}]}},
  {gadgets:{crates:[{id:'crate-1',x:1.7,z:0,y:0,w:2,d:2,h:1.25}]}}
 ];
 for(const spec of cases){const game=fixture([enemy(0,3)],spec);assert.equal(fishStrike(game),true);assert.equal(game.monsters[0].hp,998);assert.equal(game.monsters[0].shieldHP,2);assert.equal(game.defeatedMonsters,0);assert.equal(game.events.length,1,'only the empty swing is emitted');}
 const above=fixture([enemy(0,3)],{gadgets:{crates:[{id:'raised',x:1.7,z:0,y:3,w:2,d:2,h:1.25}]}});assert(fishStrike(above));assert.equal(above.monsters[0].defeated,true,'a box well above the strike cannot block it');
});

test('an empty fish swing succeeds, a defeated player cannot swing and zero direction has a forward fallback',()=>{
 const empty=fixture();assert.equal(fishStrike(empty),true);assert.equal(empty.events[0].type,'fishStrike');assert.equal(empty.defeatedMonsters,0);
 empty.player.health=0;assert.equal(fishStrike(empty),false);assert.equal(empty.events.length,1);
 const fallback=fixture([enemy(0,0,3)]);fallback.player.faceX=0;assert(fishStrike(fallback));assert.equal(fallback.monsters[0].defeated,true);assert.deepEqual(fallback.monsters[0].fishKnockback,{x:0,z:1});
});

test('the real gadget action requires a picked-up fish, consumes the last charge, freezes on pause and leaves weapons usable',()=>{
 const level={id:901,code:'FISH',spawn:{x:0,y:0,z:0},spawnPlatform:0,platforms:[{id:0,x:0,y:0,z:0,w:80,d:80,type:'plain'}],walls:[],hazards:[],beans:[],portals:[],gadgetPickups:[],monsters:[{...enemy(0,0,3),type:'slime',speed:0,patrol:[{x:0,z:3}]}],requiredScore:100,totalBeans:0,totalScore:0,bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40}};
 const game=new Game(level);game.start();game.setWeapon('sword');assert.equal(game.gadgets.inventory.fish,0);assert.equal(game.action('fish'),false);grantItems(game,{fish:1});assert.equal(game.action('fish'),true);assert.equal(game.gadgets.inventory.fish,0);assert.equal(game.gadgets.fishSwing,FISH_SWING_DURATION);assert.equal(game.gadgets.selected,'fish');assert.equal(game.monsters[0].defeated,true);assert.equal(game.weapon,'sword');assert.equal(game.score,0);assert.equal(game.action('fish'),false);
 game.pause();game.step(1/120);assert.equal(game.gadgets.fishSwing,FISH_SWING_DURATION);game.start();game.step(1/120);assert(game.gadgets.fishSwing<FISH_SWING_DURATION);assert.equal(game.action('attack'),true);assert.equal(game.actionCounts.attack,1);assert.equal(game.weapon,'sword');
});

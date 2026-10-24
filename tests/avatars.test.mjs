import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {AVATARS,DEFAULT_AVATAR,getAvatar} from '../dist/avatars.js';
import {Renderer} from '../dist/render.js';

test('eight original avatar descriptions are stable and have distinct costume geometry',()=>{
 assert.ok(AVATARS.length>=8);assert.equal(new Set(AVATARS.map(a=>a.id)).size,AVATARS.length);assert.equal(new Set(AVATARS.map(a=>a.hat)).size,AVATARS.length);
 for(const a of AVATARS){assert.ok(a.name&&a.icon);assert.match(a.color,/^#[a-f\d]{6}$/i);assert.match(a.accent,/^#[a-f\d]{6}$/i);assert.equal(getAvatar(a.id),a);}
 assert.equal(getAvatar('missing').id,DEFAULT_AVATAR);
 const renderer=Object.create(Renderer.prototype);renderer.character=renderer.makeEgg();renderer.makeWeapons();renderer.makePlayerShield();const signatures=new Set();
 for(const avatar of AVATARS){renderer.setAvatar(avatar.id);const pieces=[];renderer.avatarShell.traverse(o=>{if(o.isMesh)pieces.push([o.geometry.type,...o.position.toArray(),...o.scale.toArray()]);});signatures.add(JSON.stringify(pieces));}
 assert.equal(signatures.size,AVATARS.length);
});

test('switching avatar preserves the live player, weapons and shield and releases costume geometry',()=>{
 const renderer=Object.create(Renderer.prototype);renderer.character=renderer.makeEgg();renderer.character.position.set(3,2,-8);renderer.makeWeapons();renderer.makePlayerShield();renderer.scene=new T.Scene();renderer.makeGadgets();
 const gadgets=renderer.gadgetModels,grappleLine=renderer.grappleLine;
 assert.deepEqual([...gadgets.keys()].sort(),['crate','fish','grapple','jetpack']);assert(gadgets.get('crate').children.length>0,'held crate has its own visible geometry');assert(gadgets.get('fish').children.length>0,'held fish is a real three-dimensional item');
 const player=renderer.character,body=renderer.eggBody,weapon=renderer.weaponPivot,models=renderer.weaponModels,shield=renderer.playerShield,arc=renderer.swordArc;
 renderer.setAvatar('space');let released=0;renderer.avatarShell.traverse(o=>{if(o.geometry?.type==='TorusGeometry')o.geometry.addEventListener('dispose',()=>released++);});renderer.setAvatar('bunny');
 assert.equal(renderer.character,player);assert.equal(renderer.eggBody,body);assert.equal(renderer.weaponPivot,weapon);assert.equal(renderer.weaponModels,models);assert.equal(weapon.parent,body);assert.equal(renderer.playerShield,shield);assert.equal(shield.parent,player);assert.equal(renderer.swordArc,arc);assert.equal(renderer.gadgetModels,gadgets);assert.equal(renderer.grappleLine,grappleLine);assert.equal(gadgets.get('jetpack').parent,body);assert.deepEqual(player.position.toArray(),[3,2,-8]);assert.ok(released>0);
 assert.equal(renderer.setAvatar('invalid').id,DEFAULT_AVATAR);assert.equal(renderer.leftArm.parent,renderer.avatarShell);assert.equal(renderer.rightFoot.parent,renderer.avatarShell);
});

function makeRenderer(){
 const renderer=Object.create(Renderer.prototype);renderer.scene=new T.Scene();renderer.scene.background=new T.Color('#80d4ff');renderer.scene.fog=new T.Fog('#bdeaff',100,300);renderer.stage=new T.Group();renderer.scene.add(renderer.stage);renderer.camera=new T.PerspectiveCamera();renderer.character=renderer.makeEgg();renderer.makeWeapons();renderer.makePlayerShield();renderer.makeGadgets();renderer.monsterMeshes=new Map();renderer.particles=[];return renderer;
}
function withCanvas(fn){
 const previous=globalThis.document;globalThis.document={createElement(type){assert.equal(type,'canvas');const context=new Proxy({},{get:(target,key)=>target[key]??(()=>{})});return {getContext:()=>context};}};
 try{return fn();}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
}
const gadgetGame=()=>({time:0,player:{x:0,y:0,z:0},gadgets:{selected:'jetpack',inventory:{jetpack:0,crate:0,grapple:0,fish:0},crates:[],jetpack:null,grapple:null,fishSwing:0},gadgetPickups:[]});

test('empty gadget inventories show no held item, while active flight, pull and fish swing stay visible',()=>{
 const renderer=makeRenderer(),game=gadgetGame();renderer.drawGadgets(game);assert([...renderer.gadgetModels.values()].every(m=>!m.visible));
 game.gadgets.selected='fish';game.gadgets.inventory.fish=1;renderer.drawGadgets(game);assert(renderer.gadgetModels.get('fish').visible);game.gadgets.inventory.fish=0;game.gadgets.fishSwing=.42;renderer.drawGadgets(game);assert(renderer.gadgetModels.get('fish').visible);const initial=renderer.gadgetModels.get('fish').rotation.toArray();game.gadgets.fishSwing=.21;game.time=.21;renderer.drawGadgets(game);assert.notDeepEqual(renderer.gadgetModels.get('fish').rotation.toArray(),initial);
 const frozen=renderer.gadgetModels.get('fish').rotation.toArray();renderer.drawGadgets(game);assert.deepEqual(renderer.gadgetModels.get('fish').rotation.toArray(),frozen);game.gadgets.fishSwing=0;renderer.drawGadgets(game);assert(!renderer.gadgetModels.get('fish').visible);
 game.gadgets.jetpack={remaining:1};game.gadgets.grapple={remaining:1,anchor:{x:4,y:4,z:4}};renderer.drawGadgets(game);assert(renderer.gadgetModels.get('jetpack').visible);assert(renderer.gadgetModels.get('grapple').visible);assert(renderer.grappleLine.visible);assert(renderer.grappleLock.visible);
});

test('four pickup models hover above their real floors, reuse labels, hide when collected and release resources on removal',()=>withCanvas(()=>{
 const renderer=makeRenderer(),game=gadgetGame();game.gadgetPickups=['jetpack','crate','grapple','fish'].map((gadget,i)=>({id:gadget,gadget,x:i*4,y:2,z:8,amount:i+1,available:true}));renderer.drawGadgets(game);assert.equal(renderer.gadgetPickupMeshes.size,4);
 for(const [i,pickup]of game.gadgetPickups.entries()){const view=renderer.gadgetPickupMeshes.get(pickup.id);assert(view.root.visible);assert.deepEqual(view.root.position.toArray(),[i*4,2,-8]);assert.equal(view.icon.position.y,.65);assert(view.icon.children.length>0);assert(view.captionText.endsWith('+'+(i+1)));}
 const fish=renderer.gadgetPickupMeshes.get('fish'),texture=fish.caption.material.map;game.time=.1;renderer.drawGadgets(game);assert.equal(renderer.gadgetPickupMeshes.get('fish'),fish);assert.equal(fish.caption.material.map,texture,'label texture is not rebuilt each frame');game.gadgetPickups[3].available=false;renderer.drawGadgets(game);assert(!fish.root.visible);game.gadgetPickups[3].available=true;renderer.drawGadgets(game);assert(fish.root.visible);
 let geometryDisposed=0,textureDisposed=0;fish.icon.traverse(o=>{if(o.geometry?.type==='ExtrudeGeometry')o.geometry.addEventListener('dispose',()=>geometryDisposed++);});texture.addEventListener('dispose',()=>textureDisposed++);game.gadgetPickups.pop();renderer.drawGadgets(game);assert.equal(renderer.gadgetPickupMeshes.size,3);assert.equal(fish.root.parent,null);assert.equal(geometryDisposed,1);assert.equal(textureDisposed,1);
 const crate=renderer.gadgetPickupMeshes.get('crate');let instanceDisposed=0;crate.icon.traverse(o=>{if(o.isInstancedMesh)o.addEventListener('dispose',()=>instanceDisposed++);});renderer.load({mode:'challenge',spawn:{x:0,z:0},platforms:[],walls:[],hazards:[],portals:[],monsters:[],beans:[]});assert.equal(instanceDisposed,3);assert.equal(renderer.gadgetPickupMeshes.size,0);assert.equal(renderer.grappleLine.visible,false);assert.equal(renderer.grappleLock.visible,false);
}));

test('a fish-defeated enemy flies away from its actual position and disappears without moving its collision state',()=>withCanvas(()=>{
 const renderer=makeRenderer(),monster={id:7,type:'slime',x:8,y:0,z:5,hp:0,maxHp:2,rank:'normal',defeated:true,fishKnockback:{x:1,z:0}},game={monsters:[monster]};renderer.drawMonsters(game,.1,0);
 const view=renderer.monsterMeshes.get(7);assert(view.root.visible);assert(Math.abs(view.root.position.x-8.9)<1e-9);assert.equal(view.root.position.z,-5);assert(view.actor.position.y>0);assert(view.actor.rotation.x>0);assert(!view.health.visible);assert(!view.status.visible);assert.deepEqual({x:monster.x,y:monster.y,z:monster.z},{x:8,y:0,z:5});
 renderer.drawMonsters(game,.81,.81);assert(!view.root.visible);assert(renderer.particles.length<=180);
}));

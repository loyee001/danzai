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
 const player=renderer.character,body=renderer.eggBody,weapon=renderer.weaponPivot,models=renderer.weaponModels,shield=renderer.playerShield,arc=renderer.swordArc;
 renderer.setAvatar('space');let released=0;renderer.avatarShell.traverse(o=>{if(o.geometry?.type==='TorusGeometry')o.geometry.addEventListener('dispose',()=>released++);});renderer.setAvatar('bunny');
 assert.equal(renderer.character,player);assert.equal(renderer.eggBody,body);assert.equal(renderer.weaponPivot,weapon);assert.equal(renderer.weaponModels,models);assert.equal(weapon.parent,body);assert.equal(renderer.playerShield,shield);assert.equal(shield.parent,player);assert.equal(renderer.swordArc,arc);assert.equal(renderer.gadgetModels,gadgets);assert.equal(renderer.grappleLine,grappleLine);assert.equal(gadgets.get('jetpack').parent,body);assert.deepEqual(player.position.toArray(),[3,2,-8]);assert.ok(released>0);
 assert.equal(renderer.setAvatar('invalid').id,DEFAULT_AVATAR);assert.equal(renderer.leftArm.parent,renderer.avatarShell);assert.equal(renderer.rightFoot.parent,renderer.avatarShell);
});

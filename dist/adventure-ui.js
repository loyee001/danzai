import {CHALLENGES} from './challenges.js';
import {GADGETS,grantItems} from './gadgets.js';
import {AVATARS,DEFAULT_AVATAR,getAvatar} from './avatars.js';
import {RewardedAdSession} from './rewarded-ad.js';

const $=selector=>document.querySelector(selector),keys={jetpack:'Z',electricBox:'X',grapple:'C'};
export function createAdventureUI({game,getRenderer,showDialog,closeDialog,getDialog,toast,clearControls}){
 let avatar=DEFAULT_AVATAR,ad=null,navigation=null;
 try{avatar=getAvatar(localStorage.getItem('eggy-avatar-v1')).id;}catch{}
 $('#adventure-panel').innerHTML=`<div class="adventure-links"><button id="challenge-guide">闯关入口 ↗</button><button id="wardrobe">🥚 换形象</button><button id="reward-ad">补给广告</button></div><div class="gadget-slots">${Object.entries(GADGETS).map(([id,g])=>`<button data-gadget="${id}" aria-label="${g.name}，按${keys[id]}"><kbd>${keys[id]}</kbd><i>${g.icon}</i><span>${g.name}</span><b id="${id}-count">3</b></button>`).join('')}</div><small id="gadget-status">Z 喷气 · X 电箱 · C 抛钩锁定</small><small id="portal-navigation" hidden></small><button id="challenge-exit" hidden>退出闯关 · 返回草坪</button>`;
 $('#adventure-panel').setAttribute('aria-label','闯关、道具和蛋仔形象');

 function cancelAd(){ad?.cancel();ad=null;}
 function syncScene(){
  const l=game.level,challenge=l.mode==='challenge';
  document.body.classList.toggle('challenge-mode',challenge);
  $('#challenge-goal').hidden=!challenge;$('.bean-goal').hidden=challenge;$('#challenge-exit').hidden=!challenge;
  $('#challenge-name').textContent=l.challenge?.name||'闯关模式';
  $('#level-name').textContent=l.layout;$('#world-name').textContent=challenge?'闯关模式 · 检查点冒险':`第 ${(l.chapter??0)+1} 章 · ${l.world.name}`;
  $('#mission-tip').textContent=challenge?l.challenge.instruction:`目标 ${l.requiredScore} 分 · ${l.id>500?'1000 分豆已解锁':'正分豆 30 秒刷新'}`;
  $('#current-code').textContent=l.code.split(' / ')[0];document.title=`蛋仔吃豆岛 · ${l.layout} ${l.code}`;
  getRenderer()?.setAvatar(avatar);
  if(challenge){navigation=null;$('#ready').hidden=true;document.body.classList.remove('awaiting-start');}
 }
 function useItem(id){
  if(getDialog())return;
  if(game.status==='ready'){game.start();$('#ready').hidden=true;document.body.classList.remove('awaiting-start');}
  if(!game.action(id))toast(game.gadgets.inventory[id]<=0?'道具用完了，可观看补给试玩广告领取':id==='grapple'?'前方没有可锁定的安全落脚点；转向发光锚点再抛钩':id==='electricBox'?'请站稳后朝安全地面放电箱，最多同时放 3 个':'喷气背包正在使用，或钩爪正在拉动');
  document.activeElement?.blur();
 }
 function challengeGuide(){
  const challenge=game.level.mode==='challenge';
  showDialog('challenge-guide',`<div class="eyebrow">PORTAL ADVENTURES</div><h2 id="modal-title">走进传送门，开始闯关</h2><p>起点附近的大门写着「闯关入口」。走进对应门即可进入；沿落脚台到金色终点门，才算闯关成功。岩浆或掉落会从最近检查点复活。</p><div class="challenge-cards">${CHALLENGES.map((c,i)=>`<article style="--portal-color:${c.color}"><b>${['♨','▥','🪝'][i]}</b><h3>${c.name}</h3><p>${c.instruction}</p><button class="secondary" data-guide-id="${c.id}" ${challenge?'disabled':''}>标记入口方向 →</button></article>`).join('')}</div><p>道具初始各 3 个，死亡和进出闯关不会退还消耗；数量不足时，可在「补给广告」观看本地试玩推广领取。闯关期间，原吃豆地图的计时和进度暂停。</p><button class="primary" id="guide-close">${challenge?'继续当前闯关':'去找入口'}</button>`);
  for(const button of document.querySelectorAll('[data-guide-id]'))button.onclick=()=>{navigation=button.dataset.guideId;closeDialog();toast('入口已标记，按道具栏下方方向走进大门');};
  $('#guide-close').onclick=()=>closeDialog();
 }
 function wardrobe(){
  showDialog('wardrobe',`<div class="eyebrow">DRESS UP · FREE</div><h2 id="modal-title">选一个今天的蛋仔</h2><p>8 种形象全部免费。兔耳、太空头盔、龙鳍、小翅膀和帽子都会出现在角色身上。</p><div class="avatar-grid">${AVATARS.map(a=>`<button data-avatar="${a.id}" aria-pressed="${a.id===avatar}" style="--avatar-color:${a.color};--avatar-accent:${a.accent}"><span class="avatar-preview">${a.icon}</span><strong>${a.name}</strong><small>${a.id===avatar?'✓ 正在使用':'点击换装'}</small></button>`).join('')}</div><button class="primary" id="wardrobe-close">穿好啦，继续冒险</button>`);
  for(const button of document.querySelectorAll('[data-avatar]'))button.onclick=()=>{
   avatar=getAvatar(button.dataset.avatar).id;getRenderer()?.setAvatar(avatar);try{localStorage.setItem('eggy-avatar-v1',avatar);}catch{}
   for(const card of document.querySelectorAll('[data-avatar]')){const on=card.dataset.avatar===avatar;card.setAttribute('aria-pressed',String(on));card.querySelector('small').textContent=on?'✓ 正在使用':'点击换装';}
   $('#wardrobe').textContent=`${getAvatar(avatar).icon} 换形象`;
  };
  $('#wardrobe-close').onclick=()=>closeDialog();
 }
 function reward(){
  cancelAd();const session=new RewardedAdSession(6);session.suspend();ad=session;
  showDialog('reward',`<div class="eyebrow">OPTIONAL REWARD · LOCAL PREVIEW</div><h2 id="modal-title">补给试玩广告</h2><div class="local-ad-label">本地模拟广告 · 未接入真实广告平台</div><div class="reward-stage"><span>🚀 ⚡ 🪝</span><h3>下一座岛，就在前方</h3><p>试试喷气越过缺口，用钩爪锁住落脚台，电箱能帮你挡住追来的怪物。</p><div class="reward-progress"><i id="reward-fill"></i></div><strong id="reward-countdown">观看 6 秒后可领取</strong></div><p>完整观看可得：喷气背包 +1、电箱 +1、钩爪 +2；每种最多 9 个。提前关闭不会发奖励，游戏暂停。</p><button class="primary" id="claim-reward" disabled>观看中 · 6 秒</button><button class="secondary" id="cancel-reward">关闭，继续游戏</button>`);
  $('#cancel-reward').onclick=()=>closeDialog();
  $('#claim-reward').onclick=()=>{
   if(ad!==session||getDialog()!=='reward'||!session.claim())return;
   const added=grantItems(game,{jetpack:1,electricBox:1,grapple:2});closeDialog();toast(`补给已领取：喷气 +${added.jetpack} · 电箱 +${added.electricBox} · 钩爪 +${added.grapple}`);
  };
 }
 function challengeResult(e){
  showDialog('challenge-result',`<div class="result"><div class="eyebrow">ADVENTURE COMPLETE</div><div class="result-mark">🏁</div><h2 id="modal-title">${e.name}，闯关成功！</h2><p>你走进了金色终点门，已返回原来的吃豆草坪。</p><div class="result-detail"><div>${e.time.toFixed(1)} 秒<small>闯关用时</small></div><div>${e.falls}<small>跌落次数</small></div></div><button class="primary" id="challenge-result-close">继续吃豆冒险</button><button class="secondary" id="challenge-more">查看其他闯关入口</button></div>`);
  $('#challenge-result-close').onclick=()=>closeDialog();$('#challenge-more').onclick=challengeGuide;
 }
 function handleEvent(e){
  if(e.type==='challengeEnter'||e.type==='challengeExit'){
   clearControls();getRenderer()?.load(game.level);syncScene();
   toast(e.type==='challengeEnter'?`进入${e.name} · 找绿色检查点，走到金色终点门`:'返回吃豆草坪，探索进度保留');return true;
  }
  if(e.type==='challengeComplete'){challengeResult(e);return true;}
  if(e.type==='gadgetStart'){toast(e.gadget==='grapple'?'钩爪已锁定，正在拉向落脚点':e.gadget==='jetpack'?'喷气背包启动 · 5 秒升空，可控制方向':'电箱已放置 · 附近敌人会被电击');return true;}
  return false;
 }
 function frame(dt){
  const g=game.gadgets,challenge=game.level.mode==='challenge';
  for(const [id,item]of Object.entries(GADGETS)){const button=$(`[data-gadget="${id}"]`);$(`#${id}-count`).textContent=g.inventory[id];button.classList.toggle('selected',g.selected===id);button.classList.toggle('empty',g.inventory[id]===0);button.setAttribute('aria-label',`${item.name}，剩余${g.inventory[id]}个，按${keys[id]}`);}
  $('#gadget-status').textContent=g.grapple?'🪝 已锁定 · 再按 C 可收钩':g.jetpack?`🚀 喷气中 · ${g.jetpack.remaining.toFixed(1)} 秒`:g.electricBoxes.length?`⚡ 场上电箱 ${g.electricBoxes.length} 个`:'Z 喷气 · X 电箱 · C 抛钩锁定';
  const gate=(game.level.challengePortals||[]).find(p=>p.challengeId===navigation),nav=$('#portal-navigation');nav.hidden=!gate;
  if(gate){const dx=gate.x-game.player.x,dz=gate.z-game.player.z;nav.textContent=`${gate.name} ${Math.ceil(Math.hypot(dx,dz))} 米 · ${Math.abs(dx)<2?'':dx>0?'向右':'向左'}${Math.abs(dz)<2?'':dz>0?'向前':'向后'}`;}
  if(challenge){$('#challenge-route').textContent=`检查点 ${game.checkpointId+1} · 到终点 ${Math.max(0,Math.ceil(Math.hypot(game.player.x-game.level.finishPortal.x,game.player.z-game.level.finishPortal.z)))} 米`;}
  if(ad){
   if(getDialog()!=='reward')cancelAd();
   else{ad.tick(dt,!document.hidden&&document.hasFocus());$('#reward-fill').style.width=`${ad.elapsed/ad.duration*100}%`;$('#reward-countdown').textContent=ad.ready?'已看完，可以领取补给':`观看 ${ad.remaining} 秒后可领取`;$('#claim-reward').disabled=!ad.ready;$('#claim-reward').textContent=ad.ready?'领取道具补给':`观看中 · ${ad.remaining} 秒`;}
  }
 }
 function enhanceHelp(){
  $('#modal-content .help-grid')?.insertAdjacentHTML('afterbegin',`<div class="help-card"><h3>闯关 / 道具 / 换形象</h3><kbd>B 闯关指引</kbd> <kbd>Z 喷气</kbd> <kbd>X 电箱</kbd> <kbd>C 钩爪</kbd> <kbd>V 换装</kbd><p>走进起点附近写着「闯关入口」的大门，可挑战别踩岩浆、机关跳台、空中钩爪。踩检查点保存落脚位置，必须走到金色终点门才过关。喷气背包升空 5 秒；电箱放在前方安全地面，8 秒内电击并暂停附近怪物；钩爪锁住面朝方向 30 米内安全落脚点，再沿绳子拉过去，再按 C 可收回，不能勾虚空或穿墙。初始各 3 个，上限各 9；死亡和进出闯关不会退还消耗。8 种原创形象免费切换。看完 6 秒本地模拟补给广告，可获得喷气 +1、电箱 +1、钩爪 +2，提前关闭不发奖励。</p></div>`);
 }
 $('#challenge-guide').onclick=challengeGuide;$('#wardrobe').onclick=wardrobe;$('#reward-ad').onclick=reward;
 addEventListener('blur',()=>ad?.suspend());addEventListener('focus',()=>ad?.suspend());document.addEventListener('visibilitychange',()=>ad?.suspend());
 $('#challenge-exit').onclick=()=>{clearControls();game.exitChallenge();};
 for(const button of document.querySelectorAll('[data-gadget]'))button.onclick=()=>useItem(button.dataset.gadget);
 return {syncScene,useItem,challengeGuide,wardrobe,cancelAd,frame,handleEvent,enhanceHelp,get avatar(){return avatar;}};
}

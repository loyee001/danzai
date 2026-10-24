import {CHALLENGES} from './challenges.js';
import {GADGETS} from './gadgets.js';
import {AVATARS,DEFAULT_AVATAR,getAvatar} from './avatars.js';
import {RewardedAdSession} from './rewarded-ad.js';

const $=selector=>document.querySelector(selector),keys={jetpack:'Z',crate:'X',grapple:'C',fish:'G'};
export function createAdventureUI({game,getRenderer,showDialog,closeDialog,getDialog,toast,clearControls,resetPlayer}){
 let avatar=DEFAULT_AVATAR,ad=null,navigation=null,challengePage=0;const challengeRecords={};
 try{avatar=getAvatar(localStorage.getItem('eggy-avatar-v1')).id;}catch{}
 try{const saved=JSON.parse(localStorage.getItem('eggy-challenges-v1')||'{}');for(const c of CHALLENGES)if(saved[c.id]===true)challengeRecords[c.id]=true;}catch{}
 $('#adventure-panel').innerHTML=`<div class="adventure-links"><button id="challenge-guide">闯关 1–50 ↗</button><button id="wardrobe">🥚 换形象</button><button id="reward-ad">补给广告</button></div><div class="gadget-slots">${Object.entries(GADGETS).map(([id,g])=>`<button data-gadget="${id}" aria-label="${g.name}，尚未拾取，按${keys[id]}"><kbd>${keys[id]}</kbd><i>${g.icon}</i><span>${g.name}</span><b id="${id}-count">0</b></button>`).join('')}</div><small id="gadget-status">开局没有道具 · 靠近地图上的发光道具拾取</small><small id="portal-navigation" hidden></small><button id="reset-player" class="reset-player">↺ 复位 <span>R + U + O</span></button><button id="challenge-exit" hidden>退出闯关 · 返回草坪</button>`;
 $('#adventure-panel').setAttribute('aria-label','闯关、道具和蛋仔形象');

 function cancelAd(){ad?.cancel();ad=null;}
 function syncScene(){
  const l=game.level,challenge=l.mode==='challenge';
  document.body.classList.toggle('challenge-mode',challenge);
  $('#challenge-goal').hidden=!challenge;$('.bean-goal').hidden=challenge;$('#challenge-exit').hidden=!challenge;
  $('#challenge-name').textContent=challenge?`第 ${l.challenge.number} / ${CHALLENGES.length} 关 · ${l.challenge.name}`:'闯关模式';
  $('#level-name').textContent=l.layout;$('#world-name').textContent=challenge?`闯关模式 · 第 ${l.challenge.number} / ${CHALLENGES.length} 关`:`第 ${(l.chapter??0)+1} 章 · ${l.world.name}`;
  $('#level-number').textContent=challenge?l.challenge.number:l.id;$('#level-total').textContent=challenge?CHALLENGES.length:1000;$('.level-disc').textContent=String(challenge?l.challenge.number:l.id).padStart(2,'0');
  $('#mission-title').textContent=challenge?`第 ${l.challenge.number} 关 · 闯关挑战`:`第 ${l.id} 关 · 积分挑战`;
  $('#mission-tip').textContent=challenge?l.challenge.instruction:`目标 ${l.requiredScore} 分 · ${l.id>500?'1000 分豆已解锁':'正分豆 30 秒刷新'}`;
  $('#current-code').textContent=l.code.split(' / ')[0];document.title=`蛋仔吃豆岛 · ${l.layout} ${l.code}`;
  getRenderer()?.setAvatar(avatar);
  if(challenge){navigation=null;$('#ready').hidden=true;document.body.classList.remove('awaiting-start');}
 }
 function useItem(id){
  if(getDialog())return;
  if(game.status==='ready'){game.start();$('#ready').hidden=true;document.body.classList.remove('awaiting-start');}
  if(!game.action(id))toast(game.gadgets.inventory[id]<=0?'还没有这个道具，先走近地图上对应的发光道具拾取':id==='grapple'?'前方没有可锁定的安全落脚点；转向发光锚点再抛钩':id==='crate'?'请站稳后朝空地放箱，或朝已有箱子叠放；最多 3 层、场上 9 个':'喷气背包正在使用，或钩爪正在拉动');
  document.activeElement?.blur();
 }
 function challengeGuide(){
  const challenge=game.level.mode==='challenge',page=CHALLENGES.slice(challengePage*10,challengePage*10+10);
  showDialog('challenge-guide',`<div class="eyebrow">PORTAL ADVENTURES · ${CHALLENGES.length} LEVELS</div><h2 id="modal-title">50 关闯关大厅</h2><p>已通关 ${Object.keys(challengeRecords).length} / ${CHALLENGES.length} 关。选择一关后，起点的大门会标明关卡编号和名字；走进该传送门才开始挑战。沿检查点到金色终点门才算过关。</p><nav class="challenge-pages" aria-label="闯关关卡分页">${Array.from({length:5},(_,i)=>`<button data-challenge-page="${i}" aria-pressed="${i===challengePage}">第 ${i*10+1}–${i*10+10} 关</button>`).join('')}</nav><div class="challenge-cards">${page.map(c=>`<article style="--portal-color:${c.color}"><b>${String(c.number).padStart(2,'0')}</b><h3>${c.name}</h3><p>${c.instruction}</p><small>${challengeRecords[c.id]?'✓ 已通关':'尚未通关'}</small><button class="secondary" data-guide-id="${c.id}">${challenge?'返回草坪，标记入口':'标记本关传送门'} →</button></article>`).join('')}</div><p>喷气、垫脚箱、钩爪、咸鱼都要走近拾取，开局数量为 0。闯关期间原吃豆地图的进度暂停；道具消耗不会因进出关卡而退还。</p><button class="primary" id="guide-close">${challenge?'继续当前闯关':'去找入口'}</button>`);
  for(const button of document.querySelectorAll('[data-challenge-page]'))button.onclick=()=>{challengePage=Number(button.dataset.challengePage);challengeGuide();};
  for(const button of document.querySelectorAll('[data-guide-id]'))button.onclick=()=>{if(game.level.mode==='challenge')game.exitChallenge();if(game.chooseChallenge(button.dataset.guideId)){navigation=button.dataset.guideId;closeDialog();toast('关卡入口已标记，按道具栏下方方向走进大门');}};
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
  showDialog('reward',`<div class="eyebrow">OPTIONAL REWARD · LOCAL PREVIEW</div><h2 id="modal-title">地图道具补给</h2><div class="local-ad-label">本地模拟广告 · 未接入真实广告平台</div><div class="reward-stage"><span>🚀 📦 🪝 🐟</span><h3>下一座岛，就在前方</h3><p>背包开局是空的。找到发光道具，走近拾取，再用咸鱼把拦路敌人击飞！</p><div class="reward-progress"><i id="reward-fill"></i></div><strong id="reward-countdown">观看 6 秒后可补充地图道具</strong></div><p>完整观看可让本场景已拾取的道具重新出现，需要走到原处拾取才会增加库存。每种最多携带 9 个。提前关闭没有补给，游戏暂停。</p><button class="primary" id="claim-reward" disabled>观看中 · 6 秒</button><button class="secondary" id="cancel-reward">关闭，继续游戏</button>`);
  $('#cancel-reward').onclick=()=>closeDialog();
  $('#claim-reward').onclick=()=>{
   if(ad!==session||getDialog()!=='reward'||!session.claim())return;
   const restored=game.replenishGadgetPickups();closeDialog();toast(restored?`地图上 ${restored} 处道具已补充，走近拾取后才会加入背包`:'地图道具还在原处，走近发光道具即可拾取');
  };
 }
 function challengeResult(e){
  challengeRecords[e.challengeId]=true;try{localStorage.setItem('eggy-challenges-v1',JSON.stringify(challengeRecords));}catch{}
  const index=CHALLENGES.findIndex(c=>c.id===e.challengeId),next=CHALLENGES[index+1];
  showDialog('challenge-result',`<div class="result"><div class="eyebrow">ADVENTURE COMPLETE · ${Object.keys(challengeRecords).length} / ${CHALLENGES.length}</div><div class="result-mark">🏁</div><h2 id="modal-title">第 ${index+1} 关 · ${e.name}，成功！</h2><p>你走进了金色终点门，已返回原来的吃豆草坪。</p><div class="result-detail"><div>${e.time.toFixed(1)} 秒<small>闯关用时</small></div><div>${e.falls}<small>跌落次数</small></div></div>${next?`<button class="primary" id="challenge-next">下一关 · ${next.name} ↗</button>`:''}<button class="secondary" id="challenge-result-close">继续吃豆冒险</button><button class="secondary" id="challenge-more">查看 50 关闯关大厅</button></div>`);
  if(next)$('#challenge-next').onclick=()=>{game.chooseChallenge(next.id);navigation=next.id;closeDialog();toast(`第 ${next.number} 关入口已标记，走进传送门继续`);};
  $('#challenge-result-close').onclick=()=>closeDialog();$('#challenge-more').onclick=()=>{challengePage=Math.floor((index+1)/10)%5;challengeGuide();};
 }
 function handleEvent(e){
  if(e.type==='challengeSelected'){clearControls();getRenderer()?.load(game.level);syncScene();return true;}
  if(e.type==='challengeEnter'||e.type==='challengeExit'){
   clearControls();getRenderer()?.load(game.level);syncScene();
   toast(e.type==='challengeEnter'?`进入${e.name} · 找绿色检查点，走到金色终点门`:'返回吃豆草坪，探索进度保留');return true;
  }
  if(e.type==='challengeComplete'){challengeResult(e);return true;}
  if(e.type==='gadgetCollected'){toast(`发现${GADGETS[e.gadget].name} +${e.amount} · 按 ${keys[e.gadget]} 使用`);return true;}
  if(e.type==='gadgetStart'){toast(e.gadget==='fish'?'咸鱼打击！把面前的敌人击飞':e.gadget==='grapple'?'钩爪已锁定，正在拉向落脚点':e.gadget==='jetpack'?'喷气背包启动 · 5 秒升空，可控制方向':'垫脚箱已放好 · 空格跳上箱顶，再按 X 可叠高');return true;}
  return false;
 }
 function frame(dt){
  const g=game.gadgets,challenge=game.level.mode==='challenge';
  for(const [id,item]of Object.entries(GADGETS)){const button=$(`[data-gadget="${id}"]`);$(`#${id}-count`).textContent=g.inventory[id];button.classList.toggle('selected',g.selected===id&&g.inventory[id]>0);button.classList.toggle('empty',g.inventory[id]===0);button.setAttribute('aria-label',`${item.name}，${g.inventory[id]>0?`剩余${g.inventory[id]}个`:'尚未拾取'}，按${keys[id]}`);}
  $('#gadget-status').textContent=g.fishSwing>0?'🐟 咸鱼打击！':g.grapple?'🪝 已锁定 · 再按 C 可收钩':g.jetpack?`🚀 喷气中 · ${g.jetpack.remaining.toFixed(1)} 秒`:g.crates.length?`📦 已放 ${g.crates.length} 个 · 空格跳上箱顶 · X 叠高`:'靠近发光道具拾取 · Z 喷气 / X 箱 / C 钩 / G 咸鱼';
  const reset=$('#reset-player'),cooldown=game.resetCooldown||0;reset.disabled=cooldown>0;reset.innerHTML=`↺ 复位 <span>${cooldown>0?`${Math.ceil(cooldown)} 秒`:'R + U + O'}</span>`;reset.setAttribute('aria-label',cooldown>0?`复位冷却，剩余${Math.ceil(cooldown)}秒`:'复位，同时按住R、U、O，冷却10秒');
  const gate=(game.level.challengePortals||[]).find(p=>p.challengeId===navigation),nav=$('#portal-navigation');nav.hidden=!gate;
  if(gate){const dx=gate.x-game.player.x,dz=gate.z-game.player.z;nav.textContent=`${gate.name} ${Math.ceil(Math.hypot(dx,dz))} 米 · ${Math.abs(dx)<2?'':dx>0?'向右':'向左'}${Math.abs(dz)<2?'':dz>0?'向前':'向后'}`;}
  if(challenge){$('#challenge-route').textContent=`检查点 ${game.checkpointId+1} · 到终点 ${Math.max(0,Math.ceil(Math.hypot(game.player.x-game.level.finishPortal.x,game.player.z-game.level.finishPortal.z)))} 米`;}
  if(ad){
   if(getDialog()!=='reward')cancelAd();
   else{ad.tick(dt,!document.hidden&&document.hasFocus());$('#reward-fill').style.width=`${ad.elapsed/ad.duration*100}%`;$('#reward-countdown').textContent=ad.ready?'已看完，可以领取补给':`观看 ${ad.remaining} 秒后可领取`;$('#claim-reward').disabled=!ad.ready;$('#claim-reward').textContent=ad.ready?'领取道具补给':`观看中 · ${ad.remaining} 秒`;}
  }
 }
 function enhanceHelp(){
  $('#modal-content .help-grid')?.insertAdjacentHTML('afterbegin',`<div class="help-card"><h3>50 关闯关 / 传送门</h3><kbd>B 闯关大厅</kbd> <kbd>V 换形象</kbd><p>闯关大厅有第 1–50 关，分成 5 页，每关有编号、路线和机关组合。选关后，草坪起点的传送门会标明目标关卡；必须走进标注的门才能进入。走到绿色检查点保存位置，最后进入金色终点门过关；结算可标记下一关入口。8 种原创蛋仔形象免费切换。</p></div><div class="help-card"><h3>先拾取，再使用道具</h3><kbd>Z 喷气</kbd> <kbd>X 垫脚箱</kbd> <kbd>C 钩爪</kbd> <kbd>G 咸鱼打击</kbd><p>背包开局每种都是 0，要走近地图上有名称的发光道具才能发现并获得，每种最多携带 9 个。喷气背包升空 5 秒；垫脚箱放在前方，用方向键配合空格跳上箱顶，再起跳攀高，最多叠 3 层、场上 9 个。钩爪锁住面朝方向 30 米内的安全落脚点，沿绳子拉过去，再按 C 可收钩。咸鱼打击消耗 1 条咸鱼，将面前 4.2 米内无遮挡的敌人击飞并击败，不增加吃豆积分。死亡和进出闯关不退还消耗；已放箱子会被清除。看完 6 秒本地模拟广告，只会补充地图上的道具，需要重新走近拾取。</p></div><div class="help-card"><h3>同时按住三键复位</h3><kbd>R + U + O</kbd><p>同时按住 R、U、O 才会回到最近检查点；单独按 R 不会复位，也可以点击道具栏的「复位」。每次使用后冷却 10 个游戏秒，按钮显示剩余秒数，暂停不计时。复位保留积分和已拾取、已消耗的道具状态。</p></div>`);
 }
 $('#challenge-guide').onclick=challengeGuide;$('#wardrobe').onclick=wardrobe;$('#reward-ad').onclick=reward;
 $('#reset-player').onclick=()=>resetPlayer();
 addEventListener('blur',()=>ad?.suspend());addEventListener('focus',()=>ad?.suspend());document.addEventListener('visibilitychange',()=>ad?.suspend());
 $('#challenge-exit').onclick=()=>{clearControls();game.exitChallenge();};
 for(const button of document.querySelectorAll('[data-gadget]'))button.onclick=()=>useItem(button.dataset.gadget);
 return {syncScene,useItem,challengeGuide,wardrobe,cancelAd,frame,handleEvent,enhanceHelp,get avatar(){return avatar;}};
}

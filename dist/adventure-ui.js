import {CHALLENGES} from './challenges.js';
import {GADGETS} from './gadgets.js';
import {AVATARS,DEFAULT_AVATAR,getAvatar} from './avatars.js';
import {RewardedAdSession} from './rewarded-ad.js';

const $=selector=>document.querySelector(selector),keys={jetpack:'Z',crate:'X',grapple:'C',fish:'G'};
export function completionRewardHTML(reward){
 if(!reward?.items)return '';
 const items=Object.entries(GADGETS).filter(([id])=>reward.items[id]>0).map(([id,item])=>`<span>${item.icon} ${item.name} <b>×${reward.items[id]}</b></span>`).join('');
 return `<section class="completion-loot" aria-label="通关道具奖励"><h3>🎁 通关奖励已出现</h3><div>${items}</div><p>找到草坪上的金色奖励补给，走近拾取才会加入背包。背包满时奖励会留在原处；未拾取的奖励可带到下一张吃豆地图。</p></section>`;
}
export function createAdventureUI({game,getRenderer,showDialog,closeDialog,getDialog,toast,clearControls,resetPlayer}){
 let avatar=DEFAULT_AVATAR,ad=null,navigation=null,challengePage=0;const challengeRecords={};
 try{avatar=getAvatar(localStorage.getItem('eggy-avatar-v1')).id;}catch{}
 try{const saved=JSON.parse(localStorage.getItem('eggy-challenges-v1')||'{}');for(const c of CHALLENGES)if(saved[c.id]===true)challengeRecords[c.id]=true;}catch{}
 $('#adventure-panel').innerHTML=`<div class="adventure-links"><button id="challenge-guide">闯关 1–50 ↗</button><button id="wardrobe">🥚 换形象</button><button id="reward-ad">补给广告</button></div><div class="gadget-slots">${Object.entries(GADGETS).map(([id,g])=>`<button data-gadget="${id}" aria-label="${g.name}，尚未拾取，按${keys[id]}"><kbd>${keys[id]}</kbd><i>${g.icon}</i><span>${g.name}</span><b id="${id}-count">0</b></button>`).join('')}</div><small id="gadget-status">开局没有道具 · 靠近地图上的发光道具拾取</small><small id="portal-navigation" hidden></small><button id="reset-player" class="reset-player">↺ 复位 <span>R + U + O</span></button><button id="challenge-exit" hidden>退出闯关 · 返回草坪</button>`;
 $('#adventure-panel').setAttribute('aria-label','闯关、道具和蛋仔形象');
 $('#gadget-status').insertAdjacentHTML('afterend','<small id="reward-navigation" class="reward-navigation" hidden></small>');

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
  if(!game.action(id))toast(game.gadgets.inventory[id]<=0?'还没有这个道具，先走近地图上对应的发光道具拾取':id==='grapple'?'前方没有可锁定的安全落脚点；转向发光锚点再抛钩':id==='crate'?'放箱需要足够空间；跳高后按 X 可垫在脚下，场上最多 9 个':'喷气背包正在使用，或钩爪正在拉动');
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
  showDialog('reward',`<div class="eyebrow">OPTIONAL REWARD · LOCAL PREVIEW</div><h2 id="modal-title">地图道具补给</h2><div class="local-ad-label">本地模拟广告 · 未接入真实广告平台</div><div class="reward-stage"><span>🚀 📦 🪝 🐟</span><h3>下一座岛，就在前方</h3><p>背包开局是空的。找到发光道具，走近拾取，再用咸鱼把拦路敌人击飞！</p><div class="reward-progress"><i id="reward-fill"></i></div><strong id="reward-countdown">观看 6 秒后可补充地图道具</strong></div><p>完整观看可让本场景已拾取的普通道具重新出现，需要走到原处拾取才会增加库存。金色通关奖励不会随广告重刷。每种最多携带 9 个。提前关闭没有补给，游戏暂停。</p><button class="primary" id="claim-reward" disabled>观看中 · 6 秒</button><button class="secondary" id="cancel-reward">关闭，继续游戏</button>`);
  $('#cancel-reward').onclick=()=>closeDialog();
  $('#claim-reward').onclick=()=>{
   if(ad!==session||getDialog()!=='reward'||!session.claim())return;
   const restored=game.replenishGadgetPickups();closeDialog();toast(restored?`地图上 ${restored} 处道具已补充，走近拾取后才会加入背包`:'地图道具还在原处，走近发光道具即可拾取');
  };
 }
 function challengeResult(e){
  challengeRecords[e.challengeId]=true;try{localStorage.setItem('eggy-challenges-v1',JSON.stringify(challengeRecords));}catch{}
  const index=CHALLENGES.findIndex(c=>c.id===e.challengeId),next=CHALLENGES[index+1];
  showDialog('challenge-result',`<div class="result"><div class="eyebrow">ADVENTURE COMPLETE · ${Object.keys(challengeRecords).length} / ${CHALLENGES.length}</div><div class="result-mark">🏁</div><h2 id="modal-title">第 ${index+1} 关 · ${e.name}，成功！</h2><p>你走进了金色终点门，已返回原来的吃豆草坪。</p>${completionRewardHTML(e.reward)}<div class="result-detail"><div>${e.time.toFixed(1)} 秒<small>闯关用时</small></div><div>${e.falls}<small>跌落次数</small></div></div>${next?`<button class="primary" id="challenge-next">下一关 · ${next.name} ↗</button>`:''}<button class="secondary" id="challenge-result-close">继续吃豆冒险</button><button class="secondary" id="challenge-more">查看 50 关闯关大厅</button></div>`);
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
  if(e.type==='rewardSpawned'){toast('通关奖励已放到草坪 · 沿金色补给提示走近拾取');return true;}
  if(e.type==='gadgetCollected'){toast(`${e.reward?'领取通关奖励：':'发现'}${GADGETS[e.gadget].name} +${e.amount} · 按 ${keys[e.gadget]} 使用`);return true;}
  if(e.type==='gadgetStart'){toast(e.gadget==='fish'?'咸鱼打击！把面前的敌人击飞':e.gadget==='grapple'?'钩爪已锁定，正在拉向落脚点':e.gadget==='jetpack'?'喷气背包启动 · 5 秒升空，可控制方向':e.airborne?'空中垫箱成功！已站上箱顶 · 空格再跳可继续攀高':'前方垫脚箱已放好 · 空格跳上箱顶，跳起按 X 可空中垫高');return true;}
  return false;
 }
 function frame(dt){
  const g=game.gadgets,challenge=game.level.mode==='challenge';
  for(const [id,item]of Object.entries(GADGETS)){const button=$(`[data-gadget="${id}"]`);$(`#${id}-count`).textContent=g.inventory[id];button.classList.toggle('selected',g.selected===id&&g.inventory[id]>0);button.classList.toggle('empty',g.inventory[id]===0);button.setAttribute('aria-label',`${item.name}，${g.inventory[id]>0?`剩余${g.inventory[id]}个`:'尚未拾取'}，按${keys[id]}`);}
  $('#gadget-status').textContent=g.fishSwing>0?'🐟 咸鱼打击！':g.grapple?'🪝 拉动中 · X 空中垫箱 / C 收钩':g.jetpack?`🚀 喷气中 ${g.jetpack.remaining.toFixed(1)} 秒 · X 脚下垫箱`:g.crates.length?`📦 已放 ${g.crates.length} / 9 个 · 空格起跳 → X 空中垫高`:'靠近发光道具拾取 · Z 喷气 / X 箱 / C 钩 / G 咸鱼';
  const loot=(game.gadgetPickups||[]).filter(p=>p.reward&&p.available),rewardNav=$('#reward-navigation');rewardNav.hidden=loot.length===0;
  if(loot.length){const available=loot.filter(p=>g.inventory[p.gadget]<GADGETS[p.gadget].max),nearest=[...(available.length?available:loot)].sort((a,b)=>Math.hypot(a.x-game.player.x,a.z-game.player.z)-Math.hypot(b.x-game.player.x,b.z-game.player.z))[0],dx=nearest.x-game.player.x,dz=nearest.z-game.player.z,full=available.length===0;rewardNav.textContent=`🎁 通关奖励 ${loot.reduce((sum,p)=>sum+p.amount,0)} 件 · ${full?'先用掉道具再来拾取':`${GADGETS[nearest.gadget].name} ${Math.ceil(Math.hypot(dx,dz))} 米 · ${Math.abs(dx)<1?'':dx>0?'向右':'向左'}${Math.abs(dz)<1?'':dz>0?'向前':'向后'}`}`;}
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
  const boxHelp='<div class="help-card"><h3>空中垫箱，继续攀高</h3><kbd>空格 → X → 空格</kbd><p>先拾取垫脚箱。地面按 X 放在前方；跳到空中按 X，箱子会直接出现在脚下，接住蛋仔，再按空格就能继续跳高。跳得太低、箱体会挤进地面或障碍时不能放置。钩爪拉动或喷气升空时也能按 X 放箱，成功后会停下钩爪或喷气，站到箱顶。地面叠箱最多 3 层，空中可继续向上搭，场上总共最多 9 个。天空主题关有带青色悬浮环的空中箱，可落脚，也可用钩爪锁定。</p></div>';
  $('#modal-content .help-grid')?.insertAdjacentHTML('afterbegin',`${boxHelp}<div class="help-card"><h3>奖励 / 真捷径 / 消失地板</h3><kbd>3 秒变红 → 5 秒消失</kbd><p>关卡有多条路线，可以自行探索。消失地板踩上后逐渐变红，3 秒完全变红，5 秒才消失，第 9 秒恢复；暂停不计时。通关后会出现垫脚箱 ×2、钩爪 ×1、喷气背包 ×1、咸鱼 ×1 的金色补给，走近拾取，背包满时可以晚点回来拿。</p></div><div class="help-card"><h3>50 关闯关 / 传送门</h3><kbd>B 闯关大厅</kbd> <kbd>V 换形象</kbd><p>闯关大厅有第 1–50 关，分成 5 页，每关有编号、路线和机关组合，可以自由尝试不同路线。选关后，草坪起点的传送门会标明目标关卡；必须走进标注的门才能进入。走到绿色检查点保存位置，最后进入金色终点门过关；结算可标记下一关入口。8 种原创蛋仔形象免费切换。</p></div><div class="help-card"><h3>先拾取，再使用道具</h3><kbd>Z 喷气</kbd> <kbd>X 垫脚箱</kbd> <kbd>C 钩爪</kbd> <kbd>G 咸鱼打击</kbd><p>背包开局每种都是 0，走近地图上有名称的发光道具才能拾取，每种最多携带 9 个。喷气背包升空 5 秒；垫脚箱既能在地面放，也能跳起后垫在脚下。钩爪锁住面朝方向 30 米内的安全落脚点，沿绳子拉过去，再按 C 可收钩。咸鱼消耗 1 条，将面前 4.2 米内无遮挡的敌人击飞并击败，不增加吃豆积分。死亡和进出闯关不退还消耗，并清除已放箱子。6 秒本地模拟广告只恢复普通补给，需要重新走近拾取；不会重刷通关奖励。</p></div><div class="help-card"><h3>同时按住三键复位</h3><kbd>R + U + O</kbd><p>同时按住 R、U、O 才会回到最近检查点；单独按 R 不会复位，也可以点击道具栏的「复位」。每次使用后冷却 10 个游戏秒，按钮显示剩余秒数，暂停不计时。复位保留积分和已拾取、已消耗的道具状态。</p></div>`);
 }
 $('#challenge-guide').onclick=challengeGuide;$('#wardrobe').onclick=wardrobe;$('#reward-ad').onclick=reward;
 $('#reset-player').onclick=()=>resetPlayer();
 addEventListener('blur',()=>ad?.suspend());addEventListener('focus',()=>ad?.suspend());document.addEventListener('visibilitychange',()=>ad?.suspend());
 $('#challenge-exit').onclick=()=>{clearControls();game.exitChallenge();};
 for(const button of document.querySelectorAll('[data-gadget]'))button.onclick=()=>useItem(button.dataset.gadget);
 return {syncScene,useItem,challengeGuide,wardrobe,cancelAd,frame,handleEvent,enhanceHelp,get avatar(){return avatar;}};
}

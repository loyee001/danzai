export const AVATARS=Object.freeze([
 {id:'sunny',name:'奶黄小团',color:'#ffe19a',accent:'#c4a1f3',icon:'🥚',hat:'crest'},
 {id:'bunny',name:'桃桃兔耳',color:'#ffd1dc',accent:'#f18fba',icon:'🐰',hat:'bunny'},
 {id:'space',name:'星际泡泡',color:'#b5e6ff',accent:'#5a92d1',icon:'🚀',hat:'space'},
 {id:'dino',name:'青柠小龙',color:'#b7e881',accent:'#45ab71',icon:'🦕',hat:'dino'},
 {id:'bee',name:'蜂蜜嗡嗡',color:'#ffda61',accent:'#66523d',icon:'🐝',hat:'bee'},
 {id:'cat',name:'薄荷猫猫',color:'#c0ece2',accent:'#65b8b0',icon:'🐱',hat:'cat'},
 {id:'pirate',name:'海盐船长',color:'#f5c99e',accent:'#5a7cac',icon:'🏴‍☠️',hat:'pirate'},
 {id:'chef',name:'草莓小厨',color:'#fff0bf',accent:'#ee6d78',icon:'👨‍🍳',hat:'chef'}
].map(Object.freeze));
export const DEFAULT_AVATAR=AVATARS[0].id;
export function getAvatar(id){return AVATARS.find(avatar=>avatar.id===id)||AVATARS[0];}

export const ENEMY_RANKS = {
  normal: {name:'普通',color:'#73cba1',scale:1,hpBonus:0,speedMultiplier:1,chaseMultiplier:1,damage:1,shield:0,stunScale:1,knockScale:1,detectRange:9,chaseRange:13},
  swift: {name:'敏捷',color:'#46b7ed',scale:.9,hpBonus:1,speedMultiplier:1.3,chaseMultiplier:1.35,damage:1,shield:0,stunScale:.8,knockScale:.8,detectRange:10,chaseRange:14},
  armored: {name:'装甲',color:'#a4acbd',scale:1.12,hpBonus:3,speedMultiplier:.8,chaseMultiplier:.85,damage:1,shield:2,stunScale:.65,knockScale:.3,detectRange:9,chaseRange:13},
  elite: {name:'精英',color:'#f58a5d',scale:1.22,hpBonus:4,speedMultiplier:1.15,chaseMultiplier:1.2,damage:1,shield:0,stunScale:.65,knockScale:.65,detectRange:11,chaseRange:15,windup:.65,dashDuration:.45,dashSpeed:7.2,dashCooldown:4},
  boss: {name:'首领',color:'#c268d8',scale:1.55,hpBonus:10,speedMultiplier:.95,chaseMultiplier:1.05,damage:2,shield:0,stunScale:.55,knockScale:.25,detectRange:12,chaseRange:16,windup:.85,dashDuration:.55,dashSpeed:8.4,dashCooldown:5}
};

export function rankMonster(base,rank='normal'){
  if(!ENEMY_RANKS[rank])throw Error('未知敌人强度');
  const d=ENEMY_RANKS[rank];
  return {...base,rank,rankName:d.name,hp:base.hp+d.hpBonus,speed:base.speed*d.speedMultiplier,chaseSpeed:base.chaseSpeed*d.chaseMultiplier,contactDamage:d.damage,shieldHP:d.shield,shieldMax:d.shield};
}

const ENEMY_NAMES = [
  '泡泡团子','薄荷软糖','蜜桃布丁','奶油蘑菇','抹茶豆丁','橘子果冻','星星棉球','云朵糯米','草莓滚滚','柠檬啾啾',
  '蓝莓圆仔','芝麻绒球','葡萄泡芙','椰子糖球','红豆年糕','南瓜布偶','樱桃软团','可可团团','酸奶小怪','蜂蜜咕噜',
  '疾风跳豆','闪电啾啾','追云小翼','旋风薄荷','星火飞仔','蓝电蹦蹦','流光燕尾','飞羽小旋','急速柠檬','雨燕糖豆',
  '霓虹飞梭','银翼飞丸','追月跳跳','烈风尖耳','旋叶灵猫','雷鸣快爪','幻影雨燕','极光滑翔','逐日流星','疾空闪灵',
  '石壳豆兵','铁甲栗子','铜盾蘑菇','岩盔番薯','珊瑚堡垒','冰晶甲虫','黑曜石卫','磁铁盾兵','钢牙卫士','翡翠重甲',
  '琥珀壳王','青铜铁犀','金砂战龟','银甲角兽','熔岩石偶','陨铁守卫','苍岩巨盾','玄晶龙甲','钻石铁壁','星核重装',
  '赤焰先锋','冰锋猎手','雷霆双角','暗影追踪','炽光战将','烈星破阵','风暴掠袭','月刃疾影','熔火尖兵','霜牙突袭',
  '雷光勇将','晨星猎王','暮色剑影','飓风狂角','赤晶斗士','幻焰行者','碧雷武卫','烬火征服','天光破军','无极战魂',
  '皇冠泡泡王','深海珊瑚王','雪原冰牙王','森林藤甲王','沙海金角王','火山熔岩王','星夜月影王','雷云风暴王','水晶幻翼王','赤日烈焰王',
  '苍穹巨角王','极夜寒霜王','虚空黑曜王','银河流星王','龙晶守界王','日蚀暗星王','天穹雷鸣王','永夜幻梦王','混沌万象王','星河终极王'
];
const RANK_ORDER = ['normal','swift','armored','elite','boss'];

function typeColor(group,variant){
  const hue=([137,196,214,18,279][group]+(variant%5-2)*8+Math.floor(variant/5)*3+360)%360;
  const saturation=[.54,.76,.28,.82,.66][group],lightness=.52+Math.floor(variant/5)*.035;
  const a=saturation*Math.min(lightness,1-lightness);
  const channel=n=>{
    const k=(n+hue/30)%12;
    return Math.round(255*(lightness-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

// Fixed catalog: one bubble removes one hit, including each armored shield point.
export const ENEMY_TYPES = Object.freeze(ENEMY_NAMES.map((name,index)=>{
  const tier=index+1,group=Math.floor(index/20),rank=RANK_ORDER[group],variant=index%20;
  const hitsToDefeat=tier+Math.round(900*((tier-1)/99)**2),shieldHP=rank==='armored'?2:0;
  return Object.freeze({id:`E${String(tier).padStart(3,'0')}`,tier,name,rank,hitsToDefeat,hp:hitsToDefeat-shieldHP,shieldHP,shieldMax:shieldHP,color:typeColor(group,variant),variant});
}));

export function getEnemyType(tier){
  if(!Number.isInteger(tier)||tier<1||tier>ENEMY_TYPES.length)throw new RangeError('敌人档次必须为 1 到 100 的整数');
  return ENEMY_TYPES[tier-1];
}

export function tierMonster(base,tier){
  const type=getEnemyType(tier);
  return {...rankMonster(base,type.rank),typeId:type.id,enemyName:type.name,tier:type.tier,hitsToDefeat:type.hitsToDefeat,variant:type.variant,color:type.color,hp:type.hp,shieldHP:type.shieldHP,shieldMax:type.shieldMax};
}

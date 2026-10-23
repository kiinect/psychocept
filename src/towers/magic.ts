import { ability, baseStats, tierTable, type TowerDefinition } from './types';
// Hand-transcribed resulting primary-weapon tables from data/wiki/towers/*.json.
// Auxiliary weapons and auras are resolved in Sim.magicAttack / magicBuffs.
const wb = baseStats({ damageType:'energy', pierce:3, cooldown:1.1, range:40, projectileSpeed:200, lifespan:0.4 });
const w = tierTable(wb);
export const wizard: TowerDefinition = { name:'Wizard Monkey', cost:250, footprint:7, color:0x8b55b6, base:wb, paths:[
 [w('Guided Magic',175,{homing:true,lifespan:0.8}),w('Arcane Blast',450,{homing:true,lifespan:0.8,damage:2}),
  w('Arcane Mastery',1450,{homing:true,lifespan:1.4,damage:3,pierce:7,cooldown:0.55,range:60}),
  w('Arcane Spike',10000,{homing:true,lifespan:1.4,damage:6,pierce:7,cooldown:0.275,range:60,lead:true,moabBonus:10}),
  w('Archmage',32000,{homing:true,lifespan:1.4,damage:8,pierce:11,cooldown:0.1375,range:60,lead:true,moabBonus:19})],
 [w('Fireball',300,{}),w('Wall of Fire',800,{}),w("Dragon's Breath",3300,{damageType:'fire',damage:2,pierce:3,cooldown:0.135,burnDamage:1,burnInterval:1.5,burnDuration:3.1,lead:true,frozen:true}),
  w('Summon Phoenix',6000,{damageType:'fire',damage:2,pierce:3,cooldown:0.135,projectiles:2,spread:10,burnDamage:1,burnInterval:1.5,burnDuration:3.1,lead:true,frozen:true,ability:ability('phoenix',45,15,20,5,1,2,8)}),
  w('Wizard Lord Phoenix',50000,{damageType:'fire',damage:2,pierce:15,cooldown:0.135,projectiles:3,spread:7.5,burnDamage:2,burnInterval:1,burnDuration:15,lead:true,frozen:true,ability:ability('phoenix',45,15,20,20,1,2,50)})],
 [w('Intense Magic',300,{pierce:8,projectileSpeed:400}),w('Monkey Sense',300,{pierce:8,projectileSpeed:400,range:50,camo:true}),
  w('Shimmer',1500,{pierce:8,projectileSpeed:400,range:60,camo:true}),w('Necromancer: Unpopped Army',2800,{pierce:8,projectileSpeed:400,range:60,camo:true}),
  w('Prince of Darkness',26500,{pierce:8,projectileSpeed:400,range:80,camo:true,cooldown:0.275})]
]};
const sb=baseStats({range:50,cooldown:0.045,projectileSpeed:200,lifespan:0.6}); const s=tierTable(sb);
export const superMonkey: TowerDefinition={name:'Super Monkey',cost:2500,footprint:11,color:0x367bd9,base:sb,paths:[
 [s('Laser Blasts',2000,{pierce:2,damageType:'energy',frozen:true}),s('Plasma Blasts',2500,{pierce:2,damageType:'plasma',cooldown:0.03,lead:true,frozen:true}),
  s('Sun Avatar',20000,{pierce:6,damageType:'plasma',cooldown:0.03,lead:true,frozen:true,projectiles:3,spread:15,projectileSpeed:400}),
  // uncertain: sacrifice bonuses require tower-class valuation; only the unsacrificed temple weapon is modeled.
  s('Sun Temple',100000,{damage:5,pierce:20,cooldown:0.05,range:65,damageType:'normal',lead:true,frozen:true}),
  s('True Sun God',500000,{damage:15,pierce:20,cooldown:0.05,range:65,damageType:'normal',lead:true,frozen:true})],
 [s('Super Range',1500,{range:60,pierce:2}),s('Epic Range',1900,{range:72,pierce:3,projectileSpeed:280}),
  // uncertain: seeded critical intervals use the midpoint of the wiki's shot interval.
  s('Robo Monkey',7500,{range:72,pierce:5,projectileSpeed:280,projectiles:2,critEvery:18,critDamage:10}),
  s('Tech Terror',25000,{range:72,pierce:7,projectileSpeed:280,projectiles:2,critEvery:18,critDamage:10,damageType:'plasma',lead:true,frozen:true,ability:ability('annihilate',45,0,0,2600,1,2000,70)}),
  s('The Anti-Bloon',70000,{range:82,damage:5,pierce:12,projectileSpeed:280,projectiles:2,critEvery:15,critDamage:50,damageType:'normal',lead:true,frozen:true,ability:ability('annihilate',30,0,0,10400,1,2000,120)})],
 [s('Knockback',3000,{knockback:true,moabSlow:0.7}),s('Ultravision',1200,{knockback:true,moabSlow:0.7,range:53,camo:true,camoBonus:1}),
  // uncertain: Darkshift cooldown is absent from the local table; use 20 seconds.
  s('Dark Knight',5600,{knockback:true,moabSlow:0.7,range:53,camo:true,camoBonus:1,moabBonus:2,pierce:4,ability:ability('darkshift',20,0,0)}),
  s('Dark Champion',55555,{knockback:true,moabSlow:0.7,range:57,camo:true,camoBonus:2,moabBonus:3,ceramicBonus:2,pierce:8,damage:2,cooldown:0.0225,damageType:'normal',frozen:true,bounceRange:40,ability:ability('darkshift',20,0,0)}),
  s('Legend of the Night',165650,{knockback:true,moabSlow:0.7,range:57,camo:true,camoBonus:4,moabBonus:25,ceramicBonus:4,pierce:16,damage:10,cooldown:0.0225,damageType:'normal',frozen:true,bounceRange:40,ability:ability('darkshift',20,0,0)})]
]};
// uncertain: the supplied base table says camo:false; follow that table, not assumed game defaults.
const nb=baseStats({range:40,pierce:2,cooldown:0.62,projectileSpeed:300,lifespan:0.62}); const n=tierTable(nb);
export const ninja: TowerDefinition={name:'Ninja Monkey',cost:400,footprint:6,color:0xb64a49,base:nb,paths:[
 [n('Ninja Discipline',350,{cooldown:0.434}),n('Sharp Shurikens',350,{cooldown:0.434,pierce:4}),n('Double Shot',900,{cooldown:0.434,pierce:4,projectiles:2,spread:18}),n('Bloonjitsu',2750,{cooldown:0.434,pierce:4,projectiles:5,spread:11.25}),n('Grandmaster Ninja',35000,{cooldown:0.217,pierce:4,projectiles:8,spread:72/7,damage:2,range:50})],
 [n('Distraction',250,{knockback:true}),n('Counter-Espionage',400,{knockback:true,stripCamo:true,camo:true,camoBonus:2}),n('Shinobi Tactics',1200,{knockback:true,stripCamo:true,camo:true,camoBonus:2}),
  n('Bloon Sabotage',5200,{knockback:true,stripCamo:true,camo:true,camoBonus:2,ability:ability('sabotage',60,20,15)}),
  n('Grand Saboteur',22000,{knockback:true,stripCamo:true,camo:true,camoBonus:2,range:50,ability:ability('sabotage',60,20,30)})],
 [n('Seeking Shuriken',300,{homing:true,range:47}),n('Caltrops',450,{homing:true,range:47}),n('Flash Bomb',2250,{homing:true,range:47,pierce:4}),n('Sticky Bomb',5000,{homing:true,range:47,pierce:4}),n('Master Bomber',40000,{homing:true,range:47,pierce:4})]
]};
const ab=baseStats({range:45,cooldown:2,damageType:'acid',radius:14,pierce:15,burnDamage:1,burnInterval:2,burnDuration:4.05,lead:true,frozen:true}); const a=tierTable(ab);
export const alchemist: TowerDefinition={name:'Alchemist',cost:550,footprint:6,color:0xd7983a,base:ab,paths:[
 [a('Larger Potions',250,{pierce:20,radius:21}),a('Acidic Mixture Dip',350,{pierce:20,radius:21}),a('Berserker Brew',1400,{pierce:20,radius:21}),a('Stronger Stimulant',2850,{pierce:20,radius:21}),a('Permanent Brew',48000,{pierce:20,radius:21})],
 [a('Stronger Acid',250,{burnInterval:1.5,burnDuration:4.5}),a('Perishing Potions',475,{burnInterval:1.5,burnDuration:4.5,moabBonus:4,fortifiedBonus:15,defortify:true}),
  a('Unstable Concoction',2800,{burnInterval:1.5,burnDuration:4.5,moabBonus:4,fortifiedBonus:15,defortify:true}),
  a('Transforming Tonic',4200,{burnInterval:1.5,burnDuration:4.5,moabBonus:4,fortifiedBonus:15,defortify:true,ability:ability('transform',60,20,20,3,1,0,6)}),
  a('Total Transformation',45000,{burnInterval:1.5,burnDuration:4.5,moabBonus:4,fortifiedBonus:15,defortify:true,ability:ability('transform',40,20,20,3,1,5,6)})],
 [a('Faster Throwing',650,{cooldown:1.6}),a('Acid Pool',450,{cooldown:1.6}),a('Lead to Gold',1000,{cooldown:1.6,leadBonus:9}),a('Rubber to Gold',2750,{cooldown:1.6,leadBonus:9}),a('Bloon Master Alchemist',40000,{cooldown:1.6,leadBonus:9})]
]};
const db=baseStats({range:35,cooldown:1.1,projectiles:5,spread:6.25,projectileSpeed:340,lifespan:0.3}); const d=tierTable(db);
export const druid: TowerDefinition={name:'Druid',cost:400,footprint:7,color:0x6f9851,base:db,paths:[
 [d('Hard Thorns',350,{pierce:2,damageType:'normal',lead:true,frozen:true}),d('Heart of Thunder',850,{pierce:2,damageType:'normal',lead:true,frozen:true}),d('Druid of the Storm',1700,{pierce:2,damageType:'normal',lead:true,frozen:true}),d('Ball Lightning',4500,{pierce:2,damageType:'normal',lead:true,frozen:true,camo:true}),d('Monarch of Storms',60000,{pierce:2,damageType:'normal',lead:true,frozen:true,camo:true})],
 [d('Thorn Swarm',250,{projectiles:8,spread:25/7}),d('Heart of Oak',350,{projectiles:8,spread:25/7,stripRegrow:true}),d('Druid of the Jungle',1050,{projectiles:8,spread:25/7,stripRegrow:true}),d("Jungle's Bounty",4900,{projectiles:8,spread:25/7,stripRegrow:true,range:45,income:120,ability:ability('vines',30,10,0,0,1,10)}),d('Spirit of the Forest',35000,{damage:6,projectiles:8,spread:25/7,stripRegrow:true,range:45,income:1120,ability:ability('vines',30,10,0,0,1,20)})],
 [d('Druidic Reach',100,{range:45,lifespan:0.399}),d('Heart of Vengeance',300,{range:45,lifespan:0.399,cooldown:1}),d('Druid of Wrath',600,{range:45,lifespan:0.399,cooldown:1}),d('Poplust',2350,{range:45,lifespan:0.399,cooldown:1}),d('Avatar of Wrath',45000,{range:50,lifespan:0.399,cooldown:0.5,damage:4})]
]};
const mb=baseStats({range:28,cooldown:1.2,damage:2,pierce:3,radius:3,damageType:'shatter',frozen:true,projectileSpeed:200,lifespan:1}); const m=tierTable(mb);
export const mermonkey: TowerDefinition={name:'Mermonkey',cost:300,footprint:8,color:0x44b9b0,waterOnly:true,base:mb,paths:[
 [m('Trident Efficiency',150,{cooldown:0.96}),m('Trident Swiftness',250,{cooldown:0.72,projectileSpeed:300,lifespan:2/3}),m('Abyss Dweller',1800,{cooldown:0.72,projectileSpeed:300,lifespan:2/3,damage:4}),m('Abyssal Warrior',4200,{cooldown:0.72,projectileSpeed:300,lifespan:2/3,damage:8,afterSlow:0.6,moabSlow:0.72}),m('Lord of the Abyss',23000,{cooldown:0.36,projectileSpeed:300,lifespan:2/3,damage:10,pierce:9,range:32,afterSlow:0.6,moabSlow:0.72})],
 [m('Sharper Prongs',200,{pierce:6}),m('Tidal Chill',225,{pierce:6,radius:4.5,freezeDuration:0.5,freezeLayers:4}),m('Riptide Champion',2000,{damage:4,pierce:25,radius:0,range:32,cooldown:1.5,damageType:'frigid',freezeDuration:1,freezeLayers:99}),m('Arctic Knight',8000,{damage:8,moabBonus:8,pierce:25,radius:0,range:32,cooldown:1.5,damageType:'frigid',freezeDuration:1,freezeLayers:99,ability:ability('icejet',45,0,3,20,1,0,240)}),m('Popseidon',52000,{damage:15,moabBonus:15,pierce:25,radius:0,range:40,cooldown:0.75,projectiles:3,spread:45,damageType:'frigid',freezeDuration:1,freezeLayers:99,ability:ability('icejet',45,0,3,30,1,0,240)})],
 [m('Echosense Precision',200,{camo:true,homing:true}),m('Echosense Network',280,{camo:true,homing:true}),m('Alluring Melody',2000,{camo:true,homing:true,pierce:9}),m('Symphonic Resonance',7600,{camo:true,homing:true,pierce:9,range:32}),m('The Final Harmonic',25000,{camo:true,homing:true,pierce:18,range:38})]
]};

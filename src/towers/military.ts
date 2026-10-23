import { ability, baseStats, tierTable, type TowerDefinition } from './types';
// Numeric resulting tables transcribed from the local wiki. Compound weapons use
// the primary attack plus the shared secondary hook; no runtime wiki parsing.
const sniperBase = baseStats({ range: 2000, cooldown: 1.59, damage: 2 });
const s = tierTable(sniperBase);
export const sniper: TowerDefinition = {
  name: 'Sniper Monkey', cost: 350, footprint: 6, color: 0x526837, base: sniperBase,
  paths: [
    [s('Full Metal Jacket',350,{damage:4,damageType:'normal',lead:true,frozen:true}),
     s('Large Caliber',1300,{damage:7,damageType:'normal',lead:true,frozen:true}),
     s('Deadly Precision',2200,{damage:20,ceramicBonus:50,damageType:'normal',lead:true,frozen:true}),
     // uncertain: short/long MOAB stun durations are not numeric in the prose.
     s('Maim MOAB',6300,{damage:30,ceramicBonus:50,damageType:'normal',lead:true,frozen:true,moabStun:3}),
     s('Cripple MOAB',32000,{damage:140,damageType:'normal',lead:true,frozen:true,moabStun:5,brittle:5,brittleDuration:5})],
    [s('Night Vision Goggles',250,{camo:true,camoBonus:2}),
     s('Shrapnel Shot',450,{camo:true,camoBonus:2,shards:5,shardDamage:1,shardPierce:2,soak:1}),
     s('Bouncing Bullet',2100,{camo:true,camoBonus:2,shards:5,shardDamage:1,shardPierce:2,soak:1,bounceRange:40,pierce:3}),
     s('Supply Drop',7600,{camo:true,camoBonus:2,shards:5,shardDamage:1,shardPierce:5,soak:1,bounceRange:40,pierce:5,ability:ability('cash',90,0,0,1100)}),
     s('Elite Sniper',12000,{camo:true,camoBonus:2,shards:5,shardDamage:1,shardPierce:5,soak:1,bounceRange:40,pierce:5,cooldown:0.636,ability:ability('cash',90,0,0,3000)})],
    [s('Fast Firing',450,{cooldown:1.113}),s('Even Faster Firing',450,{cooldown:0.7791}),
     s('Semi-Automatic',2700,{cooldown:0.2597}),s('Full Auto Rifle',4100,{cooldown:0.1298,moabBonus:2}),
     s('Elite Defender',14900,{cooldown:0.0649,moabBonus:4})],
  ],
};
const subBase = baseStats({range:42,cooldown:0.75,pierce:2,projectileSpeed:170,lifespan:1.5,homing:true});
const u = tierTable(subBase);
export const sub: TowerDefinition = {
 name:'Monkey Sub',cost:325,footprint:7,color:0xdec448,waterOnly:true,base:subBase,
 paths:[
  [u('Longer Range',130,{range:52}),u('Advanced Intel',500,{range:52,intel:true}),
   // uncertain: keep surfaced darts active; support pulse is represented by stripping on hit.
   u('Submerge and Support',700,{range:52,intel:true,strip:true}),
   u('Bloontonium Reactor',2400,{range:52,intel:true,strip:true,damage:2,cooldown:0.28,pierce:50}),
   u('Energizer',28000,{range:52,intel:true,strip:true,damage:5,cooldown:0.28,pierce:1000,ceramicBonus:5})],
  [u('Barbed Darts',450,{pierce:5}),u('Heat-tipped Darts',300,{pierce:5,damageType:'normal',lead:true,frozen:true}),
   u('Ballistic Missile',1350,{pierce:5,damageType:'normal',lead:true,frozen:true,range:50,secondaryCooldown:1,meteor:3}),
   u('First Strike Capability',13000,{pierce:5,damageType:'normal',lead:true,frozen:true,range:50,secondaryCooldown:1,meteor:3,ability:ability('strike',60,20,0,10000,1,80,350)}),
   u('Pre-emptive Strike',29000,{pierce:5,damageType:'normal',lead:true,frozen:true,range:50,secondaryCooldown:0.5,meteor:10,entryDamage:750,ability:ability('strike',30,0,0,20000,1,80,1000)})],
  [u('Twin Guns',450,{cooldown:0.375}),u('Airburst Darts',1000,{cooldown:0.375,pierce:1,shards:3,shardDamage:1,shardPierce:2,soak:1}),
   u('Triple Guns',1100,{cooldown:0.2512,pierce:1,shards:3,shardDamage:1,shardPierce:2,soak:1}),
   u('Armor Piercing Darts',2500,{cooldown:0.2512,damage:2,moabBonus:2,fortifiedBonus:1,pierce:1,shards:3,shardDamage:1,shardPierce:5,soak:1}),
   u('Sub Commander',25000,{cooldown:0.1256,damage:4,moabBonus:4,fortifiedBonus:2,pierce:5,shards:5,shardDamage:2,shardPierce:9,soak:1})],
 ],
};
const boatBase=baseStats({range:60,cooldown:1,pierce:4,projectileSpeed:200,lifespan:0.6});
const b=tierTable(boatBase);
export const buccaneer: TowerDefinition={name:'Monkey Buccaneer',cost:400,footprint:8,color:0x8e562f,waterOnly:true,base:boatBase,paths:[
 [b('Faster Shooting',275,{cooldown:0.75}),b('Double Shot',425,{cooldown:0.75,projectiles:2}),b('Destroyer',3350,{cooldown:0.15,projectiles:2}),
  // uncertain: carrier planes represented by global secondary strikes, one per deployed plane.
  b('Aircraft Carrier',8000,{cooldown:0.15,projectiles:2,secondaryCooldown:1.25,meteor:18}),
  b('Carrier Flagship',26000,{cooldown:0.12,projectiles:2,secondaryCooldown:1,meteor:36})],
 [b('Grape Shot',550,{projectiles:5,spread:22.5,cooldown:1.35}),b('Hot Shot',500,{projectiles:5,spread:22.5,cooldown:1.35,damageType:'fire',lead:true,frozen:true,burnDamage:2,burnInterval:1.5,burnDuration:3.1}),
  b('Cannon Ship',900,{kind:'bomb',damageType:'explosion',cooldown:1.3,damage:2,pierce:20,radius:40,frags:8,lead:true,frozen:true}),
  b('Monkey Pirates',3900,{kind:'bomb',damageType:'explosion',cooldown:1.3,damage:3,pierce:20,radius:40,frags:8,projectiles:3,spread:8,moabBonus:5,lead:true,frozen:true,ability:ability('hook',45,0,0,0,1,1)}),
  b('Pirate Lord',29000,{kind:'bomb',damageType:'explosion',cooldown:0.845,damage:3,pierce:20,radius:40,frags:8,projectiles:3,spread:8,moabBonus:8,lead:true,frozen:true,ability:ability('hook',30,0,0,0,1,6)})],
 [b('Long Range',200,{range:71,pierce:6,projectileSpeed:250}),b("Crow's Nest",350,{range:71,pierce:6,projectileSpeed:250,camo:true}),
  b('Merchantman',2400,{range:71,pierce:6,projectileSpeed:250,camo:true,income:200}),
  b('Favored Trades',5500,{range:71,pierce:6,projectileSpeed:250,camo:true,income:500,cooldown:0.5}),
  b('Trade Empire',23000,{range:71,pierce:6,projectileSpeed:250,camo:true,income:800,cooldown:0.5,damage:2,moabBonus:1,ceramicBonus:1})],
]};
const aceBase=baseStats({range:2000,cooldown:1.68,projectiles:8,radial:true,pierce:5,projectileSpeed:120,lifespan:1.4,moveSpeed:60});
const a=tierTable(aceBase);
export const ace: TowerDefinition={name:'Monkey Ace',cost:800,footprint:14,color:0xb1c9d7,base:aceBase,paths:[
 [a('Rapid Fire',450,{cooldown:1.26}),a('Lots More Darts',550,{cooldown:1.26,projectiles:12}),
  a('Fighter Plane',1000,{cooldown:1.26,projectiles:12,moveSpeed:72,secondaryCooldown:3,meteor:36}),
  a('Operation: Dart Storm',3300,{cooldown:0.63,projectiles:16,moveSpeed:72,secondaryCooldown:1.5,meteor:48}),
  a('Sky Shredder',42500,{cooldown:0.315,projectiles:32,moveSpeed:72,damage:3,ceramicBonus:2,pierce:8,damageType:'normal',projectileSpeed:360,secondaryCooldown:1.5,meteor:150})],
 // uncertain: pineapple/bomb fuses are folded into a periodic secondary explosion.
 [a('Exploding Pineapple',200,{secondaryCooldown:1.6,meteor:1}),a('Spy Plane',350,{secondaryCooldown:1.6,meteor:1,camo:true}),
  a('Bomber Ace',900,{secondaryCooldown:1.6,meteor:3,camo:true}),
  a('Ground Zero',16000,{secondaryCooldown:1.6,meteor:15,camo:true,ability:ability('blast',35,11.67,0,700,1,2000)}),
  a('Tsar Bomba',26000,{secondaryCooldown:1.6,meteor:20,camo:true,ability:ability('blast',35,0,8,3000,1,5000)})],
 [a('Sharper Darts',500,{pierce:8}),a('Centered Path',550,{pierce:8}),a('Neva-Miss Targeting',2550,{pierce:8,homing:true,lifespan:3.33}),
  a('Spectre',23400,{radial:false,projectiles:1,damage:6,pierce:4,cooldown:0.06,homing:true,secondaryCooldown:0.12,meteor:3}),
  a('Flying Fortress',90000,{radial:false,projectiles:3,damage:6,pierce:4,cooldown:0.04002,homing:true,damageType:'normal',moabBonus:14,secondaryCooldown:0.08,meteor:5})],
]};
const heliBase=baseStats({range:42,cooldown:0.57,projectiles:2,pierce:3,projectileSpeed:260,lifespan:1,moveSpeed:40});
const h=tierTable(heliBase);
export const heli: TowerDefinition={name:'Heli Pilot',cost:1500,footprint:14,color:0x4d795d,base:heliBase,paths:[
 [h('Quad Darts',800,{projectiles:4}),h('Pursuit',500,{projectiles:4,pursuit:true}),
  h('Razor Rotors',1450,{projectiles:4,pursuit:true,rotor:2}),
  h('Apache Dartship',20000,{projectiles:4,pursuit:true,rotor:4,moveSpeed:50,damage:1,pierce:7,cooldown:0.05,secondaryCooldown:1,meteor:8}),
  h('Apache Prime',45000,{projectiles:4,pursuit:true,rotor:8,moveSpeed:50,damage:6,pierce:23,cooldown:0.05,damageType:'normal',secondaryCooldown:1,meteor:68})],
 [h('Bigger Jets',300,{moveSpeed:70}),h('IFR',600,{moveSpeed:70,camo:true}),h('Downdraft',3500,{moveSpeed:70,camo:true,knockback:true}),
  // TODO(ability): Support Chinook Reposition and Supply Crate; wiki omits amounts/cooldowns.
  h('Support Chinook',9500,{moveSpeed:80,camo:true,knockback:true,damage:2,ability:ability('stub',60,0,0)}),
  // TODO(ability): Special Poperations Marine deployment and inherited Chinook abilities.
  h('Special Poperations',30000,{moveSpeed:100,camo:true,knockback:true,damage:2,ability:ability('stub',60,0,0)})],
 // uncertain: increased dart speed/lifespan are unspecified; use 1.3x.
 [h('Faster Darts',250,{range:54.6,projectileSpeed:338,lifespan:1.3}),h('Faster Firing',350,{range:54.6,projectileSpeed:338,lifespan:1.3,cooldown:0.456}),
  h('MOAB Shove',3400,{range:54.6,projectileSpeed:338,lifespan:1.3,cooldown:0.456,moabSlow:0.5,secondaryCooldown:3,meteor:7}),
  h('Comanche Defense',8500,{range:54.6,projectileSpeed:338,lifespan:1.3,cooldown:0.456,moabSlow:0.5,damage:2,secondaryCooldown:1,meteor:3}),
  h('Comanche Commander',35000,{range:54.6,projectileSpeed:338,lifespan:1.3,cooldown:0.456,moabSlow:0.5,damage:4,projectiles:8,moveSpeed:50,secondaryCooldown:1,meteor:21})],
]};
const mortarBase=baseStats({range:2000,kind:'bomb',damageType:'explosion',cooldown:2,damage:2,impactSpread:18,pierce:25,radius:20,lead:true,frozen:true});
const m=tierTable(mortarBase);
export const mortar: TowerDefinition={name:'Mortar Monkey',cost:600,footprint:11,color:0x63763b,base:mortarBase,paths:[
 [m('Bigger Blast',300,{pierce:45,radius:28}),m('Bloon Buster',500,{pierce:45,radius:28,damage:3}),
  m('Shell Shock',825,{pierce:45,radius:38,damage:3,stun:0.5}),m('The Big One',7000,{pierce:85,radius:58,damage:10,stun:0.75}),
  m('The Biggest One',36000,{pierce:200,radius:74,damage:25,ceramicBonus:30,moabBonus:30,stun:0.75,moabStun:0.2})],
 [m('Faster Reload',400,{cooldown:1.5}),m('Rapid Reload',500,{cooldown:1.08}),m('Heavy Shells',900,{cooldown:0.81,damageType:'normal',leadBonus:1,moabBonus:1,fortifiedBonus:1,ceramicBonus:3}),
  m('Artillery Battery',6500,{cooldown:0.27,damageType:'normal',leadBonus:1,moabBonus:1,fortifiedBonus:1,ceramicBonus:3,ability:ability('boost',60,0,8,0,4)}),
  m('Pop and Awe',38000,{cooldown:0.0675,radius:23,damageType:'normal',leadBonus:1,moabBonus:1,fortifiedBonus:1,ceramicBonus:3,ability:ability('awe',60,0,8,20)})],
 [m('Increased Accuracy',200,{camo:true,impactSpread:8}),m('Burny Stuff',400,{camo:true,impactSpread:8,burnDamage:1,burnInterval:1.25,burnDuration:3.85}),
  m('Signal Flare',1100,{camo:true,impactSpread:8,strip:true,burnDamage:1,burnInterval:1.25,burnDuration:3.85}),
  m('Shattering Shells',9500,{camo:true,impactSpread:8,strip:true,defortify: true,burnDamage:5,burnMoab:20,burnInterval:1.25,burnDuration:3.85}),
  m('Blooncineration',40000,{camo:true,impactSpread:8,strip:true,defortify:true,burnDamage:5,burnMoab:100,burnInterval:0.75,burnDuration:3.85,puddleDamage:1})],
]};
const dartlingBase=baseStats({range:2000,cooldown:0.2,accuracy:23,rotationSpeed:180,projectileSpeed:350,lifespan:1.1429});
const d=tierTable(dartlingBase);
export const dartling: TowerDefinition={name:'Dartling Gunner',cost:850,footprint:7,color:0x6d9137,base:dartlingBase,paths:[
 [d('Focused Firing',300,{accuracy:9.2,lifespan:1.60006}),d('Laser Shock',900,{accuracy:9.2,lifespan:1.60006,burnDamage:1,burnInterval:1,burnDuration:1}),
  d('Laser Cannon',3000,{accuracy:9.2,lifespan:1.60006,damage:2,damageType:'energy',pierce:6,moabBonus:2,frozen:true,burnDamage:1,burnInterval:1,burnDuration:2}),
  // uncertain: continuous beams represented by fast piercing projectiles along the aim ray.
  d('Plasma Accelerator',11750,{accuracy:0,lifespan:4,damage:1,damageType:'plasma',pierce:50,moabBonus:10,lead:true,frozen:true,burnDamage:1,burnInterval:1,burnDuration:5}),
  d('Ray of Doom',75000,{accuracy:0,lifespan:4,damage:30,damageType:'plasma',pierce:999,lead:true,frozen:true,burnDamage:20,burnInterval:1,burnDuration:30})],
 [d('Advanced Targeting',250,{camo:true}),d('Faster Barrel Spin',950,{camo:true,cooldown:0.132}),
  d('Hydra Rocket Pods',4500,{camo:true,cooldown:0.132,kind:'bomb',damageType:'normal',damage:2,pierce:6,radius:8,lead:true,frozen:true}),
  // TODO(ability): Rocket Storm waves; wiki has no cooldown or numeric wave stats.
  d('Rocket Storm',5000,{camo:true,cooldown:0.132,kind:'bomb',damageType:'normal',damage:2,pierce:8,radius:8,lead:true,frozen:true,ability:ability('stub',60,0,0)}),
  // TODO(ability): M.A.D Rocket Storm waves; same missing timings.
  d('M.A.D',65000,{camo:true,cooldown:0.396,kind:'bomb',damageType:'normal',damage:3,pierce:8,radius:8,moabBonus:450,lead:true,frozen:true,ability:ability('stub',60,0,0)})],
 [d('Faster Swivel',150,{rotationSpeed:440}),d('Powerful Darts',1200,{rotationSpeed:440,pierce:3,damageType:'shatter',frozen:true}),
  d('Buckshot',3000,{rotationSpeed:440,accuracy:0,cooldown:1.2,projectiles:6,damage:3,pierce:4,projectileSpeed:520,lifespan:0.25,spread:9.2,knockback:true,damageType:'shatter',frozen:true}),
  d('Bloon Area Denial System',12000,{rotationSpeed:440,accuracy:0,cooldown:0.3,projectiles:6,damage:3,pierce:4,projectileSpeed:520,lifespan:0.25,spread:9.2,knockback:true,damageType:'shatter',frozen:true}),
  d('Bloon Exclusion Zone',58000,{rotationSpeed:440,accuracy:0,cooldown:0.2,projectiles:12,damage:6,pierce:6,projectileSpeed:520,lifespan:0.25,spread:4.18,knockback:true,damageType:'shatter',frozen:true})],
]};

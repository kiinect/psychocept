import { ability, baseStats, tierTable, type TowerDefinition } from './types';
// Original numeric transcription of the five local support wiki tables.
const fb=baseStats({damage:0,projectiles:0,range:40,income:80}); const f=tierTable(fb);
export const farm:TowerDefinition={name:'Banana Farm',cost:1250,footprint:30,color:0xd9c341,base:fb,paths:[
 [f('Increased Production',500,{income:120}),f('Greater Production',600,{income:160}),f('Banana Plantation',3000,{income:320}),f('Banana Research Facility',19000,{income:1500}),
 // uncertain: follow the 6000 numeric table rather than the conflicting 7000 prose.
 f('Banana Central',115000,{income:6000})],
 [f('Long Life Bananas',300,{}),f('Valuable Bananas',800,{income:100}),f('Monkey Bank',3650,{income:225}),f('IMF Loan',7200,{income:225,ability:ability('loan',85,85,0,9000)}),f('Monkey-Nomics',100000,{income:225,ability:ability('loan',60,60,0,9000)})],
 [f('EZ Collect',250,{}),f('Banana Salvage',400,{}),f('Marketplace',2700,{income:320}),f('Central Market',15000,{income:1120}),f('Monkey Wall Street',70000,{income:5120,range:75})]
]};
const sb=baseStats({damage:1,pierce:5,cooldown:1.75,range:34,camo:true,projectileSpeed:0,lifespan:50});const s=tierTable(sb);
export const spike:TowerDefinition={name:'Spike Factory',cost:1000,footprint:8,color:0x8e9ba8,base:sb,paths:[
 [s('Bigger Stacks',800,{pierce:10}),s('White Hot Spikes',600,{pierce:10,damageType:'normal',frozen:true,lead:true}),s('Spiked Balls',2300,{damage:2,pierce:11,ceramicBonus:3,fortifiedBonus:1,damageType:'normal',frozen:true,lead:true}),s('Spiked Mines',9500,{damage:2,pierce:18,ceramicBonus:6,fortifiedBonus:3,damageType:'normal',frozen:true,lead:true}),s('Super Mines',125000,{damage:50,pierce:18,cooldown:3.5,ceramicBonus:30,fortifiedBonus:15,damageType:'normal',frozen:true,lead:true})],
 [s('Faster Production',600,{cooldown:1.4}),s('Even Faster Production',800,{cooldown:1.05}),s('MOAB SHREDR',2500,{cooldown:1.05,moabBonus:7}),s('Spike Storm',7000,{cooldown:1.05,moabBonus:7,ability:ability('storm',50,0,2)}),s('Carpet of Spikes',41000,{damage:3,pierce:10,cooldown:0.525,moabBonus:7,range:50,ability:ability('storm',50,0,2)})],
 [s('Long Reach',150,{range:42,lifespan:100}),s('Smart Spikes',400,{range:42,lifespan:100}),s('Long Life Spikes',1300,{range:42,lifespan:140}),s('Deadly Spikes',3600,{range:42,lifespan:140,damage:3}),s('Perma-Spike',30000,{range:42,lifespan:300,damage:10,pierce:50,cooldown:6.06})]
]};
const vb=baseStats({damage:0,projectiles:0,range:40});const v=tierTable(vb);
export const village:TowerDefinition={name:'Monkey Village',cost:1200,footprint:11,color:0xc9a078,base:vb,paths:[
 [v('Bigger Radius',400,{range:48}),v('Jungle Drums',1500,{range:48}),v('Primary Training',800,{range:48}),v('Primary Mentoring',2500,{range:55}),v('Primary Expertise',25000,{range:55})],
 [v('Grow Blocker',250,{}),v('Radar Scanner',2000,{camo:true}),v('Monkey Intelligence Bureau',7500,{camo:true}),v('Call to Arms',20000,{camo:true,ability:ability('arms',45,15,15)}),v('Homeland Defense',40000,{camo:true,ability:ability('arms',45,15,20)})],
 [v('Monkey Business',500,{}),v('Monkey Commerce',500,{}),v('Monkey Town',10000,{}),v('Monkey City',3000,{range:50}),
 // uncertain: Monkeyopolis price is computed at purchase from farm count; 0 is a display placeholder.
 v('Monkeyopolis',0,{range:50})]
]};
const eb=baseStats({cooldown:0.7,pierce:3,range:40,projectileSpeed:375,lifespan:0.24,radius:2});const e=tierTable(eb);
export const engineer:TowerDefinition={name:'Engineer Monkey',cost:350,footprint:7,color:0xd1a442,base:eb,paths:[
 [e('Sentry Gun',500,{}),e('Faster Engineering',400,{}),e('Sprockets',575,{cooldown:0.35}),e('Sentry Expert',2500,{cooldown:0.35}),e('Sentry Champion',32000,{cooldown:0.3})],
 [e('Larger Service Area',250,{range:60}),e('Deconstruction',350,{range:60,moabBonus:1,fortifiedBonus:1}),e('Cleansing Foam',900,{range:60,moabBonus:1,fortifiedBonus:1}),
 // uncertain: Overclock cooldown is omitted; use 45 seconds.
 e('Overclock',13500,{range:60,moabBonus:1,fortifiedBonus:1,pierce:15,projectileSpeed:750,lifespan:0.12,ability:ability('overclock',45,0,60)}),e('Ultraboost',72000,{range:60,moabBonus:1,fortifiedBonus:1,pierce:30,projectileSpeed:750,lifespan:0.12,ability:ability('overclock',35,0,60)})],
 [e('Oversize Nails',450,{pierce:8,damageType:'shatter',frozen:true}),e('Pin',220,{pierce:8,damageType:'shatter',frozen:true,stun:1}),e('Double Gun',450,{pierce:8,damageType:'shatter',frozen:true,stun:1,cooldown:0.35}),e('Bloon Trap',3600,{pierce:8,damageType:'shatter',frozen:true,stun:1,cooldown:0.35}),e('XXXL Trap',45000,{pierce:8,damageType:'shatter',frozen:true,stun:1,cooldown:0.35})]
]};
// uncertain: ranged beast stats use minimum unmerged power, scaling linearly through wiki ranges on merge.
const bb=baseStats({cooldown:1.4,range:20,damageType:'energy',pierce:4,radius:12,lifespan:0.3});const b=tierTable(bb);
export const beast:TowerDefinition={name:'Beast Handler',cost:250,footprint:7,color:0x699b77,base:bb,paths:[
 [b('Piranha',160,{range:25,cooldown:0.6,pierce:1,radius:4,damageType:'shatter',frozen:true}),b('Barracuda',810,{range:35,cooldown:0.6,damage:2,pierce:4,radius:8,damageType:'shatter',frozen:true,knockback:true}),b('Great White',2010,{range:40,cooldown:0.6,damage:12,pierce:10,radius:15,damageType:'normal',frozen:true,lead:true}),b('Orca',12500,{range:50,cooldown:0.6,damage:30,pierce:20,radius:24,damageType:'normal',frozen:true,lead:true,knockback:true}),b('Megalodon',45000,{range:60,cooldown:0.6,damage:600,pierce:50,radius:48,damageType:'normal',frozen:true,lead:true})],
 [b('Microraptor',175,{cooldown:1,pierce:5,radius:10,damageType:'sharp'}),b('Adasaurus',830,{cooldown:1,damage:2,pierce:8,radius:15,damageType:'normal',lead:true,frozen:true}),b('Velociraptor',2065,{range:24,cooldown:1,damage:4,pierce:12,radius:18,damageType:'normal',lead:true,frozen:true,ceramicBonus:4}),b('Tyrannosaurus Rex',9500,{range:30,cooldown:1,damage:20,pierce:20,radius:18,damageType:'normal',lead:true,frozen:true,ceramicBonus:5,ability:ability('stomp',40,0,0,150,1,400,100)}),b('Giganotosaurus',60000,{range:50,cooldown:1.25,damage:500,pierce:33,radius:24,damageType:'normal',lead:true,frozen:true,ceramicBonus:5,ability:ability('stomp',25,0,0,300,1,600,2000)})],
 [b('Gyrfalcon',190,{range:60,cooldown:1,damage:1,pierce:3,radius:10,damageType:'sharp'}),b('Horned Owl',860,{range:60,cooldown:1,damage:1,pierce:3,radius:10,damageType:'sharp',camo:true}),b('Golden Eagle',2120,{range:60,cooldown:1,damage:1,pierce:30,radius:25,damageType:'normal',camo:true,lead:true,frozen:true}),b('Giant Condor',9000,{range:60,cooldown:1,damage:2,pierce:30,radius:25,moabBonus:11,damageType:'normal',camo:true,lead:true,frozen:true}),b('Pouākai',30000,{range:60,cooldown:0.85,damage:10,pierce:150,radius:25,moabBonus:80,damageType:'normal',camo:true,lead:true,frozen:true})]
]};

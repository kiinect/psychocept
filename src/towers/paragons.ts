import { ability, baseStats, type TowerStats } from './types';
import type { TowerKind } from './index';
export interface ParagonDefinition { name:string; cost:number; stats:TowerStats }
// uncertain: local wiki captures paragon behavior but omits most numbers. These original
// degree-1 estimates retain each weapon's identity; damage/pierce scale with degree in Sim.
const p=(name:string,cost:number,stats:Partial<TowerStats>):ParagonDefinition=>({name,cost,stats:baseStats({damage:100,pierce:100,cooldown:0.2,range:100,damageType:'normal',lead:true,frozen:true,camo:true,projectileSpeed:500,lifespan:3,ability:ability('paragon',60,0,10,1000,2,100,100),...stats})});
export const PARAGONS:Partial<Record<TowerKind,ParagonDefinition>>={
 dart:p('Apex Plasma Master',150000,{projectiles:3,spread:15,split:true,bounce:true,ceramicBonus:100}),
 boomerang:p('Glaive Dominus',375000,{kind:'boomerang',range:2000,homing:true,bounceRange:2000,orbit:35,burnDamage:50,burnDuration:5}),
 bomb:p('Ballistic Obliteration Missile Bunker',650000,{kind:'bomb',damage:500,cooldown:1,radius:50,homing:true,clusters:8,recursive:1,camo:false,stun:2,moabStun:1,knockback:true}),
 tack:p('Crucible of Steel and Flame',200000,{kind:'tack',radial:true,projectiles:4,cooldown:0.1,range:80,camo:false,burnDamage:50,burnDuration:5}),
 ice:p('Herald of Everfrost',300000,{kind:'ice',pierce:1000,freezeDuration:10,freezeLayers:10,brittle:8,brittleDuration:10,auraSlow:0.5,moabSlow:0.5}),
 sniper:p('S.P.I.D.E.R. Monkey',800000,{range:2000,damage:1000,bounceRange:2000,stun:2,moabStun:1,brittle:5,brittleDuration:10}),
 sub:p('Nautic Siege Core',400000,{range:2000,homing:true,radius:30,entryDamage:1000,secondaryCooldown:1,meteor:500}),
 buccaneer:p('Navarch of the Seas',550000,{projectiles:18,spread:5,radius:20,income:5000,secondaryCooldown:1,meteor:300}),
 ace:p('Goliath Doomship',900000,{projectiles:12,spread:5,range:2000,radius:20,homing:true,moveSpeed:120,secondaryCooldown:0.5,meteor:500}),
 wizard:p('Magus Perfectus',800000,{homing:true,projectiles:3,spread:10,burnDamage:100,burnDuration:5,secondaryCooldown:0.5,meteor:500}),
 ninja:p('Ascended Shadow',500000,{homing:true,projectiles:8,spread:10,camoBonus:100,knockback:true,stun:3,moabStun:1}),
 druid:p('Root of all Nature',475000,{projectiles:8,spread:6,bounceRange:100,stripRegrow:true,income:1000}),
 engineer:p('Master Builder',600000,{projectiles:3,spread:10,stun:5,moabStun:5}),
 spike:p('Mega Massive Munitions Factory',750000,{range:100,damage:1000,pierce:100,lifespan:300,projectileSpeed:0,cooldown:2}),
};

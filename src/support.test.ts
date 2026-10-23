import { expect, test } from 'vitest';
import { Sim } from './sim';
import { TOWERS } from './towers';
test('all five support towers are registered', () => {
  for (const type of ['farm','spike','village','engineer','beast']) expect(Object.keys(TOWERS)).toContain(type);
});

import { PARAGONS } from './towers/paragons';
import type { TowerKind } from './towers';
const support = ['farm','spike','village','engineer','beast'] as const;
const wikiNames = ['banana_farm','spike_factory','monkey_village','engineer_monkey','beast_handler'];
function setup(type:TowerKind,path=0,tier=0) {
  const s=new Sim([{x:0,y:150},{x:960,y:150}],'medium',[{x:60,y:165,width:150,height:100}]);
  s.cash=1e9;s.lives=1e9;s.addTower(100,125,type);
  for(let n=0;n<tier;n++){if(type==='village' && path===2 && n===4)s.addTower(110,125,'farm');expect(s.upgrade(0,path)).toBe(true);}
  return s;
}
test('all 75 support tiers match local wiki names and prices',()=>{
  const files=import.meta.glob('../data/wiki/towers/*.json',{eager:true,import:'default'}) as Record<string,{data:{paths:Record<string,{name:string;cost_medium:number|null}[]>}}>;
  support.forEach((type,i)=>TOWERS[type].paths.forEach((p,k)=>p.forEach((t,j)=>{
    const source=files[`../data/wiki/towers/${wikiNames[i]}.json`].data.paths[String(k+1)][j];
    expect(t.name).toBe(source.name);expect(t.cost).toBe(source.cost_medium??0);
  })));
});
test('village buffs every tower without mutating purchased stats, and ends on sale',()=>{
  for(const type of Object.keys(TOWERS) as TowerKind[]) {
    const s=setup('village',1,3);s.addTower(115,125,type);const t=s.towers[1];
    const stats=s.effectiveStats(t);expect(stats.range).toBeGreaterThan(t.range);expect(stats.camo).toBe(true);expect(stats.damageType).toBe('normal');
    s.sell(0);expect(s.effectiveStats(t).range).toBe(t.range);
  }
});
test('farm round income, bank collection, Central synergy and markets',()=>{
  const s=setup('farm');const cash=s.cash;s.startRound([{type:'red',n:1,gap:1}]);s.bloons=[];s.spawnQ=[];s.step();expect(s.cash-cash).toBe(181);
  const b=setup('farm',1,3);b.startRound([{type:'red',n:1,gap:1}]);b.spawnQ=[];b.step();expect(b.towers[0].bank).toBe(258.75);
  const before=b.cash;expect(b.collect(0)).toBe(true);expect(b.cash-before).toBe(258.75);expect(b.collect(0)).toBe(false);
  const c=setup('farm',0,5);c.addTower(200,125,'farm');for(let n=0;n<4;n++)c.upgrade(1,0);expect(c.roundIncome(c.towers[1])).toBe(1875);
});
test('spike piles deploy without targets, consume pierce, and persist according to tier',()=>{
  const s=setup('spike',2,5);s.step();expect(s.roadItems.length).toBeGreaterThan(0);
  const pile=s.roadItems[0];s.bloons.push({id:999,type:'moab',dist:pile.dist,hp:1e6,stunnedUntil:1e6});s.step();expect(pile.pierce).toBeLessThan(50);
  s.startRound([{type:'red',n:1,gap:1}]);s.spawnQ=[];s.bloons=[];s.step();expect(s.roadItems.length).toBeGreaterThan(0);
});
test('paragons require three distinct tier-five paths, absorb their kind and scale degree',()=>{
  for(const type of Object.keys(PARAGONS) as TowerKind[]) {
    const s=setup(type,0,5);expect(s.makeParagon(0)).toBe(false);
    for(let path=1;path<3;path++){s.addTower(200+path*50,125,type);for(let n=0;n<5;n++)expect(s.upgrade(path,path)).toBe(true);}
    expect(s.makeParagon(0)).toBe(true);expect(s.towers).toHaveLength(1);expect(s.towers[0].degree).toBeGreaterThanOrEqual(1);expect(s.makeParagon(0)).toBe(false);
    const b={id:999,type:'bad',dist:110,hp:1e9,stunnedUntil:1e6};s.bloons.push(b);for(let n=0;n<300;n++)s.step();expect(b.hp,type).toBeLessThan(1e9);
  }
});

for(const type of support)for(let path=0;path<3;path++)for(let tier=1;tier<=5;tier++)test(`${type} ${path+1}/${tier} runs its tier headlessly`,()=>{
  const s=setup(type,path,type==='beast' && tier===5?4:tier);
  if(type==='beast' && tier===5){for(let n=0;n<3;n++){const index=s.towers.length;s.addTower(180+n*10,125,'beast');for(let k=0;k<4;k++)expect(s.upgrade(index,path)).toBe(true);expect(s.mergeBeast(index,0,path)).toBe(true);}expect(s.upgrade(0,path)).toBe(true);}
  if(type==='farm') {
    const before=s.cash;s.startRound([{type:'red',n:1,gap:1}]);s.spawnQ=[];s.step();
    expect(s.cash-before+(s.towers[0].bank??0)).toBeGreaterThan(101);
  } else if(type==='village') {
    s.addTower(110,125,'dart');s.bloons.push({id:999,type:'moab',dist:110,hp:1e7,stunnedUntil:1e7});
    s.step();expect(s.effectiveStats(s.towers[1]).range).toBeGreaterThan(s.towers[1].range);
    if(path===0 && tier===5)expect(s.bloons[0].hp).toBeLessThan(1e7);
  } else {
    if(type==='spike')s.setTarget(0,{x:100,y:150});
    const b={id:999,type:'moab',dist:100,hp:1e7,stunnedUntil:1e7};s.bloons.push(b);
    for(let n=0;n<300;n++)s.step();
    expect(b.hp<1e7 || !s.bloons.includes(b),type+' '+path+'/'+tier).toBe(true);
  }
});
test('stacked village discounts, primary free tiers, and sale restoration use actual prices',()=>{
  const s=setup('village',2,2);s.addTower(110,125,'dart');expect(s.towers[1].cost).toBe(170);
  expect(s.upgradePrice(1,0)).toBe(120);s.addTower(120,125,'village');s.upgrade(2,2);s.upgrade(2,2);expect(s.upgradePrice(1,0)).toBe(115);
  s.addTower(130,125,'village');for(let n=0;n<5;n++)s.upgrade(3,0);expect(s.upgradePrice(1,0)).toBe(0);expect(s.upgrade(1,0)).toBe(true);expect(s.upgradePrice(1,0)).toBe(0);
  s.sell(3);expect(s.upgradePrice(1,0)).toBeGreaterThan(0);
});
test('Monkeyopolis charges by farm count, absorbs only eligible farms, and grants income',()=>{
  const s=setup('village',2,4);expect(s.upgrade(0,2)).toBe(false);s.addTower(110,125,'farm');s.addTower(115,125,'farm');
  expect(s.upgradePrice(0,2)).toBe(10000);expect(s.upgrade(0,2)).toBe(true);expect(s.towers).toHaveLength(1);expect(s.roundIncome(s.towers[0])).toBeGreaterThan(1000);
});
test('Beast water and tier-five merge prerequisites are enforced and power increases damage',()=>{
  const s=setup('beast');s.water=[];expect(s.upgrade(0,0)).toBe(false);for(let n=0;n<4;n++)s.upgrade(0,1);expect(s.upgrade(0,1)).toBe(false);
  s.addTower(200,125,'beast');for(let n=0;n<4;n++)s.upgrade(1,1);const damage=s.effectiveStats(s.towers[0]).damage;
  expect(s.mergeBeast(1,0,1)).toBe(true);expect(s.effectiveStats(s.towers[0]).damage).toBeGreaterThan(damage);expect(s.mergeBeast(0,1,1)).toBe(false);expect(s.upgrade(1,1)).toBe(false);
});
for(const [type,path,tier] of [['farm',1,4],['farm',1,5],['spike',1,4],['spike',1,5],['village',1,4],['village',1,5],['engineer',1,4],['engineer',1,5],['beast',1,4]] as const)test(`${type} ${tier} ability has an observable effect and cooldown`,()=>{
  const s=setup(type,path,tier);s.addTower(110,125,'dart');s.startRound([{type:'moab',n:1,gap:1}]);s.tick=s.towers[0].abilityReady;
  s.bloons.push({id:999,type:'moab',dist:110,hp:1e7,stunnedUntil:0});const cash=s.cash, hp=s.bloons[0].hp;
  expect(s.activate(0)).toBe(true);expect(s.activate(0)).toBe(false);
  if(type==='farm')expect(s.cash-cash).toBe(9000);
  if(type==='spike')expect(s.roadItems.length).toBe(204);
  if(type==='village')expect(s.effectiveStats(s.towers[1]).pierce).toBeGreaterThan(s.towers[1].pierce);
  if(type==='engineer')expect(s.towers[1].overclockUntil).toBeGreaterThan(s.tick);
  if(type==='beast')expect(s.bloons[0].hp).toBeLessThan(hp);
});
test('Engineer sentries expire; foam removes camo/regrow; XXXL trap consumes MOABs but not BADs',()=>{
  const s=setup('engineer',0,5);s.step();expect(s.sentries.length).toBe(1);s.sell(0);s.step();expect(s.sentries).toHaveLength(0);
  const f=setup('engineer',1,3);f.step();const foam=f.roadItems.find(i=>i.kind==='foam')!;expect(foam).toBeDefined();const b={id:999,type:'ceramic',dist:foam.dist,hp:10000,camo:true,regrow:true,stunnedUntil:10000};f.bloons.push(b);f.step();expect(b.camo).toBe(false);expect(b.regrow).toBe(false);
  const t=setup('engineer',2,5);t.step();const trap=t.roadItems.find(i=>i.kind==='trap')!;const cash=t.cash;t.bloons.push({id:998,type:'moab',dist:trap.dist,hp:200,stunnedUntil:10000},{id:999,type:'bad',dist:trap.dist,hp:20000,stunnedUntil:10000});t.step();expect(t.bloons.some(b=>b.id===998)).toBe(false);expect(t.bloons.some(b=>b.id===999)).toBe(true);expect(t.cash).toBe(cash); // cash remains in a partially filled manually collected trap
});
test('all local wiki paragons are implemented and non-paragon kinds are rejected',()=>{
  const files=import.meta.glob('../data/wiki/towers/*.json',{eager:true,import:'default'}) as Record<string,{data:{paragon?:{name:string}|null}}>;
  const names=Object.values(files).flatMap(f=>f.data.paragon?[f.data.paragon.name]:[]).sort();expect(Object.values(PARAGONS).map(p=>p.name).sort()).toEqual(names);
  expect(setup('farm',0,5).makeParagon(0)).toBe(false);
});
test('support simulations remain deterministic',()=>{
  const run=()=>{const s=setup('spike',1,5);s.addTower(110,125,'engineer');s.upgrade(1,0);s.startRound([{type:'ceramic',n:30,gap:0.15}]);for(let n=0;n<900;n++)s.step();return JSON.stringify([s.cash,s.lives,s.bloons,s.roadItems.map(i=>[i.dist,i.pierce])]);};expect(run()).toBe(run());
});

test('bananas collect manually, expire with salvage, and round settlement does not pay twice',()=>{
  const s=setup('farm');s.startRound([{type:'moab',n:1,gap:1}]);s.step();expect(s.collectibles).toHaveLength(1);const cash=s.cash;
  expect(s.collect(0)).toBe(true);expect(s.cash-cash).toBe(20);s.bloons=[];s.spawnQ=[];s.step();expect(s.cash-cash).toBe(80+101);
  const f=setup('farm',2,2);f.startRound([{type:'moab',n:1,gap:1}]);f.step();f.tick=f.collectibles[0].until;const before=f.cash;f.step();expect(f.cash-before).toBe(17);
});
test('MIB applies to auxiliary fireballs and village attack speed reaches runtime attacks',()=>{
  const s=setup('village',1,3);s.addTower(110,125,'wizard');s.upgrade(1,1);s.towers[1].cd=10000;
  const b={id:999,type:'purple',dist:110,hp:10000,camo:true,stunnedUntil:10000};s.bloons.push(b);s.step();expect(b.hp).toBeLessThan(10000);
  const d=setup('village',0,2);d.addTower(110,125,'dart');d.bloons.push({id:999,type:'moab',dist:110,hp:10000,stunnedUntil:10000});d.step();expect(d.towers[1].cd).toBeCloseTo(d.towers[1].cooldown*0.85);
});

test('manual trap collection pays its stored RBE exactly once',()=>{
  const s=setup('engineer',2,4);s.step();const trap=s.roadItems[0];
  s.bloons.push({id:998,type:'ceramic',dist:trap.dist,hp:10,stunnedUntil:10000},{id:999,type:'bad',dist:800,hp:20000});s.step();
  expect(trap.stored).toBeGreaterThan(0);const before=s.cash,stored=trap.stored;expect(s.collect(0)).toBe(true);expect(s.cash-before).toBe(stored*2);expect(s.collect(0)).toBe(false);
});
test('IMF loans reject unpaid reborrowing and repay debt from new income',()=>{
  const s=setup('farm',1,4);s.startRound([{type:'moab',n:1,gap:1}]);s.tick=s.towers[0].abilityReady;expect(s.activate(0)).toBe(true);expect(s.towers[0].debt).toBe(9000);
  s.tick=s.towers[0].abilityReady;expect(s.activate(0)).toBe(false);s.addTower(100,125,'sniper');s.bloons.push({id:999,type:'red',dist:100,hp:1,stunnedUntil:1e7});const cash=s.cash;s.step();expect(s.towers[0].debt).toBe(8999.5);expect(s.cash-cash).toBe(0.5);
});
test('Monkey Town increases cash from auxiliary attacks',()=>{
  const s=setup('village',2,3);s.addTower(110,125,'wizard');s.upgrade(1,1);s.towers[1].cd=10000;s.bloons.push({id:999,type:'red',dist:110,hp:1,stunnedUntil:10000});const cash=s.cash;s.step();expect(s.cash-cash).toBe(1.5);
});
test('degree investment is validated, increases stats, and caps at 100',()=>{
  const run=(investment:number)=>{const s=setup('dart',0,5);for(let p=1;p<3;p++){s.addTower(200+p*40,125,'dart');for(let n=0;n<5;n++)s.upgrade(p,p);}expect(s.makeParagon(0,NaN)).toBe(false);expect(s.makeParagon(0,-1)).toBe(false);expect(s.makeParagon(0,investment)).toBe(true);return s.towers[0];};
  const low=run(0),high=run(1e8);expect(high.degree).toBe(100);expect(high.damage).toBeGreaterThan(low.damage);expect(high.cooldown).toBeLessThan(low.cooldown);
});
test('Homeland overrides Call to Arms but a weaker call cannot overlap Homeland',()=>{
  const s=setup('village',1,4);s.addTower(120,125,'village');for(let n=0;n<5;n++)s.upgrade(1,1);s.tick=Math.max(...s.towers.map(t=>t.abilityReady));expect(s.activate(0)).toBe(true);expect(s.activate(1)).toBe(true);expect(s.towers[0].abilityUntil).toBe(s.tick);s.towers[0].abilityReady=s.tick;expect(s.activate(0)).toBe(false);
});

for(const type of Object.keys(PARAGONS) as TowerKind[])test(`${PARAGONS[type]!.name} ability fires headlessly`,()=>{
  const s=setup(type,0,5);
  for(let path=1;path<3;path++){s.addTower(200+path*50,125,type);for(let n=0;n<5;n++)s.upgrade(path,path);}
  expect(s.makeParagon(0)).toBe(true);const t=s.towers[0];const b={id:999,type:'bad',dist:110,hp:1e8,stunnedUntil:1e8};s.bloons.push(b);
  expect(s.activate(0)).toBe(true);expect(s.activate(0)).toBe(false);
  expect(b.hp<1e8 || !s.bloons.includes(b) || s.sentries.length>0 || s.roadItems.length>0).toBe(true);
  expect(t.abilityReady).toBeGreaterThan(s.tick);
});

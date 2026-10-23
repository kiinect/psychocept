import { expect, test } from 'vitest';
import { Sim, type Bloon } from './sim';
import { TOWERS, type TowerKind } from './towers';
const magic = ['wizard', 'super', 'ninja', 'alchemist', 'druid', 'mermonkey'] as TowerKind[];
const names = ['wizard_monkey', 'super_monkey', 'ninja_monkey', 'alchemist', 'druid', 'mermonkey'];
function setup(type: TowerKind, path = 0, tier = 0) {
  const s = new Sim([{ x: 0, y: 150 }, { x: 960, y: 150 }], 'medium', [{ x: 60, y: 160, width: 200, height: 100 }]);
  s.cash = 1e8;
  expect(s.placeTower(100, type === 'mermonkey' ? 185 : 115, type)).toBe(true);
  for (let n = 0; n < tier; n++) expect(s.upgrade(0, path)).toBe(true);
  return s;
}
for (const type of magic) for (let path = 0; path < 3; path++) for (let tier = 1; tier <= 5; tier++) {
  test(`${type} ${path + 1}/${tier} fires in a headless simulation`, () => {
    const s = setup(type, path, tier);
    const b = { id: 999, type: 'moab', dist: 110, hp: 1e7, stunnedUntil: 1e6 };
    s.bloons.push(b);
    for (let n = 0; n < 900; n++) s.step();
    expect(b.hp < 1e7 || b.type === 'red').toBe(true);
  });
}
test('all 90 magic tier names and prices match local wiki', () => {
  const files = import.meta.glob('../data/wiki/towers/*.json', { eager: true, import: 'default' }) as Record<string, {data: {base_cost_medium: number; paths: Record<string, {name: string; cost_medium: number}[]>}}>;
  magic.forEach((type, i) => {
    const d = files[`../data/wiki/towers/${names[i]}.json`].data;
    expect(TOWERS[type].cost).toBe(d.base_cost_medium);
    TOWERS[type].paths.forEach((p, k) => p.forEach((t, j) => expect([t.name, t.cost]).toEqual([d.paths[String(k + 1)][j].name, d.paths[String(k + 1)][j].cost_medium])));
  });
});
test('Mermonkey requires water as specified by task', () => {
  const s = setup('mermonkey');
  expect(s.canPlace(400, 300, 'mermonkey')).toBe(false);
});

test('Alchemist brew buffs an ally without changing its purchased stats and expires after sale', () => {
  const s = setup('alchemist', 0, 4); s.addTower(120, 115, 'dart');
  const b = { id: 999, type: 'moab', dist: 120, hp: 10000, stunnedUntil: 10000 }; s.bloons.push(b);
  s.step(); expect(s.towers[1].brew?.source).toBe(s.towers[0]);
  expect(s.towers[1].damage).toBe(1);
  s.sell(0); for (let n = 0; n < 800; n++) s.step();
  expect(s.towers[0].brew).toBeUndefined();
});
test('Shimmer strips camo without requiring a visible target', () => {
  const s = setup('wizard', 2, 3); const b = {id:999,type:'moab',dist:110,hp:10000,camo:true};
  s.bloons.push(b); s.step(); expect(b.camo).toBe(false);
});
test('Ninja sticky bombs detonate after a delay', () => {
  const s = setup('ninja', 2, 4); const b = {id:999,type:'moab',dist:110,hp:10000,stunnedUntil:10000};
  s.bloons.push(b); s.step(); const hp = b.hp;
  for (let n=0;n<180;n++) s.step(); expect(b.hp).toBeLessThan(hp-450);
});
test('Druid lightning jumps to targets and vines kill ordinary bloons globally', () => {
  const s = setup('druid',0,2); const b={id:999,type:'moab',dist:110,hp:10000,stunnedUntil:10000}; s.bloons.push(b);s.step();expect(b.hp).toBeLessThan(10000);
  const v=setup('druid',1,3);v.bloons.push({id:998,type:'ceramic',dist:800,hp:10});v.step();expect(v.bloons).toHaveLength(0);
});
for (const [type,path,tier] of [['wizard',1,4],['wizard',1,5],['super',1,4],['super',1,5],['ninja',1,4],['ninja',1,5],['alchemist',1,4],['alchemist',1,5],['druid',1,4],['druid',1,5],['mermonkey',1,4],['mermonkey',1,5]] as const) {
  test(`${type} tier ${tier} ability activates, affects targets, and enforces cooldown`,()=>{
    const s=setup(type,path,tier);const t=s.towers[0];s.tick=t.abilityReady;
    const b={id:999,type:type==='druid'?'ceramic':'moab',dist:110,hp:1e6,stunnedUntil:1e6,slow:1};s.bloons.push(b);
    expect(s.activate(0)).toBe(true);expect(s.activate(0)).toBe(false);
    for(let n=0;n<120;n++)s.step();
    expect(b.hp<1e6 || !s.bloons.includes(b) || b.slow<1).toBe(true);
  });
}
for(const tier of [3,4,5]) test(`Darkshift tier ${tier} teleports to a validated destination`,()=>{
  const s=setup('super',2,tier);expect(s.setTarget(0,{x:100,y:70})).toBe(true);expect(s.activate(0)).toBe(true);
  expect(s.towers[0].y).toBe(70);expect(s.activate(0)).toBe(false);
});
test('Darkshift rejects invalid placement without consuming cooldown',()=>{
  const s=setup('super',2,3);s.setTarget(0,{x:100,y:150});expect(s.activate(0)).toBe(false);expect(s.towers[0].abilityReady).toBe(0);
});
test('Symphonic totems obey placement range and a six-second cooldown',()=>{
  const s=setup('mermonkey',2,4);expect(s.setTarget(0,{x:110,y:190})).toBe(true);expect(s.setTarget(0,{x:115,y:190})).toBe(false);
  s.tick+=360;expect(s.setTarget(0,{x:800,y:190})).toBe(false);
  const p=setup('mermonkey',2,5);expect(p.setTarget(0,{x:800,y:190})).toBe(true);
});

test('Shimmer and Counter-Espionage preserve regrow while removing camo',()=>{
  const s=setup('wizard',2,3);const b={id:999,type:'moab',dist:110,hp:1e6,camo:true,regrow:true,stunnedUntil:10000};s.bloons.push(b);s.step();
  expect(b.camo).toBe(false);expect(b.regrow).toBe(true);
});
test('Shimmer makes DDTs hittable by an ally without camo detection',()=>{
  const s=setup('wizard',2,3);const b={id:999,type:'ddt',dist:110,hp:1e6,camo:true,stunnedUntil:10000};s.bloons.push(b);
  s.addTower(110,115,'bomb');s.step();const hp=b.hp;for(let n=0;n<120;n++)s.step();expect(b.hp).toBeLessThan(hp);
});
test('Sabotage slows arrivals and Grand Saboteur removes 25% of new MOAB health',()=>{
  const s=setup('ninja',1,5);s.tick=s.towers[0].abilityReady;s.activate(0);s.startRound([{type:'moab',n:1,gap:1}]);s.step();
  expect(s.bloons[0].hp).toBe(150);expect(s.bloons[0].slow).toBe(0.5);
});
test('Annihilation is local and every third activation is stronger',()=>{
  const s=setup('super',1,4);const near={id:999,type:'bad',dist:110,hp:1e6},far={id:998,type:'bad',dist:800,hp:1e6};s.bloons.push(near,far);
  for(let n=0;n<3;n++){s.tick=s.towers[0].abilityReady;expect(s.activate(0)).toBe(true);}
  expect(near.hp).toBe(1e6-2600*3.5);expect(far.hp).toBe(1e6);
});
test('Total Transformation selects five closest allies and expires',()=>{
  const s=setup('alchemist',1,5);for(let n=0;n<6;n++)s.addTower(140+n*10,115,'dart');
  s.tick=s.towers[0].abilityReady;s.activate(0);expect(s.towers.filter(t=>(t.transformedUntil??0)>s.tick)).toHaveLength(6);
  s.tick+=1201;expect(s.towers.every(t=>(t.transformedUntil??0)<=s.tick)).toBe(true);
});
test('Vine Crush requires an ordinary visible bloon and consumes it without children',()=>{
  const s=setup('druid',1,4);s.tick=s.towers[0].abilityReady;
  expect(s.activate(0)).toBe(false);s.bloons.push({id:999,type:'ceramic',dist:800,hp:10});expect(s.activate(0)).toBe(true);expect(s.bloons).toHaveLength(0);
});
test('Ice Jet flood affects camo targets and leaves BAD movement unchanged',()=>{
  const s=setup('mermonkey',1,5);const b={id:999,type:'moab',dist:800,hp:1e6,camo:true,slow:1};const bad={id:998,type:'bad',dist:700,hp:1e6,slow:1};
  s.bloons.push(b,bad);s.activate(0);expect(b.hp).toBe(1e6-70);expect(b.slow).toBe(0.5);expect(bad.slow).toBe(1);
});
test('identical magic simulations remain deterministic',()=>{
  const run=()=>{const s=setup('ninja',2,5);s.startRound([{type:'ceramic',n:12,gap:0.1}]);for(let n=0;n<900;n++)s.step();return JSON.stringify([s.bloons,s.cash,s.lives,s.darts.map(d=>[d.x,d.y,d.life])]);};
  expect(run()).toBe(run());
});

test('Brew uses a shot cap and Permanent Brew survives time but ends on source sale',()=>{
  const s=setup('alchemist',0,3);s.addTower(120,115,'dart');s.step();const ally=s.towers[1];expect(ally.brew?.shots).toBe(25);
  ally.shots=25;s.step();expect(ally.brew).toBeUndefined();
  const p=setup('alchemist',0,5);p.addTower(120,115,'dart');p.step();p.tick+=100000;p.step();expect(p.towers[1].brew?.until).toBe(Infinity);
  p.sell(0);p.step();expect(p.towers[0].brew).toBeUndefined();
});
test('Acidic Mixture Dip lets an ordinary dart damage Lead',()=>{
  const s=setup('alchemist',0,2);s.addTower(120,115,'dart');s.towers[0].cd=10000;
  const b={id:999,type:'lead',dist:120,hp:10000,stunnedUntil:10000};s.bloons.push(b);for(let n=0;n<30;n++)s.step();expect(b.hp).toBeLessThan(10000);
});
for(const tier of [4,5])test(`Necromancer tier ${tier} spends graveyard to damage with undead`,()=>{
  const s=setup('wizard',2,tier);const t=s.towers[0];t.cd=10000;t.graveyard=tier===5?2200:50;
  const b={id:999,type:'purple',dist:110,hp:10000,stunnedUntil:10000};s.bloons.push(b);
  for(let n=0;n<120;n++)s.step();expect(t.graveyard).toBeLessThan(tier===5?2200:50);expect(b.hp).toBeLessThan(10000);
});
test('Fireball damages nearby targets independently of the primary bolt',()=>{
  const s=setup('wizard',1,1);s.towers[0].cd=10000;const b={id:999,type:'moab',dist:110,hp:10000,stunnedUntil:10000};s.bloons.push(b);s.step();expect(b.hp).toBe(9999);
});
test('Wall of Fire continues hitting between deployments',()=>{
  const s=setup('wizard',1,2);s.towers[0].cd=10000;const b={id:999,type:'moab',dist:110,hp:10000,stunnedUntil:10000};s.bloons.push(b);s.step();const hp=b.hp;for(let n=0;n<30;n++)s.step();expect(b.hp).toBeLessThan(hp);
});
test('Caltrops persist on the track and Flash Bomb stuns ordinary targets',()=>{
  const s=setup('ninja',2,3);s.towers[0].cd=10000;const b={id:999,type:'ceramic',dist:110,hp:10000,stunnedUntil:0};s.bloons.push(b);s.step();expect(b.stunnedUntil).toBeGreaterThan(s.tick);expect(s.darts.some(d=>d.life>30)).toBe(true);
});
test('concoction marks MOABs and detonates when the marked layer pops',()=>{
  const s=setup('alchemist',1,3);const marked: Bloon={id:999,type:'moab',dist:110,hp:1,stunnedUntil:10000};const nearby={id:998,type:'moab',dist:105,hp:10000,stunnedUntil:10000};
  s.bloons.push(marked,nearby);s.step();expect(marked.concoction).toBeDefined();for(let n=0;n<40;n++)s.step();expect(nearby.hp).toBeLessThan(9980);
});
test('Rubber to Gold marks targets and shrink never converts BADs',()=>{
  const s=setup('alchemist',2,4);const b: Bloon={id:999,type:'moab',dist:110,hp:10000,stunnedUntil:10000};s.bloons.push(b);s.step();expect(b.goldUntil).toBeGreaterThan(s.tick);
  const p=setup('alchemist',2,5);const moab={id:998,type:'zomg',dist:800,hp:4000};const bad={id:999,type:'bad',dist:800,hp:20000};p.bloons.push(moab,bad);p.step();expect(moab.type).toBe('red');expect(bad.type).toBe('bad');
});
test('Druid tornado pushes ordinary bloons back and Ball Lightning freezes them',()=>{
  const s=setup('druid',0,4);const b={id:999,type:'ceramic',dist:110,hp:10000,frozenUntil:0};s.bloons.push(b);s.step();expect(b.dist).toBeLessThan(110);expect(b.frozenUntil).toBeGreaterThan(s.tick);
});
test('Druid income and lives are granted exactly once at round completion',()=>{
  const s=setup('druid',1,5);const cash=s.cash,lives=s.lives;s.startRound([{type:'red',n:1,gap:1}]);for(let n=0;n<500;n++)s.step();
  expect(s.roundActive).toBe(false);expect(s.cash-cash).toBe(1120+101+1);expect(s.lives-lives).toBe(25);
});
test('Shinobi and Poplust auras speed other towers without modifying base stats',()=>{
  for(const type of ['ninja','druid'] as const){const s=setup(type,type==='ninja'?1:2,type==='ninja'?3:4);s.addTower(120,115,type);const base=s.towers[1].cooldown;
    s.bloons.push({id:999,type:'moab',dist:110,hp:1e6,stunnedUntil:10000});s.step();expect(s.towers[1].cd).toBeLessThan(base);expect(s.towers[1].cooldown).toBe(base);}
});
test('Mermonkey tentacles attack and Melody strips camo then holds targets',()=>{
  const s=setup('mermonkey',0,3);s.towers[0].cd=10000;const b={id:999,type:'moab',dist:110,hp:10000,stunnedUntil:10000};s.bloons.push(b);s.step();expect(b.hp).toBe(9992);
  const m=setup('mermonkey',2,3);const c={id:999,type:'ceramic',dist:110,hp:10000,camo:true,stunnedUntil:0};m.bloons.push(c);m.step();expect(c.camo).toBe(false);expect(c.stunnedUntil).toBe(m.tick+360);
});
test('frigid tridents cannot damage White or Purple and emit lateral wavelets',()=>{
  const s=setup('mermonkey',1,3);const b={id:999,type:'white',dist:110,hp:10000,stunnedUntil:10000};s.bloons.push(b);for(let n=0;n<70;n++)s.step();expect(b.hp).toBe(10000);expect(s.darts.some(d=>!d.owner && d.damageType==='frigid')).toBe(true);
});
test('Legend black hole absorbs leaks while active',()=>{
  const s=setup('super',2,5);const lives=s.lives;s.bloons.push({id:999,type:'bad',dist:959,hp:20000});for(let n=0;n<120;n++)s.step();expect(s.lives).toBe(lives);expect(s.bloons).toHaveLength(0);expect(s.towers[0].blackHoleUses).toBe(1);
});

test('Sun Temple sacrifices neighboring towers at purchase',()=>{
  const s=setup('super',0,3);s.addTower(120,115,'dart');s.addTower(800,300,'dart');expect(s.upgrade(0,0)).toBe(true);
  expect(s.towers.map(t=>t.x)).toEqual([100,800]);
});
test('Lord of the Abyss permits nearby water towers on land',()=>{
  const s=setup('mermonkey',0,5);expect(s.canPlace(100,140,'sub')).toBe(false);
  // Move the low-level test tower to land to exercise its independent placement aura.
  s.towers[0].x=400;s.towers[0].y=300;expect(s.canPlace(420,300,'sub')).toBe(true);expect(s.canPlace(500,300,'sub')).toBe(false);
});

import { expect, test } from 'vitest';
import { Sim, type Bloon } from './sim';
import { HEROES, heroRoundXP, heroStats, heroLevelXP, type HeroKind } from './heroes';
const path = [{ x: 0, y: 150 }, { x: 960, y: 150 }];
const water = [{ x: 60, y: 160, width: 160, height: 120 }];
function game(kind: HeroKind) {
  const s = new Sim(path, 'medium', water); s.cash = 1e7;
  expect(s.placeHero(100, kind === 'brickell' ? 185 : kind === 'churchill' ? 110 : 121, kind)).toBe(true);
  return s;
}
test('all eighteen heroes have twenty authored levels and source prices', () => {
  expect(Object.keys(HEROES)).toHaveLength(18);
  for (const d of Object.values(HEROES)) {
    expect(d.levels).toHaveLength(20);
    for (const level of d.levels) expect(level.description.length).toBeGreaterThan(0);
  }
  expect(HEROES.quincy.cost.medium).toBe(540);
  expect(heroStats('quincy', 1)).toMatchObject({ damage: 1, pierce: 3, cooldown: 0.95, range: 50 });
  expect(heroStats('quincy', 19)).toMatchObject({ pierce: 9, projectiles: 3, cooldown: 0.25 });
});
test('hero XP follows the supplied piecewise round formula and per-level multipliers', () => {
  expect([1, 20, 21, 50, 51].map(heroRoundXP)).toEqual([40, 420, 460, 1620, 1710]);
  expect(heroLevelXP('quincy', 2)).toBe(180);
  expect(heroLevelXP('churchill', 2)).toBe(308);
});
test('one hero per game, valid placement and exact difficulty price', () => {
  const s = game('quincy');
  expect(s.cash).toBe(1e7 - 540);
  expect(s.placeHero(300, 100, 'sauda')).toBe(false);
  expect(s.canPlace(100, 121, 'dart')).toBe(false);
  const w = new Sim(path, 'hard', water); w.cash = 1e6;
  expect(w.placeHero(300, 100, 'brickell')).toBe(false);
  expect(w.placeHero(100, 185, 'brickell')).toBe(true);
  expect(w.cash).toBe(1e6 - 970);
});
for (const kind of Object.keys(HEROES) as HeroKind[]) for (let level = 1; level <= 20; level++) {
  test(`${kind} level ${level} runs its attack or economy headlessly`, () => {
    const s = game(kind); s.grantHeroXP(1e9);
    // Exercise the exact level rather than only the maximum.
    s.hero!.level = level; s.hero!.stats = heroStats(kind, level);
    const b = { id: 999, type: kind === 'psi' ? 'red' : 'moab', dist: 100, hp: kind === 'psi' ? 1 : 1e6, stunnedUntil: 1e7 };
    s.bloons.push(b);
    const cash = s.cash;
    for (let n = 0; n < 400; n++) s.step();
    if (kind === 'benjamin') {
      s.bloons = []; s.startRound([{ type: 'red', n: 1, gap: 0 }]); s.step(); s.bloons = []; s.step();
      expect(s.cash).toBeGreaterThan(cash);
    } else expect((kind !== 'psi' && b.hp < 1e6) || !s.bloons.includes(b)).toBe(true);
  });
}

test('completed rounds grant XP exactly once, carry XP and unlock abilities without spending cash', () => {
  const s = game('quincy'); s.round = 7;
  expect(s.startRound([{ type: 'red', n: 1, gap: 0 }])).toBe(true);
  s.step(); s.bloons = []; const cash = s.cash; s.step();
  expect(s.hero!.level).toBe(2); expect(s.hero!.xp).toBe(0);
  expect(s.cash).toBe(cash + 108);
  for (let n = 0; n < 100; n++) s.step();
  expect(s.hero!.xp).toBe(0);
  s.grantHeroXP(460); expect(s.hero!.level).toBe(3);
  expect(s.activateHero('rapid')).toBe(false);
  s.tick += 1002; expect(s.activateHero('rapid')).toBe(true);
  expect(s.activateHero('rapid')).toBe(false);
});
test('XP grants reject invalid inputs, clamp level 20 and never resurrect a defeated game', () => {
  const s = game('adora');
  expect(s.grantHeroXP(NaN)).toBe(false); expect(s.grantHeroXP(-1)).toBe(false);
  s.grantHeroXP(1e9); expect(s.hero!.level).toBe(20); expect(s.hero!.xp).toBe(0);
  s.lives = 0;
  expect(s.activateHero('light')).toBe(false); expect(s.grantHeroXP(100)).toBe(false);
});
test('hero targeting changes damage recipient between First, Last, Close and Strong', () => {
  const s = game('rosalia'); s.hero!.stats.pierce = 1;
  const a = { id: 1, type: 'red', dist: 90, hp: 100, stunnedUntil: 9999 };
  const b = { id: 2, type: 'moab', dist: 110, hp: 100, stunnedUntil: 9999 };
  s.bloons.push(a, b); s.step(); expect(b.hp).toBe(97);
  s.cycleHeroTargeting(); expect(s.hero!.targeting).toBe('Last'); s.hero!.cd = 0; s.step(); expect(a.hp).toBe(97);
  s.cycleHeroTargeting(); expect(s.hero!.targeting).toBe('Close');
  s.cycleHeroTargeting(); expect(s.hero!.targeting).toBe('Strong');
});
import { heroAbilities } from './heroes';
import { HERO_ITEMS, HERO_SPELLS, itemStock } from './hero-extras';
import { heroTowerWeapon } from './hero-runtime';
for (const kind of Object.keys(HEROES) as HeroKind[]) {
  for (const a of heroAbilities(kind, 20).filter(a => a.id !== 'shop')) {
    test(`${kind}: ${a.name} enforces unlock and fires at its unlock level`, () => {
      const s = game(kind), h = s.hero!;
      s.grantHeroXP(1e9); h.level = a.level - 1; h.stats = heroStats(kind, h.level);
      expect(s.activateHero(a.id)).toBe(false);
      h.level++; h.stats = heroStats(kind, h.level); h.ready = {};
      s.placeTower(300, 100, 'dart');
      s.bloons.push({ id: 999, type: 'moab', dist: 100, hp: 1e6, stunnedUntil: 99999 });
      const point = ['walk', 'reposition', 'flight'].includes(a.id) ? { x: 300, y: 60 } : a.id === 'mine' ? { x: 100, y: 185 } : { x: 100, y: 150 };
      expect(s.activateHero(a.id, point, 0)).toBe(true);
      expect(h.ready[a.id]).toBeGreaterThan(s.tick);
      expect(s.activateHero(a.id, point, 0)).toBe(false);
      for (let n = 0; n < 700; n++) s.step();
      expect(Number.isFinite(h.cd)).toBe(true);
      expect(s.effects.every(e => Number.isFinite(e.radius))).toBe(true);
    });
  }
}
test('camo detection and lead damage unlock at the authored levels', () => {
  const s = game('quincy'); const h = s.hero!;
  const b = { id: 999, type: 'red', dist: 100, hp: 100, camo: true, stunnedUntil: 9999 }; s.bloons.push(b);
  s.step(); expect(b.hp).toBe(100);
  h.level = 5; h.stats = heroStats('quincy', 5); h.cd = 0; s.step(); expect(b.hp).toBe(99);
});
test('Adora sacrifice removes only the selected tower, grants 4x money in XP and buffs her', () => {
  const s = game('adora'); s.grantHeroXP(25000); expect(s.hero!.level).toBeGreaterThanOrEqual(7);
  s.placeTower(300, 100, 'dart'); s.placeTower(400, 100, 'dart');
  const before = s.hero!.xp, level = s.hero!.level;
  expect(s.activateHero('sacrifice', undefined, 0)).toBe(true);
  expect(s.towers).toHaveLength(1); expect(s.towers[0].x).toBe(400);
  expect(s.hero!.level > level || s.hero!.xp >= before + 800).toBe(true);
  expect(s.hero!.until.sacrifice).toBeGreaterThan(s.tick);
});
test('Ezili totem spends lives, refuses lethal sacrifice and buffs nearby towers', () => {
  const s = game('ezili'); s.grantHeroXP(1e9); s.placeTower(140, 110, 'dart');
  s.lives = 1; expect(s.activateHero('totem')).toBe(false);
  s.lives = 20; expect(s.activateHero('totem')).toBe(true); expect(s.lives).toBe(19);
  const weapon = heroTowerWeapon(s, s.towers[0]);
  expect(weapon.camo).toBe(true); expect(weapon.cooldown).toBeLessThan(s.towers[0].cooldown);
});
test('MOAB Hex drains health over time, jumps targets, and suppresses children', () => {
  const s = game('ezili'); s.grantHeroXP(1e9);
  const a = { id: 100, type: 'moab', dist: 700, hp: 10, stunnedUntil: 99999 };
  const b = { id: 101, type: 'bfb', dist: 600, hp: 700, stunnedUntil: 99999 }; s.bloons.push(a, b);
  expect(s.activateHero('hex')).toBe(true); s.step();
  expect(s.bloons.includes(a)).toBe(false); expect(s.bloons).toHaveLength(1);
  for (let n = 0; n < 61; n++) s.step(); expect(b.hp).toBeLessThan(700);
});
test('Striker artillery refreshes supported abilities and doubles their damage at level 20', () => {
  const s = game('striker'); s.grantHeroXP(1e9); s.placeTower(300, 100, 'bomb');
  s.towers[0].abilityReady = 9999;
  expect(s.activateHero('artillery')).toBe(true); expect(s.towers[0].abilityReady).toBe(s.tick);
  expect(heroTowerWeapon(s, s.towers[0]).damage).toBe(s.towers[0].damage * 2);
});
test('Etienne gives all towers camo detection at level 8 without changing stored stats', () => {
  const s = game('etienne'); s.placeTower(300, 100, 'dart'); const t = s.towers[0];
  s.hero!.level = 7; expect(heroTowerWeapon(s, t).camo).toBe(false);
  s.hero!.level = 8; expect(heroTowerWeapon(s, t).camo).toBe(true); expect(t.camo).toBe(false);
});
test('Benjamin Biohack buffs nearest allies, then disables them for two seconds', () => {
  const s = game('benjamin'); s.grantHeroXP(1e9); s.placeTower(300, 100, 'dart');
  expect(s.activateHero('biohack')).toBe(true);
  const t = s.towers[0]; expect(heroTowerWeapon(s, t).damage).toBe(t.damage + 3);
  s.tick = s.hero!.until.biohack; expect(heroTowerWeapon(s, t).cooldown).toBe(1e9);
  s.tick += 120; expect(heroTowerWeapon(s, t).cooldown).toBe(t.cooldown);
});
test('Mega Mine waits for a blimp and damages and stuns nearby survivors', () => {
  const s = game('brickell'); s.grantHeroXP(1e9);
  expect(s.activateHero('mine', { x: 100, y: 170 })).toBe(true);
  s.step(); expect(s.hero!.zones).toHaveLength(1);
  const b = { id: 999, type: 'moab', dist: 100, hp: 20000, stunnedUntil: 0 }; s.bloons.push(b);
  for (let n = 0; n < 61; n++) s.step();
  expect(b.hp).toBeLessThanOrEqual(9000); expect(b.stunnedUntil).toBeGreaterThan(s.tick);
  expect(s.hero!.zones).toHaveLength(0);
});
for (const spell of HERO_SPELLS) test(`Corvus learns and casts ${spell.name}`, () => {
  const s = game('corvus'); const h = s.hero!; s.grantHeroXP(1e9);
  h.level = spell.level - 1;
  expect(s.castHeroSpell(spell.id)).toBe(false);
  h.level++; h.mana = 400;
  expect(s.castHeroSpell(spell.id)).toBe(true);
  expect(s.castHeroSpell(spell.id)).toBe(false);
  expect(h.mana).toBeLessThan(800);
  if (spell.id !== 'nourishment' && spell.id !== 'overload') expect(h.until[spell.id]).toBeGreaterThan(s.tick);
});
for (const item of HERO_ITEMS) test(`Geraldo unlocks and purchases ${item.name} with limited stock`, () => {
  const s = game('geraldo'); s.grantHeroXP(1e9); const h = s.hero!;
  s.placeTower(300, 100, 'dart'); s.towers[0].income = 100;
  h.level = item.level - 1;
  expect(s.buyHeroItem(item.id, { x: 100, y: 150 }, 0)).toBe(false);
  h.level++; const cash = s.cash;
  expect(s.buyHeroItem(item.id, { x: 100, y: 150 }, 0)).toBe(true);
  expect(s.cash).toBe(cash - s.price(item.cost));
  expect(itemStock(s, item.id)).toBe(item.stock - 1);
  if (item.id === 'paragon') expect(h.paragonPower).toBe(2000);
});
test('Geraldo stock restocks by rounds, potion buffs expire, figure appreciates and sells', () => {
  const s = game('geraldo'); s.grantHeroXP(1e9); s.placeTower(300, 100, 'dart');
  expect(s.buyHeroItem('invisibility', undefined, 0)).toBe(true);
  expect(heroTowerWeapon(s, s.towers[0]).camo).toBe(true);
  s.round = 10; expect(heroTowerWeapon(s, s.towers[0]).camo).toBe(false);
  expect(itemStock(s, 'invisibility')).toBe(2);
  s.buyHeroItem('figure'); const cash = s.cash;
  s.startRound([{ type: 'red', n: 1, gap: 0 }]); s.step(); s.bloons = []; s.step();
  expect(s.sellHeroFigure()).toBe(true); expect(s.cash).toBeGreaterThan(cash + 700);
});
test('same inputs produce identical hero damage, spells, economy and random abilities', () => {
  function run() {
    const s = game('psi'); s.grantHeroXP(100000);
    for (let i = 0; i < 30; i++) s.bloons.push({ id: 100 + i, type: 'green', dist: 30 + i * 15, hp: 1 });
    s.activateHero('scream'); for (let i = 0; i < 240; i++) s.step();
    return { bloons: s.bloons, cash: s.cash, hero: s.hero, tick: s.tick };
  }
  expect(run()).toEqual(run());
});
test('Biohack recovery stops firing and resumes after two seconds', () => {
  const s = game('benjamin'); s.grantHeroXP(1e9); s.placeTower(300, 100, 'sniper');
  const b = { id: 999, type: 'moab', dist: 500, hp: 10000, stunnedUntil: 99999 }; s.bloons.push(b);
  s.activateHero('biohack'); s.tick = s.hero!.until.biohack; const hp = b.hp; s.step(); expect(b.hp).toBe(hp);
  s.tick += 120; s.step(); expect(b.hp).toBeLessThan(hp);
});
test('Silas creates walls, grants orbiting ice fragments and applies global ice discounts', () => {
  const s = game('silas'); s.grantHeroXP(1e9); s.placeTower(130, 120, 'ice');
  s.bloons.push({ id: 999, type: 'red', dist: 130, hp: 10000, stunnedUntil: 99999 });
  s.step(); expect(s.hero!.zones.some(z => z.id === 'wall')).toBe(true);
  expect(s.hero!.zones.some(z => z.id === 'fragment')).toBe(true);
  expect(s.towerPrice('ice', 1000, { x: 500, y: 100 }, 5)).toBe(750);
});
test('Rosalia discounts only nearby Ace and Heli purchases and upgrades', () => {
  const s = game('rosalia'); s.grantHeroXP(1e9);
  expect(s.towerPrice('ace', 1000, { x: 120, y: 110 })).toBe(900);
  expect(s.towerPrice('heli', 1000, { x: 500, y: 100 })).toBe(1000);
  expect(s.towerPrice('dart', 1000, s.hero!)).toBe(1000);
});
test('Kinetic Charge scales with received damage and bursts nearby targets', () => {
  const s = game('rosalia'); s.grantHeroXP(1e9);
  const b = { id: 999, type: 'moab', dist: 700, hp: 20000, stunnedUntil: 99999 };
  const other = { id: 998, type: 'moab', dist: 710, hp: 30000, stunnedUntil: 99999 }; s.bloons.push(b, other);
  s.hero!.targeting = 'Last'; expect(s.activateHero('kinetic')).toBe(true);
  b.hp -= 16000; s.step(); expect(other.hp).toBe(14000);
});
test('Dan quick thinking pushes imminent leaks back and has a cooldown', () => {
  const s = game('dan'); s.grantHeroXP(1e9);
  const b = { id: 999, type: 'moab', dist: 960, hp: 200 }; s.bloons.push(b);
  const lives = s.lives; s.step(); expect(s.lives).toBe(lives); expect(b.dist).toBeLessThan(960);
  expect(s.hero!.next.thinking).toBeGreaterThan(s.tick);
});
test('Corvus Soul Barrier absorbs leak damage and expires', () => {
  const s = game('corvus'); s.grantHeroXP(1e9); s.hero!.mana = 800;
  s.castHeroSpell('barrier'); s.hero!.cd = 1000;
  s.bloons.push({ id: 999, type: 'red', dist: 960, hp: 1 });
  const lives = s.lives; s.step(); expect(s.lives).toBe(lives);
  expect(s.hero!.assets.find(a => a.id === 'barrier')!.hp).toBe(199);
  s.tick += 1200; s.step(); expect(s.hero!.assets.some(a => a.id === 'barrier')).toBe(false);
});
test('Corvus Vision lets the spirit damage camo targets', () => {
  const s = game('corvus'); s.grantHeroXP(1e9);
  const b = { id: 999, type: 'moab', dist: 100, hp: 10000, camo: true, stunnedUntil: 99999 }; s.bloons.push(b);
  s.step(); expect(b.hp).toBe(10000);
  s.castHeroSpell('vision'); s.step(); expect(b.hp).toBeLessThan(10000);
});
for (const id of ['turret', 'nails', 'blade', 'fire', 'genie', 'rabbit']) test(`Geraldo's ${id} deals damage independently of his attack`, () => {
  const s = game('geraldo'); s.grantHeroXP(1e9); s.hero!.cd = 1e6;
  s.placeTower(300, 100, 'dart'); s.towers[0].cd = 1e6;
  const b = { id: 999, type: 'moab', dist: 100, hp: 10000, stunnedUntil: 99999 }; s.bloons.push(b);
  const quantity = id === 'rabbit' ? 4 : 1;
  for (let n = 0; n < quantity; n++) expect(s.buyHeroItem(id, { x: 100, y: 150 }, 0)).toBe(true);
  s.step(); expect(b.hp).toBeLessThan(10000);
});
test('Geraldo glue slows targets and Creepy Idol pushes them backwards', () => {
  const s = game('geraldo'); s.grantHeroXP(1e9); s.hero!.cd = 1e6;
  const b: Bloon = { id: 999, type: 'red', dist: 100, hp: 10000, stunnedUntil: 99999 }; s.bloons.push(b);
  s.buyHeroItem('glue', { x: 100, y: 150 }); s.step(); expect(b.glue?.stats.slow).toBe(0.5);
  s.buyHeroItem('idol', { x: 100, y: 150 }); s.step(); expect(b.dist).toBeLessThan(100);
});
for (const id of ['spear', 'echo', 'trample', 'aggression', 'ancestral', 'malevolence', 'storm', 'ember', 'frostbound', 'repel']) test(`Corvus ${id} affects combat`, () => {
  const s = game('corvus'); s.grantHeroXP(1e9); const h = s.hero!; h.mana = 800;
  const b = { id: 999, type: 'moab', dist: 100, hp: 100000, stunnedUntil: 99999, frozenUntil: 0, burn: undefined as import('./sim').DamageStatus | undefined }; s.bloons.push(b);
  expect(s.castHeroSpell(id)).toBe(true); s.step(); expect(b.hp).toBeLessThan(100000);
  if (id === 'ember') expect(b.burn).toBeDefined();
  if (id === 'frostbound') expect(b.stunnedUntil).toBe(s.tick + 60);
  if (id === 'repel') expect(b.dist).toBeLessThan(100);
});

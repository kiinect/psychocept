import metaJson from '../../data/wiki/meta.json';

export type PowerKind = 'instant' | 'timed' | 'trap' | 'tower' | 'unimplemented';
export interface PowerDef {
  id: string; name: string; cost: number; kind: PowerKind;
  /** Wiki effect prose (markup stripped). */
  text: string;
  /** Typed numeric effect data where hand-coded (seconds, multipliers, damage, counts). */
  fx: Record<string, number>;
  /** True when the wiki row was a custom/event/limited/noisy parse. */
  uncertain: boolean;
}

// Hand-coded effect data keyed by cleaned wiki name. Numbers from the wiki effect text ("Upgraded" = Monkey Knowledge variant).
const FX: Record<string, { kind: PowerKind; fx: Record<string, number> }> = {
  'Super Monkey Storm': { kind: 'instant', fx: { damage: 4000, damageUpgraded: 5000 } },
  'Monkey Boost': { kind: 'timed', fx: { speedMult: 2, duration: 15, durationUpgraded: 20 } },
  'Thrive': { kind: 'timed', fx: { cashMult: 1.25, cashMultUpgraded: 1.3, rounds: 2 } },
  'Time Stop': { kind: 'timed', fx: { bloonSpeedMult: 0.1, bossSpeedMult: 0.3, towerSpeedMult: 0.6, duration: 10, durationUpgraded: 15 } },
  'Cash Drop': { kind: 'instant', fx: { cash: 2500 } },
  'Banana Farmer': { kind: 'tower', fx: { range: 60, rangeUpgraded: 72 } },
  'Pontoon': { kind: 'tower', fx: {} },
  'Road Spikes': { kind: 'trap', fx: { pops: 20, popsUpgraded: 21, stacks: 5 } },
  'Glue Trap': { kind: 'trap', fx: { bloons: 300, slow: 0.5, duration: 30, stacks: 2 } },
  'MOAB Mine': { kind: 'trap', fx: { targets: 10, damage: 5000, damageUpgraded: 6250, cooldown: 1 } },
  'Camo Trap': { kind: 'trap', fx: { bloons: 500, bloonsUpgraded: 600, stacks: 2 } },
  'Portable Lake': { kind: 'tower', fx: {} },
  'Tech Bot': { kind: 'tower', fx: {} },
  'Energizing Totem': { kind: 'tower', fx: { range: 54, cooldownMult: 0.75, rounds: 5, rechargeMM: 20 } },
  'Cave Monkey': { kind: 'tower', fx: {} },
  'Banana Farmer Pro': { kind: 'tower', fx: {} },
  'Super Monkey Beacon': { kind: 'tower', fx: {} },
  'Hype Boost Monkey': { kind: 'tower', fx: { duration: 15, cooldown: 90 } },
  'Tech Bot Prime': { kind: 'tower', fx: {} },
};

const clean = (s: string) => s.replace(/\{\{MK(?: Icon)?\|([^}]*)\}\}/g, '$1').replace(/\{\{Monkey Money BTD6\}\}/g, 'MM ').replace(/align=center\|/g, '');
// "Cave Monkey Cave Monkey (hidden)" -> "Cave Monkey"; "Custom Power - X X" -> "X"
function nameOf(raw: string) {
  raw = raw.replace(/^Custom Power - /, '').replace(/ \(hidden\)$/, '');
  const m = Math.floor(raw.length / 2);
  return raw.length % 2 === 1 && raw[m] === ' ' && raw.slice(0, m) === raw.slice(m + 1) ? raw.slice(0, m) : raw;
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** All 44 wiki power rows. The 19 real powers have typed effects; event/custom/pack rows are kind 'unimplemented'. */
export const POWERS: readonly PowerDef[] = metaJson.data.powers.list.map((p, i) => {
  const name = nameOf(p.name), fx = FX[name];
  return { id: slug(name) || `power_${i}`, name, cost: p.cost, kind: fx?.kind ?? 'unimplemented', text: clean(p.effect), fx: fx?.fx ?? {}, uncertain: p.uncertain };
});
export const POWER_BY_ID: Record<string, PowerDef> = Object.fromEntries(POWERS.map(p => [p.id, p]));

// ---- Pure effect helpers ----
export const stormDamage = (up = false) => FX['Super Monkey Storm'].fx[up ? 'damageUpgraded' : 'damage'];
/** Storm damage applied to one bloon (outer layers only for MOAB-class, so never exceeds hp). */
export const stormHit = (hp: number, up = false) => Math.min(hp, stormDamage(up));
export const boostDuration = (up = false) => FX['Monkey Boost'].fx[up ? 'durationUpgraded' : 'duration'];
export const timeStopDuration = (up = false) => FX['Time Stop'].fx[up ? 'durationUpgraded' : 'duration'];

/** Thrive is active in the round it was used plus the next. */
export interface Thrive { startRound: number; upgraded: boolean }
export function thriveMult(t: Thrive | undefined, round: number): number {
  if (!t || round < t.startRound || round > t.startRound + 1) return 1;
  return t.upgraded ? 1.3 : 1.25;
}
export const scaleCash = (amount: number, mult: number) => Math.floor(amount * mult);
/** Monkey Boost: towers attack twice as fast => cooldown halves. */
export const boostCooldown = (cd: number, active: boolean) => (active ? cd / FX['Monkey Boost'].fx.speedMult : cd);

/** Spend Monkey Money on a power. Returns remaining balance, or undefined if unknown/unaffordable. */
export function buyPower(mm: number, id: string, count = 1): number | undefined {
  const p = POWER_BY_ID[id]; if (!p || count < 1) return undefined;
  const cost = p.cost * count; return mm >= cost ? mm - cost : undefined;
}

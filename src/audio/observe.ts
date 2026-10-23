import { ROUNDS, type Sim, type Tower } from '../sim';
import type { TowerKind } from '../towers';
/** Towers that never attack (income / aura only), so they have no attack cue. */
export type Passive = 'farm' | 'village';
export type Cue = 'pop' | 'ceramic' | 'placement' | 'upgrade' | 'sell' | 'ability' | 'roundStart' | 'roundEnd' | 'defeat' | 'victory' | `attack:${Exclude<TowerKind, Passive>}`;
export class AudioObserver {
  private sim?: Sim;
  private towers = new Map<Tower, { cost: number; shots: number; ready: number }>();
  private bloons = new Map<number, { hp: number; type: string }>();
  private lives = 0;
  private cash = 0;
  private round = 0;
  private active = false;
  update(s: Sim): Cue[] {
    const cues = new Set<Cue>(), same = this.sim === s;
    if (same) {
      if (s.lives <= 0 && this.lives > 0) cues.add('defeat');
      if (s.round > this.round) cues.add('roundStart');
      if (this.active && !s.roundActive && !s.gameOver) {
        cues.add('roundEnd');
        if (s.round >= ROUNDS.length) cues.add('victory');
      }
      if ([...this.towers.keys()].some(t => !s.towers.includes(t))) cues.add('sell');
      for (const t of s.towers) {
        const old = this.towers.get(t);
        if (!old) cues.add('placement');
        else {
          if (t.cost > old.cost) cues.add('upgrade');
          if (t.shots + (t.magicActs ?? 0) > old.shots) cues.add(`attack:${t.type as Exclude<TowerKind, Passive>}`);
          // Learning an ability sets its initial cooldown too; exclude upgrades.
          if (t.cost === old.cost && t.abilityReady > old.ready && t.abilityUntil >= s.tick) cues.add('ability');
        }
      }
      // Pop income also catches bloons spawned and destroyed between rendered frames.
      const income = s.cash - this.cash - (cues.has('roundEnd') ? 100 + s.round : 0);
      if (income > 0 && !cues.has('sell')) cues.add('pop');
      const now = new Map(s.bloons.map(b => [b.id, b]));
      for (const [id, old] of this.bloons) {
        const b = now.get(id);
        if ((b && b.hp < old.hp) || (!b && s.lives === this.lives)) {
          cues.add('pop'); if (old.type.includes('ceramic')) cues.add('ceramic');
        }
      }
    }
    this.sim = s; this.cash = s.cash; this.lives = s.lives; this.round = s.round; this.active = s.roundActive;
    this.towers = new Map(s.towers.map(t => [t, { cost: t.cost, shots: t.shots + (t.magicActs ?? 0), ready: t.abilityReady }]));
    this.bloons = new Map(s.bloons.map(b => [b.id, { hp: b.hp, type: b.type }]));
    return [...cues];
  }
}

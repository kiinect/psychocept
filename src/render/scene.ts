import { spriteKey } from '../art';
import { BLOON_OVERLAYS, BLIMP_SIZE, BALLOON_IDS, BLIMP_IDS } from '../art/bloons';
import { FX_FRAMES, slug } from '../art/misc';
import type { TowerStats } from '../towers/types';
import { HEROES } from '../heroes';
import { BLOONS, type Sim, type Bloon, type Pt } from '../sim';

/** Minimal display contract: the update path can run with mock textures, without a renderer. */
export interface Visual {
  x: number; y: number; width: number; height: number; rotation: number;
  alpha: number; visible: boolean; tint: number; texture: unknown; text?: string;
}
type Factory = (text: boolean, layer: number) => Visual;
type Lookup = (key: string) => unknown;
interface Slot { sprite: Visual; overlays: Visual[]; source?: Bloon; shots: number; punch: number; key: string; tiers: number; owner?: object }
interface Transient { sprite: Visual; age: number; kind: string }
const towerIds: Record<string, string> = { wizard: 'wizard_monkey', super: 'super_monkey', ninja: 'ninja_monkey', farm: 'banana_farm', engineer: 'engineer_monkey', spike: 'spike_factory', village: 'monkey_village', beast: 'beast_handler' };
const projectileIds: Record<string, string> = { projectile: 'dart', tack: 'tack', ring: 'fireball', boomerang: 'boomerang', bomb: 'bomb', glue: 'glue', magic: 'magic', laser: 'laser', missile: 'missile', spike: 'spike', ice: 'ice', fire: 'fireball' };
const weaponIds: Record<string, string> = { tack: 'tack', ninja: 'shuriken', wizard: 'magic', super: 'plasma', alchemist: 'potion', druid: 'thorn', sniper: 'bullet', buccaneer: 'cannonball', sub: 'missile', dartling: 'bullet' };
const bloonKeys: Record<string, string> = {};
for (const id of [...BALLOON_IDS, ...BLIMP_IDS]) bloonKeys[id] = spriteKey('bloon', id);
const projKeys: Record<string, string> = {};
for (const id of ['dart', ...Object.values(projectileIds), ...Object.values(weaponIds)]) projKeys[id] = spriteKey('proj', id);
const FX_LIMIT = 256, TEXT_LIMIT = 64;

export class SceneAdapter {
  private bloons: Slot[] = [];
  private towers: Slot[] = [];
  private projectiles: Slot[] = [];
  private props: Slot[] = [];
  private hero?: Slot;
  private fx: Transient[] = [];
  private numbers: Transient[] = [];
  private effectSeen = new WeakSet<object>();
  private fxCursor = 0;
  private textCursor = 0;
  private sim?: Sim;
  private lengths: number[][] = [];
  private px = 0; private py = 0; private angle = 0;
  private cash = 0;
  private ring: Visual;
  private ghost: Visual;
  private ghostRing: Visual;
  private popFrames: unknown[];
  private boomFrames: unknown[];
  private frostFrames: unknown[];
  private splatFrames: unknown[];

  constructor(private create: Factory, private texture: Lookup) {
    this.ring = create(false, 0); this.ghostRing = create(false, 0); this.ghost = create(false, 4);
    this.ring.texture = texture('ring/sel');
    this.popFrames = this.frames('pop'); this.boomFrames = this.frames('boom');
    this.frostFrames = this.frames('frost'); this.splatFrames = this.frames('splat');
  }
  private frames(kind: string) {
    return Array.from({ length: 8 }, (_, step) => this.texture(spriteKey('fx', kind, Math.floor(step * FX_FRAMES[kind] / 8))));
  }
  private slot(pool: Slot[], i: number, layer: number, overlays = false): Slot {
    if (pool[i]) return pool[i];
    const slot: Slot = { sprite: this.create(false, layer), overlays: [], shots: 0, punch: 0, key: '', tiers: -1 };
    if (overlays) for (const id of BLOON_OVERLAYS) {
      const v = this.create(false, layer); v.texture = this.texture(spriteKey('overlay', id)); slot.overlays.push(v);
    }
    pool.push(slot); return slot;
  }
  private set(v: Visual, key: string, x: number, y: number, width: number, height = width, angle = 0) {
    v.texture = this.texture(key); v.x = x; v.y = y; v.width = width; v.height = height;
    v.rotation = angle; v.visible = true; v.alpha = 1; v.tint = 0xffffff;
  }
  private hide(pool: Slot[], start: number) {
    for (let i = start; i < pool.length; i++) {
      pool[i].sprite.visible = false;
      for (let j = 0; j < pool[i].overlays.length; j++) pool[i].overlays[j].visible = false;
    }
  }
  /** Reuses all display objects between games; no sprite destruction. */
  reset() {
    this.hide(this.bloons, 0); this.hide(this.towers, 0); this.hide(this.projectiles, 0); this.hide(this.props, 0);
    for (const slot of this.bloons) slot.source = undefined;
    for (const slot of this.towers) { slot.key = ''; slot.punch = 0; slot.shots = 0; }
    for (const f of this.fx) { f.sprite.visible = false; f.age = 1; }
    for (const f of this.numbers) { f.sprite.visible = false; f.age = 1; }
    if (this.hero) { this.hero.sprite.visible = false; this.hero.key = ''; this.hero.shots = 0; }
    this.ring.visible = this.ghost.visible = this.ghostRing.visible = false;
    this.sim = undefined; this.effectSeen = new WeakSet();
  }
  private bind(s: Sim) {
    this.reset(); this.sim = s; this.cash = s.cash;
    this.lengths = s.lanes.map(path => {
      const out = [0];
      for (let i = 1; i < path.length; i++) out.push(out[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
      return out;
    });
  }
  private position(dist: number, lane = 0) {
    const path = this.sim!.lanes[lane] ?? this.sim!.lanes[0], lengths = this.lengths[lane] ?? this.lengths[0];
    let i = 1; while (i < lengths.length - 1 && lengths[i] < dist) i++;
    const a = path[i - 1], b = path[i], t = (dist - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
    this.px = a.x + (b.x - a.x) * t; this.py = a.y + (b.y - a.y) * t;
    this.angle = Math.atan2(b.y - a.y, b.x - a.x);
  }
  private transient(pool: Transient[], text: boolean, limit: number, cursor: number): Transient {
    for (let i = 0; i < pool.length; i++) if (!pool[i].sprite.visible) return pool[i];
    if (pool.length < limit) {
      const f = { sprite: this.create(text, 3), age: 1, kind: '' }; pool.push(f); return f;
    }
    return pool[cursor % limit];
  }
  private burst(x: number, y: number, kind: string, size: number) {
    const f = this.transient(this.fx, false, FX_LIMIT, this.fxCursor++);
    f.age = 0; f.kind = kind;
    this.set(f.sprite, 'fx/pop/0', x, y, size);
  }
  private number(x: number, y: number, label: string) {
    const f = this.transient(this.numbers, true, TEXT_LIMIT, this.textCursor++);
    f.age = 0; f.sprite.x = x; f.sprite.y = y; f.sprite.text = label; f.sprite.visible = true; f.sprite.alpha = 1;
  }
  private punch(slot: Slot, shots: number, dt: number, width: number, height = width) {
    if (slot.shots !== shots) slot.punch = 0.12;
    slot.shots = shots; slot.punch = Math.max(0, slot.punch - dt);
    slot.sprite.width = width * (1 - slot.punch); slot.sprite.height = height * (1 + slot.punch);
  }
  /** After warmup: no temporary points, arrays, closures, or sprites in the entity loops. */
  update(s: Sim, dt: number, selected = -1, range = 0, motion = true) {
    if (s !== this.sim) this.bind(s);
    dt = Math.min(dt, 1);
    let popX = 480, popY = 270;
    for (let i = 0; i < this.bloons.length; i++) {
      const slot = this.bloons[i];
      if (slot.source && slot.source.hp <= 0) {
        popX = slot.sprite.x; popY = slot.sprite.y;
        this.burst(popX, popY, 'pop', 30);
        this.number(popX, popY, '+1');
      }
      slot.source = undefined;
    }
    for (let i = 0; i < s.bloons.length; i++) {
      const b = s.bloons[i], slot = this.slot(this.bloons, i, 1, true), v = slot.sprite;
      this.position(b.dist, b.lane);
      const size = BLIMP_SIZE[b.type], w = size ? size[0] * 0.55 : 18, h = size ? size[1] * 0.55 : 22;
      this.set(v, bloonKeys[b.type], this.px, this.py, w, h, size ? this.angle : 0);
      // No damaged atlas variants exist; HP drives two damage tint states.
      const maxHp = (b.fortified ? BLOONS[b.type].fortifiedHp : BLOONS[b.type].hp) * s.rules.moabHpMult;
      if (size && b.hp < maxHp * 0.35) v.tint = 0x888899;
      else if (size && b.hp < maxHp * 0.7) v.tint = 0xbabac8;
      else if ((b.frozenUntil ?? 0) > s.tick) v.tint = 0xbbeeff;
      else if (b.glue) v.tint = 0xeed34e;
      for (let j = 0; j < BLOON_OVERLAYS.length; j++) {
        const o = slot.overlays[j]; o.visible = !!b[BLOON_OVERLAYS[j]];
        o.x = v.x; o.y = v.y; o.width = w; o.height = h; o.rotation = v.rotation;
      }
      slot.source = b;
    }
    this.hide(this.bloons, s.bloons.length);
    for (let i = 0; i < s.towers.length; i++) {
      const t = s.towers[i], slot = this.slot(this.towers, i, 2);
      const code = t.tiers[0] * 100 + t.tiers[1] * 10 + t.tiers[2];
      if (slot.key !== t.type || slot.tiers !== code) { slot.sprite.texture = this.texture(spriteKey('tower', towerIds[t.type] ?? t.type, t.tiers)); slot.key = t.type; slot.tiers = code; }
      const v = slot.sprite, flying = t.type === 'ace' || t.type === 'heli';
      v.visible = true; v.x = flying ? t.flight.x : t.x; v.y = flying ? t.flight.y : t.y;
      // uncertain: only dartling's aimAngle is updated by the sim; other towers expose no current target.
      v.rotation = t.type === 'dartling' ? t.aimAngle : t.type === 'mortar' ? Math.atan2(t.targetPoint.y - t.y, t.targetPoint.x - t.x) : this.nearestAngle(t, v.x, v.y, t.aimAngle);
      v.tint = t.degree ? 0xe5b8ff : 0xffffff;
      if (slot.owner !== t) { slot.owner = t; slot.shots = t.shots; slot.punch = 0; }
      this.punch(slot, t.shots, motion ? dt : 1, 42);
    }
    this.hide(this.towers, s.towers.length);
    const chosen = s.towers[selected]; this.ring.visible = !!chosen && range > 0 && range < 1000;
    if (chosen && this.ring.visible) { this.ring.x = chosen.x; this.ring.y = chosen.y; this.ring.width = this.ring.height = range * 2; }
    if (s.hero) {
      const h = s.hero; this.hero ??= this.slot([], 0, 2);
      if (this.hero.key !== h.kind) { this.hero.sprite.texture = this.texture(spriteKey('hero', slug(HEROES[h.kind].name))); this.hero.key = h.kind; }
      const v = this.hero.sprite; v.visible = true; v.x = h.x; v.y = h.y;
      if (this.hero.owner !== h) { this.hero.owner = h; this.hero.shots = h.shots; this.hero.punch = 0; }
      // uncertain: heroes expose no aim angle; face the nearest detectable bloon within attack range.
      v.rotation = this.nearestAngle(h.stats, h.x, h.y, v.rotation); this.punch(this.hero, h.shots, motion ? dt : 1, 46);
    } else if (this.hero) this.hero.sprite.visible = false;
    for (let i = 0; i < s.darts.length; i++) {
      const d = s.darts[i], slot = this.slot(this.projectiles, i, 2);
      const id = d.kind === 'projectile' ? weaponIds[d.owner?.type ?? ''] ?? 'dart' : projectileIds[d.kind] ?? 'dart';
      this.set(slot.sprite, projKeys[id], d.x, d.y, id === 'bomb' ? 18 : 14, id === 'bomb' ? 18 : 14, Math.atan2(d.vy, d.vx));
    }
    this.hide(this.projectiles, s.darts.length);
    for (let i = 0; i < s.effects.length; i++) {
      const e = s.effects[i]; if (this.effectSeen.has(e)) continue;
      this.effectSeen.add(e); this.burst(e.x, e.y, e.kind === 'hero' ? 'pop' : e.kind === 'ice' ? 'frost' : e.kind === 'glue' ? 'splat' : 'boom', Math.max(24, e.radius * 2));
    }
    if (s.cash > this.cash) this.number(popX, popY - 10, `+$${Math.floor(s.cash - this.cash)}`);
    this.cash = s.cash;
    for (let i = 0; i < this.fx.length; i++) {
      const f = this.fx[i]; if (!f.sprite.visible) continue;
      f.age += dt; const step = Math.floor(f.age * 30 + 1e-7);
      f.sprite.visible = step < 8;
      if (step < 8) f.sprite.texture = (f.kind === 'pop' ? this.popFrames : f.kind === 'frost' ? this.frostFrames : f.kind === 'splat' ? this.splatFrames : this.boomFrames)[step];
    }
    for (let i = 0; i < this.numbers.length; i++) {
      const f = this.numbers[i]; if (!f.sprite.visible) continue;
      f.age += dt; f.sprite.visible = f.age < 0.8; f.sprite.y -= motion ? dt * 24 : 0; f.sprite.alpha = Math.max(0, 1 - f.age / 0.8);
    }
    this.updateProps(s);
  }
  private nearestAngle(stats: TowerStats, x: number, y: number, fallback: number) {
    let nearest = (stats.range + 7) ** 2, angle = fallback;
    const s = this.sim!;
    for (let i = 0; i < s.bloons.length; i++) {
      const b = s.bloons[i];
      if ((b.camo || b.type === 'ddt' && b.camo !== false) && !stats.camo) continue;
      if (!stats.universal && BLOONS[b.type].immunities.includes(stats.damageType) && !stats.lead && (b.brittleUntil ?? 0) <= s.tick) continue;
      if ((b.frozenUntil ?? 0) > s.tick && !stats.frozen && !stats.refreeze && !stats.universal && (b.brittleUntil ?? 0) <= s.tick) continue;
      if (BLIMP_SIZE[b.type] && !stats.moabTargetable) continue;
      const p = this.bloons[i].sprite, dx = p.x - x, dy = p.y - y, d = dx * dx + dy * dy;
      if (d < nearest) { nearest = d; angle = Math.atan2(dy, dx); }
    }
    return angle;
  }
  private updateProps(s: Sim) {
    let i = 0;
    for (let j = 0; j < s.collectibles.length; j++) { const b = s.collectibles[j]; this.set(this.slot(this.props, i++, 2).sprite, 'proj/banana', b.x, b.y, 20); }
    for (let j = 0; j < s.roadItems.length; j++) {
      const item = s.roadItems[j]; const point = s.posAt(item.dist, item.lane);
      this.set(this.slot(this.props, i++, 2).sprite, item.kind === 'foam' ? 'fx/splat/0' : item.kind === 'trap' ? 'tower/engineer_monkey' : 'proj/spike', point.x, point.y, 20);
    }
    for (let j = 0; j < s.sentries.length; j++) { const t = s.sentries[j]; this.set(this.slot(this.props, i++, 2).sprite, 'tower/engineer_monkey', t.x, t.y, 24); }
    if (s.hero) {
      for (let j = 0; j < s.hero.assets.length; j++) { const a = s.hero.assets[j]; if (!a.tower) this.set(this.slot(this.props, i++, 2).sprite, 'proj/spike', a.x, a.y, 18); }
      for (let j = 0; j < s.hero.zones.length; j++) { const z = s.hero.zones[j]; this.set(this.slot(this.props, i++, 0).sprite, 'ring/ok', z.point.x, z.point.y, 24); }
    }
    this.hide(this.props, i);
  }
  placement(kind: 'tower' | 'hero', id: string, point: Pt | null, range: number, valid: boolean) {
    this.ghost.visible = this.ghostRing.visible = !!point;
    if (!point) return;
    this.set(this.ghost, spriteKey(kind, kind === 'tower' ? towerIds[id] ?? id : slug(HEROES[id as keyof typeof HEROES].name)), point.x, point.y, 42);
    this.ghost.alpha = 0.65; this.ghost.tint = valid ? 0xffffff : 0xff5555;
    this.set(this.ghostRing, valid ? 'ring/ok' : 'ring/bad', point.x, point.y, Math.min(range, 1000) * 2);
  }
}

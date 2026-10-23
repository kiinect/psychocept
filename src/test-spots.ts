// Test helper: real maps use the game's layout, so tests ask for valid spots instead of hardcoding coordinates.
import type { Pt, Sim } from './sim';
import { TOWERS, type TowerKind } from './towers';

/** Up to n valid, non-overlapping placement spots for `type`, closest to `near` first (grid scan, 3-unit step). */
export function spots(s: Sim, type: TowerKind = 'dart', n = 1, near?: Pt, ok: (p: Pt) => boolean = () => true): Pt[] {
  const r = TOWERS[type].footprint, out: Pt[] = [], cands: Pt[] = [];
  for (let y = r; y <= s.height - r; y += 3) for (let x = r; x <= s.width - r; x += 3) cands.push({ x, y });
  if (near) cands.sort((a, b) => Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y));
  for (const p of cands) {
    if (out.length >= n) break;
    if (s.canPlace(p.x, p.y, type) && ok(p) && out.every(q => Math.hypot(q.x - p.x, q.y - p.y) >= 2 * r + 1)) out.push(p);
  }
  if (out.length < n) throw new Error(`only ${out.length}/${n} spots for ${type}`);
  return out;
}

// Rounds past 140: randomized content (seeded per round, so deterministic). Self-contained: no sim import.
interface G { type: string; count: number; camo?: boolean; regrow?: boolean; fortified?: boolean }
function rng(seed: number) {
  let a = seed * 2654435761 >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// uncertain: wiki only says "randomized content/order"; this is an original approximation, not the real table.
export function endlessGroups(r: number, rounds: { groups: G[] }[]) {
  if (r <= 140 || !rounds.length) return [];
  const rand = rng(r), late = r - 140, groups: (G & { n: number; gap: number })[] = [];
  const picks = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < picks; i++) {
    const src = rounds[60 + Math.floor(rand() * (rounds.length - 60))];
    for (const g of src.groups) {
      const big = ['moab', 'bfb', 'zomg', 'ddt', 'bad'].includes(g.type);
      const count = Math.max(1, Math.round(g.count * (big ? 0.5 + late / 120 : 1 + late / 40) * (0.6 + rand() * 0.6)));
      groups.push({ ...g, count, n: count, gap: big ? 0.8 : 0.12, camo: g.camo || rand() < 0.4, regrow: g.regrow || rand() < 0.3, fortified: g.fortified || rand() < Math.min(0.6, 0.2 + late / 200) });
    }
  }
  return groups;
}

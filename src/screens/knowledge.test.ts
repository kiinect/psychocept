import { expect, test } from 'vitest';
import { treeLayout } from './knowledge';
import { treeKnowledge } from '../meta';
import { TREES } from '../knowledge';

test('every knowledge tree lays out without overlapping nodes, every child sits below its prerequisites', () => {
  for (const t of TREES) {
    const { pos, tiers } = treeLayout(t), names = treeKnowledge(t).map(k => k.name);
    expect(Object.keys(pos)).toHaveLength(names.length);
    const seen = new Set(names.map(n => `${pos[n].x},${pos[n].y}`)); expect(seen.size).toBe(names.length);
    for (const k of treeKnowledge(t)) for (const q of k.prereq) if (pos[q]) expect(pos[q].y, `${k.name} below ${q}`).toBeLessThan(pos[k.name].y);
    expect(tiers.length).toBeGreaterThan(1);
  }
});

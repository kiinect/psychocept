import { expect, it } from 'vitest';
import { upgradeDescription } from './upgrade';
import { baseStats } from '../towers/types';
it('describes actual numeric, detection and special-effect changes', () => {
  const before = baseStats({});
  expect(upgradeDescription(before, baseStats({ damage: 3, camo: true }))).toBe('Damage: 3 · Camo detection: yes');
  expect(upgradeDescription(before, baseStats({ soak: 8 }))).toBe('soak: 8');
});

import { upgradeRowState } from './upgrade';
import { canUpgrade } from '../towers';
it('upgrade rows: path closed only when nothing bought, capped paths show max upgrades', () => {
  const tiers: [number, number, number] = [5, 0, 2];
  expect([0, 1, 2].map(p => upgradeRowState(tiers[p], tiers[p] < 5, canUpgrade(tiers, p)))).toEqual(['capped', 'closed', 'capped']);
  expect(upgradeRowState(0, true, true)).toBe('buy');
});

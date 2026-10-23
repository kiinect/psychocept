import { expect, it } from 'vitest';
import { upgradeDescription } from './upgrade';
import { baseStats } from '../towers/types';
it('describes actual numeric, detection and special-effect changes', () => {
  const before = baseStats({});
  expect(upgradeDescription(before, baseStats({ damage: 3, camo: true }))).toBe('Damage: 3 · Camo detection: yes');
  expect(upgradeDescription(before, baseStats({ soak: 8 }))).toBe('soak: 8');
});

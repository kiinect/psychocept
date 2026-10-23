import { expect, it } from 'vitest';
import { memoryKV, slot } from './store';
import { saveCodecs } from './save-codecs';

it('decodes migrated envelopes without changing the local slot', () => {
  const kv = memoryKV(), s = slot('test', [(d: any) => ({ n: d.old })], () => ({ n: 0 }), d => ({ n: d.n }), kv);
  expect(s.decode({ v: 1, data: { old: 7 } })).toEqual({ v: 2, data: { n: 7 } });
  expect(s.load()).toEqual({ n: 0 });
  expect(s.decode({ v: 99, data: {} })).toBeNull();
});

it('rejects malformed cloud progress instead of normalizing it into an empty profile', () => {
  expect(saveCodecs['mpt.profile'].decode({ v: 2, data: 'bad' })).toBeNull();
  expect(saveCodecs['mpt.profile'].decode({ v: 2, data: { xp: 'lots', mm: 2 } })).toBeNull();
  expect(saveCodecs['mpt.run'].decode({ v: 1, data: { map: 'missing', towers: [], difficulty: 'easy' } })).toBeNull();
});

it('accepts legacy profiles and validates settings and Continue bookkeeping', () => {
  expect(saveCodecs['mpt.profile'].decode({ v: 1, data: { xp: 5, rank: 1, money: 12 } })?.data).toMatchObject({ xp: 5, mm: 12 });
  expect(saveCodecs['mpt.settings'].decode({ v: 1, data: { volume: 10 } })).toBeNull();
  expect(saveCodecs['mpt.run.ui'].decode({ v: 1, data: { mode: 'easy', hero: 'unknown', savedAt: 2, rewardedRound: 1, recorded: false } })).toBeNull();
});

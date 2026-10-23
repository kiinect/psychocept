import { describe, expect, it } from 'vitest';
import { initialFlow, transition } from './flow';
import { priceBadge, upgradeState } from './state';

describe('screen flow', () => {
  it('takes the complete setup path and preserves selections on back', () => {
    let s = initialFlow('');
    expect(s.screen).toBe('splash');
    s = transition(s, { type: 'start' }); expect(s.screen).toBe('menu');
    s = transition(s, { type: 'play' }); expect(s.screen).toBe('maps');
    s = transition(s, { type: 'map', id: 'monkey_meadow' }); expect(s.screen).toBe('difficulty');
    s = transition(s, { type: 'difficulty', id: 'hard' }); expect(s.screen).toBe('modes');
    s = transition(s, { type: 'mode', id: 'hard' }); expect(s.screen).toBe('hero');
    s = transition(s, { type: 'hero', id: 'quincy' }); expect(s.screen).toBe('game');
    expect(s).toMatchObject({ map: 'monkey_meadow', mode: 'hard', hero: 'quincy' });
    s = transition(s, { type: 'pause' }); expect(s.screen).toBe('pause');
    s = transition(s, { type: 'settings' }); expect(s.screen).toBe('settings');
    s = transition(s, { type: 'back' }); expect(s.screen).toBe('pause');
    s = transition(s, { type: 'back' }); expect(s.screen).toBe('game');
    for (const result of ['victory', 'defeat'] as const) {
      const end = transition(s, { type: result });
      expect(end.screen).toBe(result);
      expect(transition(end, { type: 'restart' }).screen).toBe('game');
      expect(transition(end, { type: 'home' }).screen).toBe('menu');
      expect(transition(end, { type: 'back' }).screen).toBe('menu');
      expect(transition(end, { type: 'continue' }).screen).toBe(result === 'victory' ? 'game' : 'defeat');
    }
  });
  it.each([['hero','modes'], ['modes','difficulty'], ['difficulty','maps'], ['maps','menu'], ['menu','splash'], ['heroes','menu'], ['pause','game'], ['game','pause'], ['splash','splash']] as const)('backs from %s to %s', (screen, expected) => {
    expect(transition({ ...initialFlow(''), screen }, { type: 'back' }).screen).toBe(expected);
  });
  it('opens heroes and settings from the menu and resumes or restarts a paused game', () => {
    const menu = transition(initialFlow(''), { type: 'start' });
    expect(transition(menu, { type: 'heroes' }).screen).toBe('heroes');
    expect(transition(transition(menu, { type: 'settings' }), { type: 'back' }).screen).toBe('menu');
    const pause = transition(initialFlow('?map=monkey_meadow&mode=easy'), { type: 'pause' });
    for (const type of ['resume', 'restart'] as const) expect(transition(pause, { type }).screen).toBe('game');
    expect(transition(pause, { type: 'home' }).screen).toBe('menu');
  });
  it('supports URL shortcuts and normalises unknown ids', () => {
    expect(initialFlow('?map=monkey_meadow&mode=hard')).toMatchObject({ screen: 'game', map: 'monkey_meadow', mode: 'hard', difficulty: 'hard' });
    expect(initialFlow('?map=bad&mode=bad')).toMatchObject({ screen: 'game', map: 'monkey_meadow', mode: 'medium' });
    expect(initialFlow('?mode=easy').screen).toBe('splash');
  });
  it('ignores invalid and out-of-order selections', () => {
    const s = initialFlow('');
    expect(transition(s, { type: 'mode', id: 'hard' })).toEqual(s);
    const modes = { ...s, screen: 'modes' as const, difficulty: 'easy' as const };
    expect(transition(modes, { type: 'mode', id: 'hard' })).toEqual(modes);
    expect(transition(modes, { type: 'mode', id: 'sandbox' }).screen).toBe('hero');
  });
});

describe('shop and upgrade states without a DOM', () => {
  it('disables unaffordable prices and distinguishes a closed shop', () => {
    expect(priceBadge(100, 99)).toEqual({ disabled: true, unaffordable: true, label: '$100 · Need $1' });
    expect(priceBadge(100, 100).disabled).toBe(false);
    expect(priceBadge(100, 100, true)).toMatchObject({ disabled: true, unaffordable: false });
  });
  it('distinguishes crosspath locks, max tiers, funds and game over', () => {
    expect(upgradeState(true, false, 100, 100).reason).toBe('Locked');
    expect(upgradeState(false, false, 0, 100).reason).toBe('Max tier');
    expect(upgradeState(true, true, 200, 100).reason).toBe('Need $100');
    expect(upgradeState(true, true, 100, 100)).toEqual({ disabled: false, reason: '' });
    expect(upgradeState(true, true, 100, 100, true).disabled).toBe(true);
  });
});

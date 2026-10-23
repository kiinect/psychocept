import { MAPS } from '../maps/maps';
import { MODES, modeById } from '../modes/modes';
import { HEROES, type HeroKind } from '../heroes';
import type { Difficulty } from '../sim';

export type Screen = 'splash' | 'menu' | 'maps' | 'difficulty' | 'modes' | 'hero' | 'heroes' | 'powers' | 'game' | 'pause' | 'settings' | 'victory' | 'defeat';
export interface Flow {
  screen: Screen; map: string; mode: string; difficulty: Difficulty; hero: HeroKind;
  settingsBack: 'menu' | 'pause';
}
export type FlowEvent = { type: 'start' | 'play' | 'heroes' | 'settings' | 'back' | 'pause' | 'resume' | 'restart' | 'home' | 'victory' | 'defeat' | 'continue' | 'powers' | 'loadRun' }
  | { type: 'map' | 'mode'; id: string } | { type: 'difficulty'; id: Difficulty } | { type: 'hero'; id: HeroKind };
export function initialFlow(search: string): Flow {
  const q = new URLSearchParams(search), mode = modeById(q.get('mode') ?? 'medium');
  return { screen: q.has('map') ? 'game' : 'splash', map: MAPS[q.get('map') ?? '']?.id ?? 'monkey_meadow',
    mode: mode.id, difficulty: mode.difficulty, hero: 'quincy', settingsBack: 'menu' };
}
export function transition(s: Flow, e: FlowEvent): Flow {
  const go = (screen: Screen): Flow => ({ ...s, screen });
  switch (e.type) {
    case 'start': return s.screen === 'splash' ? go('menu') : s;
    case 'play': return s.screen === 'menu' ? go('maps') : s;
    case 'loadRun': return s.screen === 'menu' ? go('game') : s;
    case 'powers': return s.screen === 'menu' ? go('powers') : s;
    case 'heroes': return s.screen === 'menu' ? go('heroes') : s;
    case 'map': return s.screen === 'maps' && MAPS[e.id] ? { ...s, map: e.id, screen: 'difficulty' } : s;
    case 'difficulty': return s.screen === 'difficulty' && ['easy', 'medium', 'hard', 'impoppable'].includes(e.id) ? { ...s, difficulty: e.id, screen: 'modes' } : s;
    case 'mode': return s.screen === 'modes' && MODES.some(m => m.id === e.id && (m.difficulty === s.difficulty || m.sandbox)) ? { ...s, mode: e.id, screen: 'hero' } : s;
    case 'hero': return s.screen === 'hero' && HEROES[e.id] ? { ...s, hero: e.id, screen: 'game' } : s;
    case 'pause': return s.screen === 'game' ? go('pause') : s;
    case 'settings': return s.screen === 'menu' || s.screen === 'pause' ? { ...s, screen: 'settings', settingsBack: s.screen } : s;
    case 'resume': return s.screen === 'pause' ? go('game') : s;
    case 'restart': return ['pause', 'victory', 'defeat'].includes(s.screen) ? go('game') : s;
    case 'continue': return s.screen === 'victory' ? go('game') : s;
    case 'home': return go('menu');
    case 'victory': case 'defeat': return s.screen === 'game' ? go(e.type) : s;
    case 'back': {
      const back: Record<Screen, Screen> = { splash: 'splash', menu: 'splash', maps: 'menu', difficulty: 'maps', modes: 'difficulty', hero: 'modes', heroes: 'menu', powers: 'menu', game: 'pause', pause: 'game', settings: s.settingsBack, victory: 'menu', defeat: 'menu' };
      return go(back[s.screen]);
    }
  }
}

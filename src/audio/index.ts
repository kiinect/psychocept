import { ROUNDS, type Sim } from '../sim';
import { AudioObserver } from './observe';
import { readSettings, SETTINGS_KEY } from './settings';
import { Synth, type MusicMode } from './synth';

const observer = new AudioObserver();
let synth: Synth | undefined;
let context: AudioContext | undefined;
let mounted = false;
let music: MusicMode = 'menu';
let settings = readSettings(null);
function persist() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Private browsing may disallow storage. */ }
  synth?.settings(settings);
}
function mount() {
  mounted = true;
  try { settings = readSettings(localStorage.getItem(SETTINGS_KEY)); } catch { /* Retain defaults. */ }
  const panel = document.createElement('fieldset');
  panel.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:12px;padding:10px;max-width:100%;box-sizing:border-box';
  const legend = document.createElement('legend'); legend.textContent = 'Audio'; panel.append(legend);
  for (const [key, title] of [['sfx', 'Sound effects'], ['music', 'Music']] as const) {
    const label = document.createElement('label'), input = document.createElement('input');
    label.textContent = `${title} `; input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '1';
    input.value = String(Math.round(settings[key] * 100)); input.setAttribute('aria-label', `${title} volume`);
    input.style.maxWidth = '140px';
    input.addEventListener('input', () => { settings[key] = Number(input.value) / 100; persist(); });
    label.append(input); panel.append(label);
  }
  const label = document.createElement('label'), mute = document.createElement('input');
  mute.type = 'checkbox'; mute.checked = settings.muted;
  mute.addEventListener('change', () => { settings.muted = mute.checked; persist(); });
  label.append(mute, ' Mute audio'); panel.append(label);
  (document.querySelector('aside') ?? document.body).append(panel);
  if (!window.AudioContext) {
    const note = document.createElement('span'); note.textContent = 'Audio unavailable in this browser.'; panel.append(note);
    panel.disabled = true; return;
  }
  // Browser autoplay policy: create/resume only after a trusted user gesture.
  const unlock = () => {
    try {
      context ??= new AudioContext();
      synth ??= new Synth(context);
      synth.settings(settings);
      void context.resume().then(() => synth?.setMusic(music)).catch(() => { /* Retry on the next gesture. */ });
    } catch { /* Unsupported or unavailable audio device; game continues. */ }
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { void context?.suspend().catch(() => {}); }
    else if (context) { void context.resume().catch(() => {}); }
  });
}
/** The sole integration hook: call once after stepping the simulation each frame. */
export function initAudio(sim: Sim) {
  if (typeof document === 'undefined') return;
  if (!mounted) mount();
  const cues = observer.update(sim);
  music = sim.gameOver || (!sim.roundActive && sim.round >= ROUNDS.length) ? 'silent'
    : sim.roundActive || sim.round > (sim.difficulty === 'impoppable' ? 5 : 0) ? 'game' : 'menu';
  if (!document.hidden) {
    synth?.setMusic(music);
    for (const cue of cues) synth?.play(cue);
  }
}

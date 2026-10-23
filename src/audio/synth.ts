import type { Cue } from './observe';
import type { Settings } from './settings';
// Original oscillator patches; no recordings or external audio assets.
export const PATCHES: Record<Cue, readonly [number, number, number, OscillatorType]> = {
  pop: [680, 160, 0.055, 'sine'], ceramic: [1700, 120, 0.11, 'triangle'],
  placement: [240, 480, 0.12, 'sine'], upgrade: [440, 880, 0.2, 'triangle'],
  sell: [720, 280, 0.16, 'sine'], ability: [180, 1440, 0.35, 'sawtooth'],
  roundStart: [330, 660, 0.28, 'triangle'], roundEnd: [660, 990, 0.3, 'sine'],
  defeat: [300, 65, 0.8, 'triangle'], victory: [523, 1046, 0.7, 'triangle'],
  'attack:dart': [900, 350, 0.045, 'triangle'], 'attack:boomerang': [400, 800, 0.09, 'sine'],
  'attack:bomb': [120, 35, 0.18, 'sawtooth'], 'attack:tack': [1300, 600, 0.035, 'square'],
  'attack:ice': [2200, 900, 0.13, 'sine'], 'attack:glue': [250, 90, 0.1, 'triangle'],
};
export type MusicMode = 'menu' | 'game' | 'silent';
// Two original eight-bar patterns, 16 seconds each. All pitches are synthesized.
export function musicNotes(mode: Exclude<MusicMode, 'silent'>) {
  const melody = mode === 'menu' ? [0, 4, 7, 11, 7, 4, 2, 7, 5, 9, 12, 9, 7, 4, 2, 4]
    : [0, 7, 3, 10, 7, 3, 5, 10, 8, 3, 7, 10, 5, 2, 7, 2];
  return melody.flatMap((note, i) => [
    { at: i, hz: 261.6256 * 2 ** (note / 12), duration: 0.55, gain: 0.09 },
    { at: i + 0.5, hz: 65.4064 * 2 ** ([0, 0, 5, 7][Math.floor(i / 4)] / 12), duration: 0.35, gain: 0.12 },
  ]);
}
export class Synth {
  private sfx: GainNode;
  private music: GainNode;
  private loop?: AudioBufferSourceNode;
  private mode: MusicMode = 'silent';
  private last = new Map<Cue, number>();
  private budgetAt = 0;
  private voices = 0;
  constructor(private ctx: AudioContext) {
    this.sfx = ctx.createGain(); this.music = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    this.sfx.connect(limiter); this.music.connect(limiter); limiter.connect(ctx.destination);
  }
  settings(s: Settings) {
    this.sfx.gain.setTargetAtTime(s.muted ? 0 : s.sfx * 0.25, this.ctx.currentTime, 0.02);
    this.music.gain.setTargetAtTime(s.muted ? 0 : s.music, this.ctx.currentTime, 0.02);
  }
  play(cue: Cue) {
    const now = this.ctx.currentTime;
    if (this.ctx.state !== 'running' || now - (this.last.get(cue) ?? -1) < 0.045) return;
    if (now - this.budgetAt >= 0.05) { this.budgetAt = now; this.voices = 0; }
    if (this.voices++ >= 12) return;
    this.last.set(cue, now);
    const [start, end, duration, wave] = PATCHES[cue];
    const oscillator = this.ctx.createOscillator(), gain = this.ctx.createGain();
    oscillator.type = wave; oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.25, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain); gain.connect(this.sfx);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now); oscillator.stop(now + duration + 0.01);
  }
  setMusic(mode: MusicMode) {
    if (mode === this.mode) return;
    this.loop?.stop(); this.loop?.disconnect(); this.loop = undefined; this.mode = mode;
    if (mode === 'silent') return;
    const rate = this.ctx.sampleRate, buffer = this.ctx.createBuffer(1, rate * 16, rate);
    const samples = buffer.getChannelData(0);
    for (const note of musicNotes(mode)) {
      const length = Math.floor(note.duration * rate), offset = Math.floor(note.at * rate);
      for (let i = 0; i < length; i++) {
        const t = i / rate, envelope = Math.min(1, t / 0.015) * (1 - i / length) ** 2;
        samples[offset + i] += Math.sin(2 * Math.PI * note.hz * t) * envelope * note.gain;
      }
    }
    this.loop = this.ctx.createBufferSource(); this.loop.buffer = buffer; this.loop.loop = true;
    this.loop.connect(this.music); this.loop.start();
  }
}

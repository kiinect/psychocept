import { expect, test } from 'vitest';
import { Synth, PATCHES, musicNotes } from './synth';
import type { Cue } from './observe';

// WebAudio boundary fake: records scheduling while using real PCM music generation.
function audioDevice() {
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime(value: number) { this.value = value; }, value: 0 });
  const node = () => ({ connect() {}, disconnect() {} });
  const oscillators: { started: number; stopped: number }[] = [];
  const sources: { loop: boolean; buffer: unknown; stopped: boolean }[] = [];
  const gains: ReturnType<typeof param>[] = [];
  const buffers: Float32Array[] = [];
  const ctx = {
    currentTime: 1, state: 'running', sampleRate: 8000, destination: node(),
    createGain() { const gain = param(); gains.push(gain); return { ...node(), gain }; },
    createDynamicsCompressor: node,
    createOscillator() {
      const record = { started: -1, stopped: -1 }; oscillators.push(record);
      return { ...node(), frequency: param(), type: '', onended: null,
        start(at: number) { record.started = at; }, stop(at: number) { record.stopped = at; } };
    },
    createBuffer(_channels: number, length: number) {
      const samples = new Float32Array(length); buffers.push(samples); return { getChannelData: () => samples };
    },
    createBufferSource() {
      const record = { loop: false, buffer: undefined as unknown, stopped: false }; sources.push(record);
      return Object.assign(record, node(), { start() {}, stop() { record.stopped = true; } });
    },
  };
  return { ctx, synth: new Synth(ctx as unknown as AudioContext), oscillators, sources, gains, buffers };
}
test('every effect schedules a finite WebAudio voice, with bounded rapid repeats', () => {
  const { ctx, synth, oscillators } = audioDevice();
  for (const cue of Object.keys(PATCHES) as Cue[]) { synth.play(cue); ctx.currentTime++; }
  expect(oscillators).toHaveLength(Object.keys(PATCHES).length);
  for (const voice of oscillators) expect(voice.stopped).toBeGreaterThan(voice.started);
  synth.play('pop'); synth.play('pop');
  expect(oscillators).toHaveLength(Object.keys(PATCHES).length + 1);
  ctx.state = 'suspended'; ctx.currentTime++; synth.play('pop');
  expect(oscillators).toHaveLength(Object.keys(PATCHES).length + 1);
});
test('menu and game music generate distinct seamless looping PCM tracks and stop on terminal states', () => {
  const { synth, sources, buffers } = audioDevice();
  synth.setMusic('menu'); synth.setMusic('menu'); expect(sources).toHaveLength(1);
  synth.setMusic('game'); expect(sources[0].stopped).toBe(true); expect(sources[1].loop).toBe(true);
  expect(buffers[0]).not.toEqual(buffers[1]);
  for (const samples of buffers) {
    expect(samples.some(n => n !== 0)).toBe(true);
    expect(samples[0]).toBe(0); expect(samples.at(-1)).toBe(0);
    expect(samples.every(n => Number.isFinite(n) && Math.abs(n) < 1)).toBe(true);
  }
  expect(musicNotes('menu')).toHaveLength(32);
  synth.setMusic('silent'); expect(sources[1].stopped).toBe(true);
});
test('mute and both independent volumes reach the output buses', () => {
  const { synth, gains } = audioDevice();
  synth.settings({ sfx: 0.8, music: 0.4, muted: false });
  expect(gains.map(g => g.value)).toEqual([0.2, 0.4]);
  synth.settings({ sfx: 0.8, music: 0.4, muted: true }); expect(gains.map(g => g.value)).toEqual([0, 0]);
});

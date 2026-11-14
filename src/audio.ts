// Sound: started on first input, mute on M. Every effect is synthesized with Web Audio.
import { audioContext } from './hook';
import { tune } from './config';

let audio: { ac: AudioContext; out: GainNode; noise: AudioBuffer } | null = null;
/** True while the sound is off. */
export let muted = false;
/** Starts the sound on the first input (browsers allow it only then). */
export function startAudio(): void {
  try {
    if (!audio) {
      const ac = audioContext(); // a check may inject one
      const out = ac.createGain(); out.gain.value = muted ? 0 : tune.volume;
      out.connect(ac.destination);
      const nb = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate), d = nb.getChannelData(0);
      let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
      audio = { ac, out, noise: nb };
    }
    if (audio.ac.state === 'suspended') audio.ac.resume();
  } catch (_) {}
}
/** Turns the sound off or on. */
export function setMuted(m: boolean): void { muted = m; if (audio) audio.out.gain.value = m ? 0 : tune.volume; }
addEventListener('tune', () => setMuted(muted));
function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.3, slide = 0): void {
  if (!audio || muted) return;
  const t = audio.ac.currentTime, o = audio.ac.createOscillator(), g = audio.ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(audio.out); o.start(t); o.stop(t + dur);
}
function noise(dur: number, vol: number, freq: number, q = 1): void {
  if (!audio || muted) return;
  const t = audio.ac.currentTime, src = audio.ac.createBufferSource(), f = audio.ac.createBiquadFilter(), g = audio.ac.createGain();
  src.buffer = audio.noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(audio.out); src.start(t); src.stop(t + dur);
}
const semis = (n: number): number => Math.pow(2, n / 12);
/** Every sound effect, synthesized. */
export const sfx = {
  tension(p: number) { tone(180 + p * 380, 0.09, 'sawtooth', 0.035); },
  splash() { noise(0.3, 0.35, 1100, 0.8); tone(420, 0.12, 'sine', 0.12, 0.5); },
  clack(i: number) { tone(520 * semis(Math.min(i, 24)), 0.06, 'triangle', 0.18); },
  drop(i: number) { tone(360 * semis(Math.min(i, 18)), 0.05, 'triangle', 0.12); },
  coin(i: number) { tone(1100 * semis(Math.min(i, 30) * 0.5), 0.05, 'square', 0.05); },
  pay(i: number) { tone(700 * semis(Math.min(i, 30) * 0.4), 0.04, 'square', 0.05); },
  bell() { tone(880, 0.9, 'sine', 0.28); tone(1320, 0.7, 'sine', 0.18); tone(1760, 0.5, 'sine', 0.1); },
  cheer() { noise(0.45, 0.12, 1600, 0.6); tone(660, 0.12, 'triangle', 0.06, 1.3); },
  puff() { noise(0.12, 0.06, 700, 1); },
  chop() { noise(0.05, 0.08, 2600, 2); },
  golden() { [0, 4, 7, 12].forEach((s, i) => setTimeout(() => tone(660 * semis(s), 0.25, 'triangle', 0.14), i * 90)); },
};

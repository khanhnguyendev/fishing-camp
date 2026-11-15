// Sound: started on first input, mute on M. Every effect is synthesized with Web Audio.
import { audioContext } from './hook';
import { tune } from './config';
import { composeLoop, loopSeconds, THEMES, type Note } from './game/music';

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
  horn() { [0, 0, 7, 12].forEach((s, i) => setTimeout(() => tone(220 * semis(s), 0.32, 'sawtooth', 0.09), i * 160)); },
  golden() { [0, 4, 7, 12].forEach((s, i) => setTimeout(() => tone(660 * semis(s), 0.25, 'triangle', 0.14), i * 90)); },
};

// ---- Music: one loop per zone (src/game/music.ts writes the notes), scheduled a moment ahead ----
const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const LOOPS: Note[][] = [];
let music: { zone: number; gain: GainNode; notes: Note[]; start: number; next: number; spb: number; len: number } | null = null;

/** Plays one note of the music on its instrument, at audio time `at`, into the music's gain. */
function playNote(n: Note, at: number, dur: number, dest: GainNode): void {
  if (!audio) return;
  const ac = audio.ac, noiseBuf = audio.noise;
  const env = (peak: number, attack: number, end: number): GainNode => {
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end); g.connect(dest); return g;
  };
  const osc = (type: OscillatorType, hz: number, g: GainNode, end: number): OscillatorNode => {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(hz, at); o.connect(g); o.start(at); o.stop(end + 0.05); return o;
  };
  const hit = (freq: number, q: number, peak: number, len: number): void => {
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(); src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    src.connect(f).connect(env(peak, 0.003, at + len)); src.start(at); src.stop(at + len + 0.05);
  };
  if (n.voice === 'pluck') { // a koto-like pluck: bright attack, quick fade, a quiet octave above
    const end = at + Math.max(0.35, dur * 1.2);
    osc('triangle', midiHz(n.midi), env(0.2, 0.005, end), end); osc('sine', midiHz(n.midi + 12), env(0.05, 0.005, end - 0.15), end);
  } else if (n.voice === 'flute') { // a bamboo flute: soft attack, held, with vibrato
    const end = at + dur + 0.12, o = osc('sine', midiHz(n.midi), env(0.14, 0.06, end), end);
    const lfo = ac.createOscillator(), depth = ac.createGain(); lfo.frequency.value = 5.5; depth.gain.value = midiHz(n.midi) * 0.012;
    lfo.connect(depth).connect(o.frequency); lfo.start(at); lfo.stop(end + 0.05);
  } else if (n.voice === 'bass') {
    const end = at + dur; osc('sine', midiHz(n.midi), env(0.16, 0.01, end), end);
  } else if (n.voice === 'taiko') { // a deep drum: a falling boom and a skin slap
    const end = at + 0.45, o = osc('sine', 110, env(0.45, 0.004, end), end); o.frequency.exponentialRampToValueAtTime(42, at + 0.25);
    hit(180, 1, 0.2, 0.15);
  } else hit(3200, 3, 0.04, 0.04); // rim click
}

/**
 * Keeps the music for a zone playing (0 dock, 1 grill yard, 2 rice field): call it every step. It schedules
 * the next notes a moment ahead on the audio clock and crossfades to a new loop when the zone changes.
 */
export function musicTick(zone: number): void {
  if (!audio || audio.ac.state !== 'running') return;
  const ac = audio.ac, now = ac.currentTime;
  if (!music || music.zone !== zone) {
    if (music) { const old = music.gain; old.gain.setTargetAtTime(0.0001, now, 0.4); setTimeout(() => old.disconnect(), 3000); }
    const gain = ac.createGain(); gain.gain.setValueAtTime(0.0001, now); gain.connect(audio.out);
    const t = THEMES[zone]; LOOPS[zone] ||= composeLoop(zone);
    music = { zone, gain, notes: LOOPS[zone], start: now + 0.1, next: 0, spb: 60 / t.bpm, len: loopSeconds(t) };
  }
  music.gain.gain.setTargetAtTime(Math.max(0.0001, tune.music_volume), now, 0.4);
  if (music.start + music.len < now - 1) { music.start = now + 0.1; music.next = 0; } // back from a paused tab: start the loop over
  for (let guard = 0; guard < 400; guard++) {
    const n = music.notes[music.next], at = music.start + n.beat * music.spb;
    if (at > now + 0.35) break;
    if (at >= now - 0.05) playNote(n, at, n.dur * music.spb, music.gain);
    music.next++;
    if (music.next >= music.notes.length) { music.next = 0; music.start += music.len; }
  }
}

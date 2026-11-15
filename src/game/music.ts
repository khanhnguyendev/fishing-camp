// Fishing Camp's music, composed in code: one 60-90 s loop per zone (GDD 8), from a fixed seed so it is
// the same every time. No browser in here: src/audio.ts plays the notes this module writes.

/** The instruments the player in src/audio.ts knows. */
export type Voice = 'pluck' | 'flute' | 'bass' | 'taiko' | 'rim';

/** One note of a loop: when (in beats from the loop's start), how long, which pitch (MIDI) and instrument. */
export interface Note {
  beat: number;
  dur: number;
  midi: number;
  voice: Voice;
}

/** A zone's tune: its tempo, key, scale and lead instrument, and how many 4-beat bars the loop runs. */
export interface Theme {
  name: string;
  bpm: number;
  /** The key's root note (MIDI). */
  root: number;
  /** Scale steps above the root, in semitones. */
  scale: number[];
  lead: 'pluck' | 'flute';
  bars: number;
  /** Taiko on beat 3 as well as beat 1. */
  busyDrums: boolean;
}

/** Zone 1 (dock), zone 2 (grill yard), zone 3 (rice field), zone 4 (great hearth). */
export const THEMES: Theme[] = [
  { name: 'dock', bpm: 104, root: 62, scale: [0, 2, 4, 7, 9], lead: 'pluck', bars: 28, busyDrums: false }, // D major pentatonic
  { name: 'grill yard', bpm: 116, root: 57, scale: [0, 3, 5, 7, 10], lead: 'pluck', bars: 32, busyDrums: true }, // A minor pentatonic
  { name: 'rice field', bpm: 90, root: 55, scale: [0, 2, 5, 7, 9], lead: 'flute', bars: 24, busyDrums: false }, // G yo scale
  { name: 'great hearth', bpm: 80, root: 52, scale: [0, 2, 3, 7, 8], lead: 'flute', bars: 24, busyDrums: true }, // E in-scale (miyako-bushi): wintry
];

/** The loop's length in seconds. */
export function loopSeconds(t: Theme): number {
  return t.bars * 4 * 60 / t.bpm;
}

/** MIDI pitch of a scale degree (degree 0 is the root; negative and > scale length wrap into octaves). */
export function degreeToMidi(t: Theme, degree: number): number {
  const n = t.scale.length, oct = Math.floor(degree / n), step = ((degree % n) + n) % n;
  return t.root + 12 * oct + t.scale[step];
}

/** A small fixed-seed generator, separate from the game's rng() so music never changes play. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Writes a zone's loop: a lead melody built from two 4-bar phrases in an A A' B A shape, a bass on the
 * root and fifth, a taiko on the downbeat and a rim click on the off-beats.
 */
export function composeLoop(zone: number): Note[] {
  const t = THEMES[zone], rnd = lcg(7919 + zone * 104729), notes: Note[] = [];
  const phrase = (): { step: number; deg: number; len: number }[] => { // 4 bars of eighths, a random walk on the scale
    const out = []; let deg = 5;
    for (let step = 0; step < 32;) {
      const len = rnd() < 0.3 ? 4 : rnd() < 0.5 ? 1 : 2;
      if (rnd() > 0.18) out.push({ step, deg, len });
      deg = Math.max(2, Math.min(10, deg + Math.floor(rnd() * 5) - 2));
      step += len;
    }
    return out;
  };
  const A = phrase(), B = phrase();
  const A2 = A.map((n, i) => (i === A.length - 1 ? { ...n, deg: 5 } : n)); // A' lands home on the root
  const shape = [A, A2, B, A];
  for (let bar = 0; bar < t.bars; bar += 4) {
    const p = shape[(bar / 4) % shape.length];
    for (const n of p) {
      const beat = bar * 4 + n.step / 2;
      if (beat >= t.bars * 4) continue;
      notes.push({ beat, dur: n.len / 2, midi: degreeToMidi(t, n.deg), voice: t.lead });
    }
  }
  for (let bar = 0; bar < t.bars; bar++) {
    const b = bar * 4;
    notes.push({ beat: b, dur: 1.5, midi: t.root - 12, voice: 'bass' });
    notes.push({ beat: b + 2, dur: 1.5, midi: t.root - 12 + 7, voice: 'bass' });
    notes.push({ beat: b, dur: 0.5, midi: 0, voice: 'taiko' });
    if (t.busyDrums || bar % 2 === 1) notes.push({ beat: b + 2, dur: 0.5, midi: 0, voice: 'taiko' });
    for (const off of [0.5, 1.5, 2.5, 3.5]) notes.push({ beat: b + off, dur: 0.1, midi: 0, voice: 'rim' });
  }
  return notes.sort((a, b) => a.beat - b.beat);
}

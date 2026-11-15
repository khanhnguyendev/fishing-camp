// Vitest: the music writer in src/game/music.ts (no audio here, only the notes).
import { describe, expect, it } from 'vitest';
import { composeLoop, degreeToMidi, loopSeconds, THEMES } from '../../src/game/music';

describe('composeLoop', () => {
  it('writes the same loop every time for a zone', () => {
    expect(composeLoop(1)).toEqual(composeLoop(1));
  });

  it('gives every zone a loop of 60 to 90 seconds, as the GDD asks', () => {
    for (const t of THEMES) {
      expect(loopSeconds(t)).toBeGreaterThanOrEqual(60);
      expect(loopSeconds(t)).toBeLessThanOrEqual(90);
    }
  });

  it('keeps every melody note inside its zone scale and inside the loop', () => {
    THEMES.forEach((t, zone) => {
      const lead = composeLoop(zone).filter(n => n.voice === t.lead);
      expect(lead.length).toBeGreaterThan(t.bars * 2);
      for (const n of lead) {
        expect(t.scale).toContain((((n.midi - t.root) % 12) + 12) % 12);
        expect(n.beat + n.dur).toBeLessThanOrEqual(t.bars * 4 + 2);
      }
    });
  });

  it('beats the taiko on every downbeat', () => {
    THEMES.forEach((t, zone) => {
      const downbeats = new Set(composeLoop(zone).filter(n => n.voice === 'taiko').map(n => n.beat));
      for (let bar = 0; bar < t.bars; bar++) expect(downbeats.has(bar * 4)).toBe(true);
    });
  });

  it('sounds different in each zone', () => {
    const tunes = [0, 1, 2].map(z => composeLoop(z).map(n => n.midi).join());
    expect(new Set(tunes).size).toBe(3);
  });
});

describe('degreeToMidi', () => {
  it('walks the scale and wraps into octaves', () => {
    const t = THEMES[0];
    expect(degreeToMidi(t, 0)).toBe(t.root);
    expect(degreeToMidi(t, t.scale.length)).toBe(t.root + 12);
    expect(degreeToMidi(t, -1)).toBe(t.root - 12 + t.scale[t.scale.length - 1]);
  });
});

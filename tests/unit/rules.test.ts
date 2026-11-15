// Vitest: Fishing Camp's rules in src/game/, run in Node with no browser.
import { describe, expect, it } from 'vitest';
import config from '../../data/config.json';
import { carryCap, catchTime, visitOutcome, dishValue, fmt, inTile, inZone3, offlineEarnings, payChunk, walkableAt } from '../../src/game/rules';
import { rng, setSeed } from '../../src/game/random';
import { RICE, ROD_TILE_Z, ROD_X, STAND_SIZE, UNLOCKS } from '../../src/game/unlocks';

const v = (k: keyof typeof config): number => (config[k] as { value: number }).value;
const carryTuning = {
  fish_cap: v('fish_cap'), dish_cap: v('dish_cap'), carry_fish_add: v('carry_fish_add'),
  carry_dish_add: v('carry_dish_add'), worker_cap: v('worker_cap'), carrier_cap: v('carrier_cap'),
};

describe('rng', () => {
  it('repeats the same numbers for the same seed', () => {
    setSeed(7); const first = [rng(), rng(), rng()];
    setSeed(7); expect([rng(), rng(), rng()]).toEqual(first);
    expect(first.every(n => n >= 0 && n < 1)).toBe(true);
  });
});

describe('the core loop pays', () => {
  it('one fish of soup earns its bowls times the bowl price', () => {
    const perFish = v('bowls_per_fish') * dishValue(v('bowl_price'), false, v('golden_mult'));
    expect(perFish).toBe(v('bowls_per_fish') * v('bowl_price'));
  });

  it('a rice-ball pair (one rice, one fish) earns more per fish than sushi, which earns more than soup', () => {
    const soup = v('bowls_per_fish') * v('bowl_price'), sushi = v('plates_per_fish') * v('plate_price');
    const riceballs = v('riceballs_per_pair') * dishValue(v('riceball_price'), false, v('golden_mult'));
    expect(sushi).toBeGreaterThan(soup);
    expect(riceballs).toBeGreaterThan(sushi);
  });

  it('the rice field gate costs about 4x the grill yard gate, as a new zone should', () => {
    const ratio = v('price_gate3') / v('price_gate');
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThanOrEqual(6);
  });

  it('a gold dish sells for the golden multiplier', () => {
    expect(dishValue(v('plate_price'), true, v('golden_mult'))).toBe(v('plate_price') * v('golden_mult'));
  });

  it('the first fisher costs a handful of fish, as the brief says (about 5)', () => {
    const fishNeeded = v('price_fisher1') / (v('bowls_per_fish') * v('bowl_price'));
    expect(fishNeeded).toBeGreaterThanOrEqual(4);
    expect(fishNeeded).toBeLessThanOrEqual(6);
  });
});

describe('payChunk', () => {
  it('pays about price/chunks a bundle, never more than the wallet or what is left, and at least 1', () => {
    const price = v('price_gate'), chunks = v('pay_chunks');
    expect(payChunk(1e6, price, price, chunks)).toBe(Math.ceil(price / chunks));
    expect(payChunk(3, price, price, chunks)).toBe(3);
    expect(payChunk(1e6, 2, price, chunks)).toBe(2);
    expect(payChunk(1e6, 1e6, 1, chunks)).toBe(1);
  });

  it('pays a tile off exactly, however the wallet arrives', () => {
    const price = v('price_conveyor'), chunks = v('pay_chunks');
    let paid = 0, wallet = price + 7;
    while (paid < price) { const a = payChunk(wallet, price - paid, price, chunks); wallet -= a; paid += a; }
    expect(paid).toBe(price);
    expect(wallet).toBe(7);
  });
});

describe('carryCap', () => {
  it('Bigger back adds to the player, never to a worker', () => {
    expect(carryCap('fish', 'player', 0, carryTuning)).toBe(v('fish_cap'));
    expect(carryCap('bowl', 'player', 1, carryTuning)).toBe(v('dish_cap') + v('carry_dish_add'));
    expect(carryCap('fish', 'worker', 1, carryTuning)).toBe(v('worker_cap'));
  });

  it('a hired carrier takes a full load of dishes, more than a fisher brings', () => {
    expect(carryCap('plate', 'carrier', 0, carryTuning)).toBe(v('carrier_cap'));
    expect(carryCap('riceball', 'carrier', 1, carryTuning)).toBe(v('carrier_cap')); // Bigger back is the player's
    expect(v('carrier_cap')).toBeGreaterThan(v('worker_cap'));
  });
});

describe('catchTime', () => {
  it('Quick hands speeds up the player only, by its multiplier', () => {
    const base = v('fish_time'), mult = v('fish_speed_mult');
    expect(catchTime(base, true, false, mult)).toBe(base);
    expect(catchTime(base, true, true, mult)).toBeCloseTo(base / mult, 9);
    expect(catchTime(base, false, true, mult)).toBe(base); // a hired fisher keeps his own pace
  });
});

describe('visitOutcome', () => {
  it('the general pays his chest only when his whole order is eaten in time', () => {
    const need = v('general_bowls'), time = v('general_time');
    expect(visitOutcome(need, need, 5)).toBe('won');
    expect(visitOutcome(need - 1, need, 5)).toBe('eating');
    expect(visitOutcome(need - 1, need, 0)).toBe('lost');
    expect(visitOutcome(need, need, 0)).toBe('won'); // the last bowl in the last moment still counts
    expect(need / time).toBeLessThanOrEqual(v('eat_rate')); // the order can be eaten in time at the counter's pace
  });
});

describe('offlineEarnings', () => {
  it('pays the measured rate for the time away, capped', () => {
    const cap = v('offline_cap');
    expect(offlineEarnings(3, 600, cap, 1)).toEqual({ away: 600, earned: 1800 });
    expect(offlineEarnings(3, cap * 5, cap, 1)).toEqual({ away: cap, earned: 3 * cap });
    expect(offlineEarnings(3, -50, cap, 1).earned).toBe(0);
  });
});

describe('ground', () => {
  it('a tile is the camera-facing square it is drawn as', () => {
    expect(inTile({ x: 0, z: 0 }, { x: 0, z: 0 })).toBe(true);
    expect(inTile({ x: 0.8, z: 0.8 }, { x: 0, z: 0 })).toBe(false); // along the screen's up: 1.13 away
    expect(inTile({ x: 0.5, z: -0.5 }, { x: 0, z: 0 })).toBe(true); // along the screen's right: 0.71 away
  });

  it('no two price tiles that can show together overlap', () => {
    const size = (u: { size?: number }): number => u.size ?? 1.7;
    // fisher3 and pot2 share ground, but pot2 needs the conveyor, which needs fisher3: never both shown
    const neverTogether = (a: string, b: string): boolean => [a, b].sort().join() === 'fisher3,pot2';
    for (const a of UNLOCKS) for (const b of UNLOCKS) {
      if (a.id >= b.id) continue;
      const dx = a.x - b.x, dz = a.z - b.z, reach = (size(a) + size(b)) / 2;
      const apart = Math.abs(dx - dz) * Math.SQRT1_2 >= reach || Math.abs(dx + dz) * Math.SQRT1_2 >= reach;
      const sequential = a.req.includes(b.id) || b.req.includes(a.id) || neverTogether(a.id, b.id);
      expect(apart || sequential, `${a.id} overlaps ${b.id}`).toBe(true);
    }
  });

  it('no price tile overlaps a rod you stand at to fish', () => {
    for (const u of UNLOCKS) for (const x of ROD_X) {
      const dx = u.x - x, dz = u.z - ROD_TILE_Z, reach = ((u.size ?? 1.7) + STAND_SIZE) / 2;
      const apart = Math.abs(dx - dz) * Math.SQRT1_2 >= reach || Math.abs(dx + dz) * Math.SQRT1_2 >= reach;
      expect(apart, `${u.id} overlaps the rod at x=${x}`).toBe(true);
    }
  });

  it('no price tile overlaps a rice field standing tile', () => {
    for (const u of UNLOCKS) for (const t of Object.values(RICE)) {
      const dx = u.x - t.x, dz = u.z - t.z, reach = ((u.size ?? 1.7) + STAND_SIZE) / 2;
      const apart = Math.abs(dx - dz) * Math.SQRT1_2 >= reach || Math.abs(dx + dz) * Math.SQRT1_2 >= reach;
      expect(apart, `${u.id} overlaps the rice field tile at ${t.x},${t.z}`).toBe(true);
    }
  });

  it('the rice field opens only with its own gate, through the grill yard', () => {
    expect(walkableAt(14, 14, true, false)).toBe(false);
    expect(walkableAt(14, 14, true, true)).toBe(true);
    expect(walkableAt(14, 8.3, true, true)).toBe(true); // the gate passage
    expect(walkableAt(10, 8.3, true, true)).toBe(false); // the fence beside it
    expect(inZone3(14, 14)).toBe(true);
    expect(inZone3(14, 0)).toBe(false);
  });

  it('the grill yard is walkable only once the gate is open', () => {
    expect(walkableAt(0, 0, false)).toBe(true);
    expect(walkableAt(14, 0, false)).toBe(false);
    expect(walkableAt(14, 0, true)).toBe(true);
    expect(walkableAt(7, 5, true)).toBe(false); // the fence beside the gate
  });
});

describe('fmt', () => {
  it('keeps money short', () => {
    expect([fmt(950), fmt(12500), fmt(120000), fmt(1.2e6)]).toEqual(['950', '12.5K', '120K', '1.2M']);
  });
});

// Vitest: Fishing Camp's rules in src/game/, run in Node with no browser.
import { describe, expect, it } from 'vitest';
import config from '../../data/config.json';
import { decorPay, vipReward, nextCombo, tipFor, playerSpeed, zoneAutomated, blizzardPay, burnFuel, carryCap, levelSpeed, upgradePrice, catchTime, visitOutcome, dishValue, fmt, inTile, inZone3, inZone4, wantsLog, offlineEarnings, payChunk, walkableAt } from '../../src/game/rules';
import { rng, setSeed } from '../../src/game/random';
import { HEARTH, RICE, ROD_TILE_Z, ROD_X, STAND_SIZE, UNLOCKS } from '../../src/game/unlocks';

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

  it('a fish at the great hearth earns more than a rice-ball pair, and its gate costs about 4x the last', () => {
    const riceballs = v('riceballs_per_pair') * v('riceball_price'), hotpots = v('hotpots_per_fish') * v('hotpot_price');
    expect(hotpots).toBeGreaterThan(riceballs);
    const ratio = v('price_gate4') / v('price_gate3');
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

describe('the hearth fire', () => {
  it('burns down second by second and never below zero', () => {
    expect(burnFuel(10, 1)).toBe(9);
    expect(burnFuel(0.5, 1)).toBe(0);
  });

  it('takes a bundle of firewood only when it fits under its most', () => {
    const max = v('fuel_max'), burn = v('wood_burn');
    expect(wantsLog(max - burn, max, burn)).toBe(true);
    expect(wantsLog(max - burn + 1, max, burn)).toBe(false);
    expect(v('fuel_start')).toBeLessThanOrEqual(max);
  });
});

describe('blizzardPay', () => {
  it('cuts what customers pay only in a blizzard with the hearth fire out', () => {
    const p = v('blizzard_penalty'), price = v('hotpot_price');
    expect(blizzardPay(price, false, false, p)).toBe(price);
    expect(blizzardPay(price, true, true, p)).toBe(price);
    expect(blizzardPay(price, true, false, p)).toBe(Math.round(price * p));
    expect(blizzardPay(1, true, false, 0.1)).toBe(1); // never less than a coin
  });

  it('a blizzard ends well before the next can start', () => {
    expect(v('blizzard_duration')).toBeLessThan(v('blizzard_min'));
  });
});

describe('facility upgrades', () => {
  it('each level costs the growth factor times the last, rounded to 10 coins', () => {
    const base = v('price_up_stove'), g = v('upgrade_growth');
    expect(upgradePrice(base, 0, g)).toBe(base);
    expect(upgradePrice(base, 1, g)).toBe(Math.round(base * g / 10) * 10);
    for (let l = 1; l < v('upgrade_max'); l++) expect(upgradePrice(base, l, g)).toBeGreaterThan(upgradePrice(base, l - 1, g));
  });

  it('each level makes a station faster by the step, never slower', () => {
    const step = v('upgrade_speed_step');
    expect(levelSpeed(0, step)).toBe(1);
    expect(v('cook_time') / levelSpeed(v('upgrade_max'), step)).toBeLessThan(v('cook_time'));
    expect(levelSpeed(2, step)).toBeCloseTo(1 + 2 * step, 9);
  });

  it('STAFF lets workers carry more: a fisher 1 more every 2 levels, a carrier 1 more each level', () => {
    expect(carryCap('fish', 'worker', 0, carryTuning, 0)).toBe(v('worker_cap'));
    expect(carryCap('fish', 'worker', 0, carryTuning, 1)).toBe(v('worker_cap'));
    expect(carryCap('fish', 'worker', 0, carryTuning, 2)).toBe(v('worker_cap') + 1);
    expect(carryCap('plate', 'carrier', 0, carryTuning, 3)).toBe(v('carrier_cap') + 3);
    expect(carryCap('fish', 'player', 0, carryTuning, 5)).toBe(v('fish_cap')); // STAFF is not yours
  });
});

describe('zoneAutomated', () => {
  it('counts a zone toward offline income once its dishes reach the counter without you', () => {
    expect(zoneAutomated(1, [])).toBe(false);
    expect(zoneAutomated(1, ['conveyor'])).toBe(true);
    expect(zoneAutomated(2, ['conveyor', 'gate'])).toBe(false);
    expect(zoneAutomated(2, ['carrier2'])).toBe(true);
    expect(zoneAutomated(3, ['carrier3'])).toBe(true);
    expect(zoneAutomated(4, ['cashier4'])).toBe(false); // a cashier alone does not carry dishes
    expect(zoneAutomated(4, ['carrier4'])).toBe(true);
  });
});

describe('playerSpeed', () => {
  it('the horse and Swift feet each multiply your speed, and stack', () => {
    const b = v('run_speed'), s = v('speed_mult'), h = v('horse_speed_mult');
    expect(playerSpeed(b, false, s, false, h)).toBe(b);
    expect(playerSpeed(b, false, s, true, h)).toBeCloseTo(b * h, 9);
    expect(playerSpeed(b, true, s, true, h)).toBeCloseTo(b * s * h, 9);
    expect(h).toBeGreaterThan(1);
  });
});

describe('tips', () => {
  it('the combo climbs with quick hand deliveries, caps, and starts over after a pause', () => {
    const w = v('tip_window'), max = v('tip_combo_max');
    expect(nextCombo(0, w + 1, w, max)).toBe(1);
    expect(nextCombo(3, w - 1, w, max)).toBe(4);
    expect(nextCombo(max, 0.5, w, max)).toBe(max);
    expect(nextCombo(7, w + 0.01, w, max)).toBe(1);
  });

  it('a dish tips its price x rate x combo, so a full combo adds half the price at the starting values', () => {
    expect(tipFor(100, 1, v('tip_rate'))).toBe(Math.round(100 * v('tip_rate')));
    expect(tipFor(100, v('tip_combo_max'), v('tip_rate'))).toBe(Math.round(100 * v('tip_rate') * v('tip_combo_max')));
    expect(tipFor(5, 1, v('tip_rate'))).toBe(0); // a single cheap bowl tips nothing; a combo makes it worth it
  });
});

describe('vipReward', () => {
  it("a VIP's chest is the order's value times the bonus", () => {
    expect(vipReward(v('plate_price'), v('vip_count'), v('vip_bonus'))).toBe(Math.round(v('plate_price') * v('vip_count') * v('vip_bonus')));
    expect(vipReward(5, 12, 0)).toBe(0);
  });

  it('a VIP order can be eaten in time at a counter', () => {
    expect(v('vip_count') / v('vip_time')).toBeLessThanOrEqual(v('eat_rate'));
  });
});

describe('decorPay', () => {
  it('each lantern level adds its bonus to what a customer pays', () => {
    const b = v('decor_bonus');
    expect(decorPay(100, 0, b)).toBe(100);
    expect(decorPay(100, 1, b)).toBe(Math.round(100 * (1 + b)));
    expect(decorPay(135, v('upgrade_max'), b)).toBe(Math.round(135 * (1 + b * v('upgrade_max'))));
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

  it('no price tile overlaps a great hearth standing tile', () => {
    for (const u of UNLOCKS) for (const t of Object.values(HEARTH)) {
      const dx = u.x - t.x, dz = u.z - t.z, reach = ((u.size ?? 1.7) + STAND_SIZE) / 2;
      const apart = Math.abs(dx - dz) * Math.SQRT1_2 >= reach || Math.abs(dx + dz) * Math.SQRT1_2 >= reach;
      expect(apart, `${u.id} overlaps the hearth tile at ${t.x},${t.z}`).toBe(true);
    }
  });

  it('the great hearth opens only with its own gate, through the rice field', () => {
    expect(walkableAt(14, 26, true, true, false)).toBe(false);
    expect(walkableAt(14, 26, true, true, true)).toBe(true);
    expect(walkableAt(14, 20.6, true, true, true)).toBe(true); // the gate passage
    expect(walkableAt(10, 20.6, true, true, true)).toBe(false); // the fence beside it
    expect(inZone4(14, 26)).toBe(true);
    expect(inZone4(14, 14)).toBe(false);
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

// Fishing Camp's rules with no browser in them: money, carrying, offline income, where you can
// stand and walk. The game calls these; tests/unit runs them in Node.
import type { GroundPoint, ItemType, Rect } from './types';

/** Short money text: 950, 12.5K, 120K, 1.2M. */
export const fmt = (n: number): string =>
  n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K' : String(Math.floor(n));

/** Coins a soldier pays for one dish: its price, times the golden multiplier for a gold dish. */
export function dishValue(price: number, gold: boolean, goldenMult: number): number {
  return price * (gold ? goldenMult : 1);
}

/**
 * Coins that move into a price tile in one payment: a bundle of about price/chunks,
 * never more than the wallet holds or the tile still needs, and at least 1.
 */
export function payChunk(wallet: number, remaining: number, price: number, chunks: number): number {
  return Math.min(wallet, remaining, Math.max(1, Math.ceil(price / chunks)));
}

/** Who is carrying: you, a hired fisher or farmer, or a hired carrier (table to counter). */
export type Bearer = 'player' | 'worker' | 'carrier';

/**
 * How many items of a type someone holds: a fisher or farmer brings a fixed few, a carrier a fixed
 * load of dishes, and the player grows with "Bigger back".
 */
export function carryCap(
  type: ItemType, who: Bearer, carryLevel: number,
  t: { fish_cap: number; dish_cap: number; carry_fish_add: number; carry_dish_add: number; worker_cap: number; carrier_cap: number },
  staffLevel = 0,
): number {
  if (who === 'worker') return t.worker_cap + Math.floor(staffLevel / 2);
  if (who === 'carrier') return t.carrier_cap + staffLevel;
  return type === 'fish' ? t.fish_cap + carryLevel * t.carry_fish_add : t.dish_cap + carryLevel * t.carry_dish_add;
}

/** Seconds for one catch: the player with "Quick hands" fishes mult times faster; workers never do. */
export function catchTime(base: number, isPlayer: boolean, quickHands: boolean, mult: number): number {
  return isPlayer && quickHands ? base / mult : base;
}

/** Where a general's visit stands: filled in time, run out of time, or still eating. */
export function visitOutcome(eaten: number, need: number, timeLeft: number): 'won' | 'lost' | 'eating' {
  if (eaten >= need) return 'won';
  return timeLeft <= 0 ? 'lost' : 'eating';
}

/**
 * What a dish pays in a blizzard: full price while the hearth burns or when there is no blizzard;
 * otherwise the penalty share, rounded, and never less than 1 coin.
 */
export function blizzardPay(value: number, blizzard: boolean, fireLit: boolean, penalty: number): number {
  if (!blizzard || fireLit) return value;
  return Math.max(1, Math.round(value * penalty));
}

/** The price of the next level of a facility upgrade: the first price x growth^level, rounded to 10 coins. */
export function upgradePrice(base: number, level: number, growth: number): number {
  return Math.round(base * Math.pow(growth, level) / 10) * 10;
}

/** How much faster something is at an upgrade level: 1 + step x level (times are divided by it). */
export function levelSpeed(level: number, step: number): number {
  return 1 + step * level;
}

/**
 * True when a zone's dishes reach its counter without the player: zone 1 with the conveyor, zones 2-4
 * once their carrier is hired. Those zones count toward offline income.
 */
export function zoneAutomated(zone: number, done: string[]): boolean {
  const needs: Record<number, string> = { 1: 'conveyor', 2: 'carrier2', 3: 'carrier3', 4: 'carrier4' };
  return !!needs[zone] && done.includes(needs[zone]);
}

/**
 * Offline income on return: the measured automated rate over the time away (in seconds, capped),
 * scaled by the offline factor and rounded down.
 */
export function offlineEarnings(rate: number, awaySeconds: number, cap: number, factor: number): { away: number; earned: number } {
  const away = Math.min(cap, Math.max(0, awaySeconds));
  return { away, earned: Math.floor(rate * away * factor) };
}

/** True when (x, z) is inside the rectangle, edges included. */
export const inRect = (r: Rect, x: number, z: number): boolean => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/**
 * True when p stands on the tile at t. Tiles are drawn as squares facing the camera (turned 45 degrees
 * on the ground), so the check uses the same turned square, half-size h.
 */
export const inTile = (p: GroundPoint, t: GroundPoint, h = 0.85): boolean => {
  const dx = p.x - t.x, dz = p.z - t.z;
  return Math.abs(dx - dz) * Math.SQRT1_2 < h && Math.abs(dx + dz) * Math.SQRT1_2 < h;
};

// Walkable ground. Zone 1 reaches the west fence except beside the counter; zone 2 and the gate
// passage open with the gate.
export const Z1: Rect = { x0: -4.7, x1: 6.6, z0: -8.8, z1: 7.6 };
export const Z1N: Rect = { x0: -5.6, x1: 6.6, z0: -8.8, z1: 0.1 };
export const Z1S: Rect = { x0: -5.6, x1: 6.6, z0: 4.9, z1: 7.6 };
export const Z2: Rect = { x0: 7.4, x1: 20.3, z0: -8.8, z1: 7.6 };
export const GATE: Rect = { x0: 6.0, x1: 8.0, z0: -1.6, z1: 1.6 };
/** Zone 3, the rice field, south of the grill yard, and the passage through its gate. */
export const Z3: Rect = { x0: 7.9, x1: 20.9, z0: 9.0, z1: 19.8 };
export const GATE3: Rect = { x0: 12.6, x1: 15.4, z0: 7.0, z1: 9.6 };
/** Zone 4, the great hearth, south of the rice field, and the passage through its gate. */
export const Z4: Rect = { x0: 7.9, x1: 20.9, z0: 21.4, z1: 32.0 };
export const GATE4: Rect = { x0: 12.6, x1: 15.4, z0: 19.4, z1: 22.0 };

/** True when the player may stand at (x, z), given which gates are open. */
export function walkableAt(x: number, z: number, gateOpen: boolean, gate3Open = false, gate4Open = false): boolean {
  return inRect(Z1, x, z) || inRect(Z1N, x, z) || inRect(Z1S, x, z) || (gateOpen && (inRect(Z2, x, z) || inRect(GATE, x, z)))
    || (gate3Open && (inRect(Z3, x, z) || inRect(GATE3, x, z))) || (gate4Open && (inRect(Z4, x, z) || inRect(GATE4, x, z)));
}

/** True when (x, z) is inside the great hearth's yard. */
export const inZone4 = (x: number, z: number): boolean => inRect(Z4, x, z);

/** The hearth's fire after dt seconds of burning: it never drops below zero. */
export function burnFuel(fuel: number, dt: number): number {
  return Math.max(0, fuel - dt);
}

/** True when one more bundle of firewood fits on the fire without going over its most. */
export function wantsLog(fuel: number, max: number, burn: number): boolean {
  return fuel + burn <= max;
}

/** True when (x, z) is inside the rice field. */
export const inZone3 = (x: number, z: number): boolean => inRect(Z3, x, z);

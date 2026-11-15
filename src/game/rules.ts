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

/** How many items of a type a carrier holds: workers carry a fixed amount; the player grows with "Bigger back". */
export function carryCap(
  type: ItemType, isPlayer: boolean, carryLevel: number,
  t: { fish_cap: number; dish_cap: number; carry_fish_add: number; carry_dish_add: number; worker_cap: number },
): number {
  if (!isPlayer) return t.worker_cap;
  return type === 'fish' ? t.fish_cap + carryLevel * t.carry_fish_add : t.dish_cap + carryLevel * t.carry_dish_add;
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

/** True when the player may stand at (x, z), given which gates are open. */
export function walkableAt(x: number, z: number, gateOpen: boolean, gate3Open = false): boolean {
  return inRect(Z1, x, z) || inRect(Z1N, x, z) || inRect(Z1S, x, z) || (gateOpen && (inRect(Z2, x, z) || inRect(GATE, x, z)))
    || (gate3Open && (inRect(Z3, x, z) || inRect(GATE3, x, z)));
}

/** True when (x, z) is inside the rice field. */
export const inZone3 = (x: number, z: number): boolean => inRect(Z3, x, z);

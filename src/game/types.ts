// Shared types for Fishing Camp's rules and world.

/**
 * Typing still to do: world objects the game builds field by field, kind by kind
 * (carriers, rods, piles, stations, counters, tiles, tweens, particles, the state).
 * Each use is a place to give a real type later.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Loose = any;

/** One tunable value in data/config.json. */
export interface ConfigEntry {
  value: number;
  min: number;
  max: number;
  step: number;
}

/** An axis-aligned rectangle on the ground (metres). */
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** A point on the ground (y is ignored). */
export interface GroundPoint {
  x: number;
  z: number;
}

/** What the player can carry or a pile can hold. */
export type ItemType = 'fish' | 'bowl' | 'plate' | 'cash' | 'rice' | 'riceball';

/** The kinds of price tile, told apart by their icon. */
export type UnlockKind = 'hire' | 'upgrade' | 'zone';

/** A price tile's definition: where it is, what it costs (a config key) and what it needs first. */
export interface UnlockDef {
  id: string;
  kind: UnlockKind;
  label: string;
  /** data/config.json key holding the price. */
  price: string;
  x: number;
  z: number;
  /** Tile size in metres; 1.7 when absent. */
  size?: number;
  /** Unlock ids that must be bought before this tile shows. */
  req: string[];
  /** Where the camera glides when it is bought. */
  focus?: [number, number];
}

/** What localStorage keeps between visits. */
export interface SaveData {
  wallet: number;
  done: string[];
  paid: Record<string, number>;
  /** Date.now() when saved, for offline income. */
  at: number;
  /** Measured automated income, coins per second. */
  rate: number;
  playTime: number;
  goalDone: boolean;
  earned: number;
  goldNext: number;
  /** The first rice ball has been sold (zone 3's milestone). */
  goal3Done?: boolean;
}

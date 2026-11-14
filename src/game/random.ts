// Seeded randomness: every gameplay random call reads rng(), never Math.random.

let seed = 0;

/** Starts the sequence again from this seed. */
export function setSeed(s: number): void {
  seed = s;
}

/** mulberry32: the next number in [0, 1). */
export function rng(): number {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A random number between a and b. */
export const rr = (a: number, b: number): number => a + (b - a) * rng();

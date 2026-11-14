// Every tuning value, from data/config.json: each with value, min, max and step. The game reads
// them live through tune.<name>; the tweak panel (dev server only) changes them in place.
import data from '../data/config.json';
import type { ConfigEntry } from './game/types';

/** The tunable values, by name. */
export const CONFIG = data as unknown as Record<string, ConfigEntry>;
/** The seed every run starts from, unless ?seed= is in the address. */
export const SEED: number = (data as { seed: number }).seed;
/** Live reads: tune.fish_time is CONFIG.fish_time.value, now. */
export const tune = new Proxy({} as Record<string, number>, { get: (_, k) => CONFIG[k as string].value });

(window as unknown as { CONFIG: unknown }).CONFIG = data;
if (import.meta.env.DEV) await import('./dev/tune');

// The price tiles in the order they appear: a tile shows once everything in its req is bought.
import type { UnlockDef } from './types';

export const UNLOCKS: UnlockDef[] = [
  { id: 'fisher1', kind: 'hire', label: 'FISHER', price: 'price_fisher1', x: -1.97, z: -9.13, size: 1.2, req: [], focus: [-3.1, -8] },
  { id: 'fisher2', kind: 'hire', label: 'FISHER', price: 'price_fisher2', x: 1.63, z: -9.13, size: 1.2, req: ['fisher1'], focus: [0.5, -8] },
  { id: 'carry', kind: 'upgrade', label: 'BIGGER BACK', price: 'price_carry', x: 5.6, z: 4.6, req: ['fisher1'] },
  { id: 'fishspeed', kind: 'upgrade', label: 'QUICK HANDS', price: 'price_fishspeed', x: 0.9, z: 7.0, req: ['fisher1'] },
  { id: 'fisher3', kind: 'hire', label: 'FISHER', price: 'price_fisher3', x: 5.23, z: -9.13, size: 1.2, req: ['fisher2'], focus: [4.1, -8] },
  { id: 'conveyor', kind: 'upgrade', label: 'CONVEYOR', price: 'price_conveyor', x: -0.6, z: 4.6, req: ['fisher3'], focus: [-0.6, 2.6] },
  { id: 'speed', kind: 'upgrade', label: 'SWIFT FEET', price: 'price_speed', x: 3.4, z: 6.6, req: ['fisher3'] },
  { id: 'gate', kind: 'zone', label: 'GRILL YARD', price: 'price_gate', x: 5.6, z: 0.4, req: ['conveyor'], focus: [14.2, -1.5] },
  { id: 'pot2', kind: 'upgrade', label: 'SECOND POT', price: 'price_pot2', x: 5.8, z: -4.4, req: ['conveyor'], focus: [4.3, -2] },
  { id: 'grillfisher', kind: 'hire', label: 'FISHER', price: 'price_grillfisher', x: 12.33, z: -9.13, size: 1.2, req: ['gate'], focus: [11.2, -8] },
  { id: 'gate3', kind: 'zone', label: 'RICE FIELD', price: 'price_gate3', x: 14, z: 6.0, req: ['gate'], focus: [14, 14] },
  { id: 'farmer', kind: 'hire', label: 'FARMER', price: 'price_farmer', x: 20.4, z: 15.2, size: 1.2, req: ['gate3'], focus: [19.2, 12] },
  { id: 'pondfisher', kind: 'hire', label: 'FISHER', price: 'price_pondfisher', x: 16.4, z: 16.4, size: 1.2, req: ['gate3'], focus: [18.4, 18] },
];


/** The bamboo rods along the dock: x of each (the last is the grill yard's), and where you stand to fish. */
export const ROD_X: number[] = [-3.1, 0.5, 4.1, 11.2];
export const ROD_TILE_Z = -8;
/** Size in metres of a standing tile (rods, drop-offs, pick-ups). */
export const STAND_SIZE = 1.7;

/** Zone 3's working spots (rice field): where things are, in metres. */
export const RICE = {
  /** Stand here to harvest rice at the paddy. */
  paddyTile: { x: 19.2, z: 13.6 },
  /** Stand here to net fish at the pond. */
  pondTile: { x: 16.6, z: 18.6 },
  /** Drop rice and fish here for the rice cook. */
  stationDrop: { x: 13.8, z: 12.2 },
  /** Pick up rice balls here. */
  pickup: { x: 12.2, z: 16.9 },
} as const;

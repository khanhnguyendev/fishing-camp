// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does carry → cook → serve → hire feel satisfying enough to keep someone playing through all six zone-1 unlocks?
// Date: 2026-11-14
// Every tuning value lives here, each with value, min, max and step. The game reads them live
// through tune.<name> (index.html); the tweak panel, an add-on, writes them back here.
// Starting values come from the GDD (Game Design Document Fishing Camp.md, section 5).
window.CONFIG = {
  seed: 1, // every gameplay random call reads rng(), seeded from this (or ?seed= in the address)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // --- Production (GDD 5: production values) ---
  fish_time:       { value: 2.0, min: 0.3, max: 6, step: 0.1 },   // seconds to catch 1 fish
  cook_time:       { value: 1.5, min: 0.2, max: 6, step: 0.1 },   // seconds for the chef to turn 1 fish into soup
  bowls_per_fish:  { value: 4, min: 1, max: 10, step: 1 },        // bowls from 1 fish
  bowl_price:      { value: 5, min: 1, max: 50, step: 1 },        // coins per soup bowl
  grill_time:      { value: 2.0, min: 0.2, max: 6, step: 0.1 },   // seconds for the grill chef to turn 1 fish into sushi
  plates_per_fish: { value: 3, min: 1, max: 10, step: 1 },        // sushi plates from 1 fish
  plate_price:     { value: 15, min: 1, max: 100, step: 1 },      // coins per sushi plate (3x soup, GDD 5)
  eat_rate:        { value: 4, min: 0.5, max: 12, step: 0.5 },    // dishes per second a counter's front row eats

  // --- Carrying and movement ---
  run_speed:       { value: 5, min: 2, max: 10, step: 0.1 },      // player metres per second
  fish_cap:        { value: 1, min: 1, max: 10, step: 1 },        // starting fish the player can carry
  dish_cap:        { value: 8, min: 1, max: 40, step: 1 },        // starting bowls/plates the player can carry
  carry_fish_add:  { value: 1, min: 0, max: 5, step: 1 },         // "Bigger back" upgrade: extra fish
  carry_dish_add:  { value: 6, min: 0, max: 20, step: 1 },        // "Bigger back" upgrade: extra bowls/plates
  speed_mult:      { value: 1.3, min: 1, max: 2, step: 0.05 },    // "Swift feet" upgrade: run speed multiplier
  worker_speed:    { value: 3.6, min: 1, max: 8, step: 0.1 },     // fisher metres per second
  worker_cap:      { value: 1, min: 1, max: 5, step: 1 },         // fish a fisher carries per trip
  pickup_interval: { value: 0.07, min: 0.02, max: 0.3, step: 0.01 }, // seconds between items hopping on/off the back

  // --- Storage limits ---
  board_limit:     { value: 10, min: 2, max: 30, step: 1 },       // fish waiting at the chef's board / grill
  pot_limit:       { value: 42, min: 8, max: 42, step: 1 },       // bowls waiting on the kitchen table
  sushi_limit:     { value: 30, min: 6, max: 30, step: 1 },       // plates waiting on the sushi table
  counter_limit:   { value: 30, min: 6, max: 30, step: 1 },       // dishes a serving counter holds

  // --- Conveyor ---
  belt_speed:      { value: 3, min: 0.5, max: 10, step: 0.1 },    // metres per second along the belt
  belt_interval:   { value: 0.25, min: 0.05, max: 2, step: 0.05 },// seconds between bowls leaving the table

  // --- Unlock prices (GDD 5: zone 1 order; carry/speed/grill fisher are proposals at ~1.5x steps) ---
  price_fisher1:     { value: 100, min: 10, max: 2000, step: 10 },
  price_fisher2:     { value: 100, min: 10, max: 2000, step: 10 },
  price_carry:       { value: 150, min: 10, max: 2000, step: 10 },
  price_fisher3:     { value: 100, min: 10, max: 2000, step: 10 },
  price_conveyor:    { value: 200, min: 10, max: 2000, step: 10 },
  price_speed:       { value: 250, min: 10, max: 2000, step: 10 },
  price_gate:        { value: 500, min: 10, max: 5000, step: 10 },
  price_pot2:        { value: 500, min: 10, max: 5000, step: 10 },
  price_grillfisher: { value: 600, min: 10, max: 5000, step: 10 },
  pay_dwell:       { value: 0.25, min: 0, max: 2, step: 0.05 },   // seconds standing on a price tile before cash flows
  pay_chunks:      { value: 30, min: 5, max: 100, step: 1 },      // a tile's price is paid in about this many bundles
  pay_interval:    { value: 0.035, min: 0.01, max: 0.2, step: 0.005 }, // seconds between paid bundles

  // --- Golden school (GDD 6) ---
  golden_first:    { value: 150, min: 10, max: 600, step: 10 },   // seconds of play before the first golden school
  golden_min:      { value: 180, min: 30, max: 900, step: 10 },   // shortest gap between golden schools (s)
  golden_max:      { value: 300, min: 30, max: 900, step: 10 },   // longest gap (s)
  golden_duration: { value: 20, min: 5, max: 60, step: 1 },       // seconds gold fish bite
  golden_mult:     { value: 5, min: 1, max: 20, step: 1 },        // gold dishes sell for this many times the price

  // --- Customers ---
  want_min:        { value: 1, min: 1, max: 10, step: 1 },        // dishes a front-row soldier wants, least
  want_max:        { value: 3, min: 1, max: 10, step: 1 },        // most

  // --- Offline income and guidance ---
  offline_cap:     { value: 7200, min: 0, max: 86400, step: 600 },// seconds of away time that earn (2 h)
  offline_factor:  { value: 1, min: 0, max: 2, step: 0.05 },      // share of the measured automated income earned away
  guide_time:      { value: 180, min: 0, max: 900, step: 10 },    // seconds the guide arrow shows (first 3 min)

  // --- Camera ---
  cam_distance:    { value: 25, min: 10, max: 60, step: 1 },      // metres from the player
  cam_pitch:       { value: 50, min: 25, max: 80, step: 1 },      // degrees of tilt
  cam_fov:         { value: 34, min: 15, max: 70, step: 1 },      // vertical field of view (degrees)
  cam_lag:         { value: 6, min: 1, max: 20, step: 0.5 },      // follow stiffness (higher = less lag)
  glide_time:      { value: 1.5, min: 0, max: 4, step: 0.1 },     // seconds the camera visits a new unlock
};

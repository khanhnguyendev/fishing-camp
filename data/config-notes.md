# The values' notes

What `prototypes/fishing-camp/config.js` said beside its values, kept here because `data/config.json`
holds no comments. The values themselves are in `data/config.json`.

- `seed`: every gameplay random call reads rng(), seeded from this (or ?seed= in the address)

--- Production (GDD 5: production values) ---
- `fish_time`: seconds to catch 1 fish
- `cook_time`: seconds for the chef to turn 1 fish into soup
- `bowls_per_fish`: bowls from 1 fish
- `bowl_price`: coins per soup bowl
- `cut_time`: seconds the chef cuts a fish on the board (part of cook/grill time)
- `grill_time`: seconds for the grill chef to turn 1 fish into sushi
- `plates_per_fish`: sushi plates from 1 fish
- `plate_price`: coins per sushi plate (3x soup, GDD 5)
- `eat_rate`: dishes per second a counter's front row eats

--- Carrying and movement ---
- `run_speed`: player metres per second
- `fish_cap`: starting fish the player can carry
- `dish_cap`: starting bowls/plates the player can carry
- `carry_fish_add`: "Bigger back" upgrade: extra fish
- `carry_dish_add`: "Bigger back" upgrade: extra bowls/plates
- `speed_mult`: "Swift feet" upgrade: run speed multiplier
- `worker_speed`: fisher metres per second
- `worker_cap`: fish a fisher carries per trip
- `pickup_interval`: seconds between items hopping on/off the back

--- Storage limits ---
- `board_limit`: fish waiting at the chef's board / grill
- `pot_limit`: bowls waiting on the kitchen table
- `sushi_limit`: plates waiting on the sushi table
- `counter_limit`: dishes a serving counter holds

--- Conveyor ---
- `belt_speed`: metres per second along the belt

--- Unlock prices (GDD 5: zone 1 order; carry/speed/grill fisher are proposals at ~1.5x steps) ---
- `pay_dwell`: seconds standing still on a price tile before cash flows
- `pay_still_speed`: below this speed (m/s) you count as stopped on a tile
- `pay_chunks`: a tile's price is paid in about this many bundles
- `pay_interval`: seconds between paid bundles

--- Golden school (GDD 6) ---
- `golden_first`: seconds of play before the first golden school
- `golden_min`: shortest gap between golden schools (s)
- `golden_max`: longest gap (s)
- `golden_duration`: seconds gold fish bite
- `golden_mult`: gold dishes sell for this many times the price

--- Customers ---
- `want_min`: dishes a front-row soldier wants, least
- `want_max`: most

--- Offline income and guidance ---
- `offline_factor`: share of the measured automated income earned away
- `guide_time`: seconds the guide arrow shows (first 3 min)

--- Camera ---
- `cam_distance`: metres from the player
- `cam_pitch`: degrees of tilt
- `cam_fov`: vertical field of view (degrees)
- `portrait_pull`: most the camera pulls back on a tall (portrait) screen
- `cam_lag`: follow stiffness (higher = less lag)
- `glide_time`: seconds the camera visits a new unlock

## Zone 3: rice field (GDD 6; prices are proposals: a new zone ~4x the last gate, dish 3x sushi)
- `price_gate3`: coins to open the rice field gate
- `price_farmer`: coins to hire the farmer (paddy -> rice-ball station)
- `price_pondfisher`: coins to hire the pond fisher (pond -> rice-ball station)
- `rice_time`: seconds to harvest 1 rice sack at the paddy
- `pond_time`: seconds to net 1 fish at the pond
- `riceball_time`: seconds for the rice cook to turn 1 rice + 1 fish into rice balls (includes cut_time)
- `riceballs_per_pair`: rice balls from 1 rice sack + 1 fish
- `riceball_price`: coins per rice ball (3x sushi)
- `riceball_limit`: rice balls waiting on the rice-ball table

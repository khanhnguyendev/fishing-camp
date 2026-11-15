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
- `fish_speed_mult`: "Quick hands" upgrade: the player catches fish this many times faster (rods and pond; workers unchanged)
- `price_fishspeed`: coins for "Quick hands" (GDD 4: fishing speed is the third player stat)
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

## Carriers (GDD 4: "hiring replaces the player at each step: fishers first, then carriers")
- `carrier_cap`: dishes a carrier takes per trip, table to counter (carriers never touch cash)
- `price_carrier2`: coins to hire the grill yard's carrier (sushi table -> gold soldiers' counter)
- `price_carrier3`: coins to hire the rice field's carrier (rice-ball table -> cavalry counter)
- `price_carrier4`: coins to hire the great hearth's carrier (hot-pot table -> generals' counter)

## General's visit (GDD 6: "a big customer orders 30 bowls within 60 seconds and rewards a chest of cash")
- `general_first`: seconds of play before the first visit (needs all three river fishers hired)
- `general_min`, `general_max`: shortest and longest gap between visits (s)
- `general_bowls`: bowls the general orders
- `general_time`: seconds he waits for them
- `general_reward`: coins in the chest when the order is filled in time (each bowl also pays as usual)

## Music (GDD 8: one 60-90 s loop per zone)
- `music_volume`: loudness of the music under the effects (M mutes both)

## Zone 4: the great hearth (GDD 6; prices are proposals: a new zone ~4x the last gate, dish 3x rice balls per fish)
- `price_gate4`: coins to open the great hearth's gate
- `price_woodcutter`: coins to hire the woodcutter (woodpile -> the fire)
- `price_icefisher`: coins to hire the ice fisher (ice hole -> the hearth)
- `wood_time`: seconds to chop 1 bundle of firewood
- `ice_time`: seconds to catch 1 fish through the ice hole
- `hotpot_time`: seconds for the hearth cook to turn 1 fish into hot pots (includes cut_time)
- `hotpots_per_fish`: hot pots from 1 fish
- `hotpot_price`: coins per hot pot
- `hotpot_limit`: hot pots waiting on the hot-pot table
- `fuel_max`: most seconds of burn the fire holds
- `fuel_start`: seconds of burn the fire has when the gate opens
- `wood_burn`: seconds of burn one bundle of firewood adds (the fire takes a bundle only when it fits under fuel_max)

## Blizzard (GDD 6: zone 4's event; "without firewood, customers pay less")
- `blizzard_first`: seconds after the great hearth opens before the first blizzard
- `blizzard_min`, `blizzard_max`: shortest and longest gap between blizzards (s)
- `blizzard_duration`: seconds a blizzard lasts: the river and the pond freeze; only the ice hole gives fish
- `blizzard_penalty`: what every customer pays, as a share of the price, while the hearth's fire is out in a blizzard

## Cashiers (asked for after play: "a cashier that collects the money automatically"; this replaces the GDD 4 rule that only the player collects cash)
- `price_cashier1` .. `price_cashier4`: coins to hire the cashier at the soup, sushi, rice-ball and hot-pot counters
- `cashier_interval`: seconds between bundles a cashier moves from the cash pile into your wallet

## Facility upgrades (asked for after play: "a faster stove, faster rods, upgrade the staff")
- `price_up_stove`, `price_up_rods`, `price_up_staff`, `price_up_grill`, `price_up_ricecook`, `price_up_hearth`: the first level's price of each upgrade
- `upgrade_growth`: each next level costs this many times the last
- `upgrade_max`: how many levels each upgrade has
- `upgrade_speed_step`: each level of a stove, the rods, the grill, the rice tub or the cauldron makes it this much faster (1 + step x level)
- `staff_speed_step`: each STAFF level makes every worker walk this much faster; every 2 levels a fisher, farmer or woodcutter carries 1 more, a carrier 1 more each level

## Offline income (asked for after play: "offline income for the whole camp")
- A zone earns while you are away when its dishes reach the counter without you: zone 1 with the conveyor, zones 2-4 with their carrier. The game measures what those zones earn while you play and pays that rate for the time away (`offline_cap`, `offline_factor`).

## The horse (asked for after play: "a horse to move fast between the zones")
- `price_horse`: coins for the horse at the rice field's stable
- `horse_speed_mult`: how many times faster you move riding (stacks with Swift feet)

## Quest board (`data/quest_list.json`; asked for after play)
The board shows one quest at a time, in the file's order. Each entry:
- `id`: a unique name
- `text`: what the board says
- `kind`: `sell` (serve dishes), `unlock` (buy an unlock), `earn` (coins earned in total), `level` (any facility upgrade at a level)
- `item`: for `sell`, the dish: `bowl`, `plate`, `riceball` or `hotpot`
- `unlock`: for `unlock`, the unlock id (as in `src/game/unlocks.ts`)
- `target`: how many (dishes, coins, the level; 1 for an unlock)
- `reward`: coins paid when it is done

## Tips (asked for after play: reward serving by hand)
- `tip_rate`: each dish you deliver yourself tips this share of its price, times your combo
- `tip_window`: seconds between deliveries that keep the combo going (it starts again at 1 after a longer gap)
- `tip_combo_max`: the highest combo

## VIP orders (asked for after play)
- `vip_first`: seconds of play before the first VIP (needs the first fisher hired)
- `vip_min`, `vip_max`: shortest and longest gap between VIPs (s)
- `vip_count`: dishes a VIP orders at their counter (served before anyone else there)
- `vip_time`: seconds they wait
- `vip_bonus`: the chest pays this many times the order's value when it is filled in time (each dish also pays as usual)

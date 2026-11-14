# Game Design Document: Fishing Camp

Nov 14, 2026 · @NGO KHANH NGUYEN

## 1. Overview

Fishing Camp (working title) is an arcade idle game: the player catches fish, cooks, and feeds a hungry army, then spends the money on hiring workers, automating, and expanding the camp. This document is based on gameplay observed in a 47-second ad video; every number is a starting point to tune in playtests.

| Item | Detail |
| --- | --- |
| Genre | Arcade idle / business simulation |
| Audience | Casual players aged 16–40, sessions of 3–10 minutes |
| View | 3D isometric-style top-down, camera follows the character |
| Setting | A riverside army camp in a historical setting, chibi style |
| Model | Free to play, rewarded ads and in-game purchases |

**Three design pillars**

- **One input:** the player only moves; every action triggers automatically when standing on a tile.
- **Visible growth:** the bowl stack, the cash stack and the crowd must be taller and bigger every minute.
- **From manual to automated:** each upgrade removes a job the player just had to do by hand.

## 2. Gameplay loop

The core loop takes about 10 seconds and repeats for the whole game; new content only swaps the ingredient, the dish and the customer.

**Core loop**

1. **Fish:** stand on the tile next to a bamboo rod; the rod bends and glows, and a fish jumps out after 2 seconds.
2. **Deliver:** carry the fish to the chef's cutting board; it leaves the player's back on entering the drop zone.
3. **Cook:** the chef processes it and the soup pot produces a stack of bowls beside it.
4. **Serve:** pick up the bowl stack and take it to the counter at the fence; soldiers take the bowls one by one.
5. **Collect:** cash bursts onto the counter and is pulled into a stack on the player's back.
6. **Spend:** stand on a price tile; cash flows into it until the price is met, then it unlocks.

**Meta loop**

- **Hiring** replaces the player at each step: fishers first, then carriers.
- **Upgrades** remove bottlenecks: a conveyor that sends bowls to the counter, bigger carry capacity, run speed.
- **New zones** open through locked gates: a new kitchen, a new dish, customers who pay more.
- **Offline income:** on return, the player receives money based on automated output, capped at 2 hours.

Target pacing: during the first 10 minutes the player unlocks something new every 30–60 seconds.

## 3. Controls and camera

The whole game is played with a single movement input; there are no action buttons.

- **Movement:** one directional input is all that is needed. When the input stops, the character stops.
- **Interaction:** standing inside a tile's trigger area runs its action automatically. Empty tiles have a white outline to show where to stand.
- **Pick up and drop off:** items fly onto the back stack when the player gets close, and leave one by one at a drop point.
- **Camera:** perspective tilted about 50° and rotated 45°, following the character with a slight lag. When a new zone unlocks, the camera glides there for 1.5 seconds and returns.
- **Guidance:** an arrow at the character's feet points to the next useful task during the first 3 minutes, in place of a text tutorial.

## 4. Systems

The game has five systems, all built around moving items between stations.

**Player character.** Carries items as a stack on the back, one item type at a time. Three upgradable stats: run speed, carry capacity, fishing speed.

**Stations.** Each station has an input, a processing time, an output and a storage limit.

| Station | Input | Output | Operated by |
| --- | --- | --- | --- |
| Fishing rods (3) | None | 1 tuna | Player or fisher |
| Cutting board and soup pot | Tuna | Bowls of fish soup | Built-in chef |
| Serving counter | Soup bowls | Cash | Soldiers help themselves |
| Conveyor | Bowls at the kitchen | Bowls at the counter | Automatic |
| Grill (zone 2) | Tuna | Sushi plates | Hired chef |

**Customers.** Soldiers stand in a block behind the fence. The front row shows a bubble with the dish they want; after eating, a soldier steps back and another moves up. The crowd is visually endless, and only the front row has logic.

**Workers.** Hired at tiles that show a price bubble. Each runs one fixed route: fishers go rod → cutting board; carriers go kitchen → counter. Workers never collect cash; that job always stays with the player.

**Unlock tiles.** Three kinds, told apart by icon: cash bubble (hire), fist (upgrade), padlock (open a zone). Cash flows into the tile in bundles and the number counts down; leaving midway keeps what was already paid.

## 5. Economy and balance

One fish converts to 20 coins in zone 1, so the player can hire the first fisher after 5 fish, about 60 seconds. The prices 100, 200 and 500 come from the video; the rest are proposals.

**Production values**

| Value | Starting point |
| --- | --- |
| Time to catch 1 fish | 2.0 seconds |
| Time to cook 1 fish | 1.5 seconds |
| Bowls from 1 fish | 4 bowls |
| Price of 1 soup bowl | 5 coins |
| Price of 1 sushi plate (zone 2) | 15 coins |
| Starting fish carry capacity | 1 fish |
| Starting bowl carry capacity | 8 bowls |
| Soldier eating rate at the counter | 4 bowls per second |
| Run speed | 5 m/second |

**Zone 1 unlock prices**

| Order | Unlock | Price (coins) | Effect |
| --- | --- | --- | --- |
| 1 | Fisher 1 | 100 | Catches and delivers fish at rod 1 |
| 2 | Fisher 2 | 100 | Rod 2 |
| 3 | Fisher 3 | 100 | Rod 3; the player no longer has to fish |
| 4 | Conveyor | 200 | Bowls reach the counter on their own |
| 5 | Gate to zone 2 | 500 | Grill and new customers |
| 6 | Second pot | 500 | Doubles cooking speed |

**Balance rules**

- The next unlock costs 60–90 seconds of income at that point in the game.
- Within a zone, prices rise about 1.5× per step; a new zone raises prices 4–5× and dish prices 3×.
- The bottleneck must move: once all fishers are hired the kitchen is slow, and after the second pot carrying is slow. The player always sees what to buy next.
- All numbers live in one configuration file so they can be tuned without changing code.

## 6. Progression and content

The first release has one map of 4 zones joined by locked gates, enough for about 2–3 hours of play. Zones 1 and 2 follow the video; zones 3 and 4 are proposed extensions.

| Zone | Ingredient | Dish | Customers | New mechanic |
| --- | --- | --- | --- | --- |
| 1. Fishing dock | Tuna | Fish soup | Black-armored soldiers | Hiring, conveyor |
| 2. Grill yard | Tuna | Sushi | Gold-armored soldiers | Two dishes from one ingredient, so fish must be split |
| 3. Rice field | Rice | Rice balls | Cavalry | A dish that combines two ingredients (rice + fish) |
| 4. Great hearth | Firewood | Hot pot | Generals | Blizzard: without firewood, customers pay less |

**In-session events**

- **Golden school:** every 3–5 minutes, golden fish appear for 20 seconds and sell for 5×.
- **General's visit:** a big customer orders 30 bowls within 60 seconds and rewards a chest of cash.
- **Blizzard (from zone 4):** the river freezes for 30 seconds, and fishing only works through an ice hole next to the hearth.

**After the first map.** Each new map is a different camp (mountain, coast, fortress) with its own ingredient set. Permanent progress carried over consists of outfits and an income multiplier.

## 7. UI/UX and feedback

Almost all interface lives inside the game world; the screen itself shows only the cash total in a top corner and a settings button.

**In-world interface**

- Prices are printed on the ground tiles and count down as the player pays.
- Bubbles above customers and workers waiting to be hired show what they need.
- Empty standing tiles have a white outline; locked tiles have a dark base and a padlock icon.

**Feedback (the part that decides how satisfying the game feels)**

| Moment | Visual | Sound and vibration |
| --- | --- | --- |
| Fish bites | Rod bends, line glows yellow, ripples | Line-tension sound |
| Fish is pulled out | Fish flies in an arc, white splash | Splash, light vibration |
| Picking up bowls | Each bowl hops onto the stack, which sways while running | Clacks rising in pitch |
| Soldiers eat | Bowls fly into the crowd, white puffs | Cheer |
| Cash drops | Bundles burst out, then get pulled to the character | Rapid coin sounds, vibration |
| Unlock | Tile flashes, the structure pops up with a bounce | Bell, strong vibration |

The stack on the character's back is the progress meter: let it grow taller than the frame and lean with inertia on turns.

## 8. Art and audio

The style is low-poly 3D chibi with bright colors and warm daylight; every asset must be made in-house or properly licensed.

- **Characters:** big head, short body, about 1,500 triangles. The player character needs 5 animations: idle, run, run while carrying, fish, pull the rod.
- **Soldiers:** one model of about 500 triangles, 2–3 armor color sets to tell customer types apart, 2 animations: wait and raise a hand.
- **Environment:** earthy orange wooden floor, round-post fences, green grass, a blue river with moving highlights, pink blossom trees at the edges. Each zone shifts the dominant color.
- **Items:** fish, bowls, plates and cash bundles all have simple shapes so they stack cleanly and stay light.
- **Shading:** flat cartoon-style coloring for every object, with a round blob shadow under characters in place of real shadows.
- **Music:** one cheerful 60–90 second loop with traditional instruments per zone.
- **Sound effects:** about 20 short sounds; pickup and cash sounds rise in pitch along a streak to build momentum.

## 9. System structure and performance

This section covers only the logical structure and performance requirements; tools and platform are left open.

**Logic blocks**

- **Station:** a shared template for every station, with input storage, output storage, processing time and a trigger area.
- **Carrier:** the carrying ability shared by the player and workers; it manages the back stack.
- **Worker:** loops 4 steps (go to source, take, go to destination, deliver) along a preset route, with no pathfinding of its own.
- **Unlock tile:** stores the amount still owed, the tile kind and what appears once it is paid.
- **Balance data:** prices, times and unlock order are kept apart from logic so they can be tuned without changing code.
- **Save progress:** saved after every unlock and on exit, with a timestamp for calculating offline income.

**Crowd performance**

A crowd of several hundred soldiers is the biggest performance risk. The target is smooth visuals with 400 soldiers on a mid-range device.

- All soldiers share one model and one simple animation set so they can be drawn in bulk.
- Only the front row has logic; the rest is decoration.
- Fish, bowls, cash and effects are reused instead of being created over and over.
- The back stack is merged into a single object once it passes 30 items.

## 10. Monetization and metrics

The main revenue source is rewarded ads the player chooses to watch; in-game purchases are secondary.

**Rewarded ads**

- Double income for 3 minutes.
- Triple the offline cash on return.
- Supply cart: a cart of cash passes every 2 minutes; watch an ad to claim it.
- Speed up workers for 2 minutes.

**In-game purchases**

- Remove interstitial ads permanently.
- Starter pack: an outfit and double carry capacity.
- Outfits and rod styles, with no effect on balance.

Interstitial ads start only after minute 5 and run at least 90 seconds apart, so they do not break the first 10 minutes.

**Metrics to track from the test release**

| Metric | Definition | Decision it informs |
| --- | --- | --- |
| Day-1 and day-7 retention | Share of players who come back | Whether the core loop is engaging enough |
| Drop-off by unlock step | Which tile players stop at | Where prices are too high |
| Session length | Minutes per launch | Content pacing |
| Ad views per player per day | How often players opt in | Which rewards are attractive |
| Cost per install vs. revenue per player | Acquisition spend against money earned | Whether to scale up promotion |

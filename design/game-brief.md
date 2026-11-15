# Game Brief: Fishing Camp

## In your words
Built from: `design/GDD.md` (the source of truth for numbers and feedback).

1. Map: Usual: all of zone 1 with its six unlocks, ending when the gate to zone 2 opens and the first sushi plate is sold.
2. Feel: Busy: a crowd that never stops, bowls flying, a new unlock every 30–60 s.
3. Look: Build it as the doc says. No specific game to point to; reference is the general look of arcade idle games: chunky low-poly chibi, orange wooden deck, blue river, tall stacks on the character's back. Keep everything original.
4. Controls: Usual: WASD/arrow keys plus click-and-drag or touch-drag as a floating joystick.
5. Saving: Usual: save after every unlock, offline income capped at 2 h.
6. Events: Usual: golden school only; general's visit and blizzard later.
7. Slice: A slice: a short session from start to finish.
Out of scope is fine: no ads or in-app purchases in this build.
After play: there are 2 grills but only one cooker, is it bug?
After play: yes please (both pots cooking in parallel, and a pot-boy at the second pot)
After play: and look like our initial yard too big so the user need to run a lot
After play: fishing area stuck and not center
After play: look like this game not have UI/UX for mobile? or require users to landscape to play in fullscreen?
After play: Portrait-first (fill any screen; portrait is the main way to play, landscape still works)
After play: not work on mobile, and look like icon/box buy fisher overlapse a little bit
After play: the fisher on the way we go, so users can easily make mistake spend unwanted money
After play: we should smaller fisher price title or place it another place, currently it so far the fisher position so easily misunderstanding
After play: why i press start on my PC it stuck
After play: there is a bug when money is increasing, users cant take money
After play: second grill is overlapsed with the door of second yard

**Pitch:** Run a riverside army camp's kitchen alone — catch fish, cook soup, feed an endless crowd of soldiers — then hire your way out of every job until the camp runs itself.

**Genre:** Arcade idle (management-tycoon + idle-incremental)

**Controls:** WASD / arrows, or click/touch-drag floating joystick (portrait-first on phones). Movement only; every action triggers by standing on a tile.

**Question:** Does carry → cook → serve → hire feel satisfying enough to keep someone playing through all six zone-1 unlocks?

**Hooks:** One input; the stack on your back grows taller than the frame; every upgrade removes a job you were just doing by hand.

**Intent:** soft or no failure *(from the GDD)* · payoff builds *(from the GDD)*

## Look and references
- Mood: bright, warm, bustling — a sunny chibi army camp that is always busy *(inferred (strong))*
- View: 3D (three.js, low-poly) · Camera: perspective tilted ~50°, turned 45°, follows with slight lag; on unlock glides to the new structure for 1.5 s and back
- Shapes: chunky and round; big-head short-body characters; soldiers are one shared model; fish, bowls, plates, cash are simple stackable shapes
- Palette: orange wooden deck (ground), blue river with moving highlights (water), green grass, round-post fences, pink blossom trees at edges; black-armored soldiers (zone 1), gold-armored (zone 2); yellow-gold for cash and glow. Warm light, cool blue-violet shadows *(guessed)*
- Rules: flat cartoon shading, no outlines *(guessed)*, round blob shadow under characters
- Signature: the back stack sways and leans with inertia on turns and grows past the top of the frame
- References: the general look of arcade idle games — nothing copied. Every figure drawn, no emoji, no plain circles.

## First minute
You stand on an orange deck by the river. An arrow at your feet points to a white-outlined tile beside a bamboo rod. You walk on; the rod bends and glows, and after 2 s a tuna arcs onto your back. The arrow points to the chef's board; the fish hops off as you walk in. The pot puffs and 4 bowls stack beside it. Walk past: bowls hop onto your back with rising clacks. Carry them to the fence counter: front-row soldiers grab them one by one, cash bursts and flies to you. Around 60 s, after 5 fish, you stand on the first price tile ("100"): cash streams in, the number counts down, and a fisher pops up and starts working rod 1 — the first job you no longer do yourself.

## Challenge
No losing; the pressure is the moving bottleneck. At first you are the bottleneck; after 3 fishers the kitchen is slow; after the second pot carrying is slow and the conveyor fixes it. Each next unlock costs 60–90 s of income; prices rise ~1.5× per step and the gate costs 500. Leaving a tile midway keeps what you paid. Zone 2's sushi pays 3× but splits the fish between two dishes.

## Core loop
- Fish → carry tuna to board → chef cooks → bowls stack by the pot
- Carry bowls to the counter → soldiers eat → cash bursts and flies to your back
- Stand on a price tile → cash drains in → hire / upgrade / open
- Each unlock takes over a job you did; you move to the new bottleneck
- Leads: management leads the floor, stations, workers and crowd; idle leads the prices, numbers and offline income.

## Goal & fail state
- A session is complete when the zone-2 gate opens, the grill runs and the first sushi plate is sold. No fail state.

## Features
- [x] Movement with floating joystick and keys; camera follows with lag and glides on unlocks
- [x] Back stack: one item type at a time, capacity; items fly on and drop off one by one; sway and lean
- [x] Stations: 3 rods, chef's board + soup pot, fence counter, conveyor, grill (zone 2)
- [x] Endless soldier crowd; front row has logic with want-bubbles, steps back and refills
- [x] Price tiles (hire / upgrade / open-zone icons) that drain cash and count down, keeping partial payment; cash flows only while you stand still on one
- [x] Workers: fishers (rod → board) and carrier/conveyor; workers never touch cash
- [x] Zone 1's six unlocks in the GDD's order and prices, then zone 2 (grill, sushi, gold soldiers)
- [x] Guide arrow to the next useful task for the first 3 minutes
- [x] Cash counter top corner; money rises from where it was made
- [x] Golden school: every 3–5 min, gold fish for 20 s selling at 5×
- [x] Save after every unlock (localStorage) + offline income capped at 2 h with a welcome-back popup
- [ ] Feedback from the GDD's table: splash, rising-pitch clacks, puffs, bell, pop-up bounce (synth sound)
- [x] Every number in a data file (`data/config.json`)
- [x] Second pot cooks in parallel: the chef cuts, each pot cooks its own fish and throws its own bowls; a pot-boy stirs the second pot
- [x] Phone play: fills any screen portrait-first, touch-first title, adaptive HUD, add-to-home-screen fullscreen
- [x] Zone 3, the rice field: paddy and pond, a rice cook making rice balls from rice + fish, cavalry customers, farmer and pond-fisher hires
- [x] Quick hands upgrade: the player fishes 1.5x faster at rods and the pond (GDD 4's third stat)
- [x] Carrier hires: yard carrier (sushi table -> counter) and field carrier (rice balls -> counter); never touch cash
- [x] General's visit: 30 bowls in 60 s at the soup counter earns a chest of cash (GDD 6)
- [x] Music: a synthesized 60-90 s loop per zone (koto, bamboo flute, taiko), crossfading as you walk between zones (GDD 8)
- [x] Zone 4, the great hearth: snowy yard, woodpile and ice hole, a hearth that cooks hot pots only while its fire burns, generals as customers, woodcutter and ice-fisher hires

## Your systems
- hiring workers · in the slice
- conveyor and upgrades · in the slice
- zone gates · in the slice
- offline income and save · in the slice
- golden school · in the slice
- general's visit · in the slice
- blizzard · later
- zone 3 (rice field) · in the slice
- zone 4 (great hearth) · in the slice
- rewarded ads and in-app purchases · later

## Keep
-

## Avoid
- Copying the source ad's game: its name, art, characters or UI
- Ads or in-app purchases in this build

## Out of scope
- Blizzard event: change it after play
- Prestige / new maps carrying outfits and multipliers: grow it
- Rewarded ads, interstitials and purchases: not built yet
- Long-run balance over 2–3 hours: grow it
- Save that follows you across devices: needs a server: not built yet

## Build order
1. The slice: movement, back stack, rod → board → pot → counter → cash, price tiles, the 6 zone-1 unlocks, gate → zone 2 → first sushi sold.
2. Workers and conveyor feeling right (moving bottleneck)
3. Save, offline income, golden school
4. Juice pass: sway, arcs, rising-pitch sounds, camera glides

---
**Kill condition:** if carrying the stack still feels like a chore after two tuning rounds of speed and capacity *(guessed)*.

**Who it's for / what they feel:** casual players 16–40 in 3–10 minute sessions; the feeling of visible growth.

**Games you love / don't:** the general look of arcade idle games.

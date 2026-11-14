# Grow record: fishing-camp

Grown from `prototypes/fishing-camp/` at commit `f6e0818` (first build tagged `one-shot/fishing-camp`,
iteration 8 accepted). The one-shot folder was not edited, moved or deleted.

| Step | What | Result | Seen in |
|---|---|---|---|
| 1 Reference | Same-seed replay of the one-shot, about 60 s of the opening loop | `exact yes` (two runs identical), 0 errors | `reference.png` |
| 2 Copy | Vite + TypeScript scaffold at the root; game still JavaScript; three.js 0.186.1 pinned from npm; manifest + icon in `public/` | `match yes` against the reference, 0 errors | `copy.png` |
| 3 TypeScript | Split into `src/game/` (rules, random, unlock table, types: no browser), `screen.ts`, `audio.ts`, `config.ts`, `main.ts` (scenes, world, simulation, loop); `strict` on, `tsc --noEmit` clean | `match yes`, 0 errors (re-run after the rod table moved to `game/unlocks.ts`: still `match yes`) | `typescript.png` |
| 4 Rules under test | `tests/unit/rules.test.ts`: 13 Vitest tests (money per fish, gold multiplier, first-fisher price, pay bundles, carry caps, offline cap, tile shape, no tile overlaps, walkable yard, money text). `tests/integration/boot.spec.ts`: `@boot` + opening walk with same-seed repeat | 13/13 + 2/2 pass. Seen failing first: dish price rule broken (×2), and the iteration-5 fisher tile put back over a rod tile | — |
| 5 Record | `engine.name: Web`, `engine.version: 8.3.4` written; CLAUDE.md stack lines and engine reference import filled | `npm run build` ok · `test-run.sh web`: `web:pass`, 15/15 · `npm run smoke`: 1 passed | — |

`typescript.png` and `reference.png` were looked at side by side: the same frame.

**NOT ASSESSED:** nothing.

**Still `Loose` (typing still to do):** the world objects built field by field in `src/main.ts`:
carriers (player and workers), rods, piles, stations (`processors`), counters with their crowds,
price tiles, tweens, particles, the camera/effects bag (`fx`), the conveyor (`belt`), the figures
scene, the scenes table, and the run `state`. 136 uses of `Loose` in `main.ts`; none in `src/game/`.

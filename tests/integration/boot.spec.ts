// Playwright: the single-file build opened from disk, driven through the
// game-state hook (src/hook.ts). npm run smoke runs only the @boot test.
import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const build = (query: string): string => `${pathToFileURL(resolve('dist-single/index.html')).href}?${query}`;

/** Opens the build and collects every page error and console error. */
async function open(page: Page, query: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(build(query));
  // Until the game installs its hook, window.game is the canvas (an element's id is a window
  // property), so wait for the hook itself.
  await expect.poll(() => page.evaluate(() => typeof window.game?.step)).toBe('function');
  return errors;
}

test('boots to the title screen with no errors @boot', async ({ page }) => {
  const errors = await open(page, 'manual=1&fresh=1');
  expect(await page.evaluate(() => window.game!.scene)).toBe('title');
  const size = await page.locator('#game').boundingBox();
  expect(size && size.width > 0 && size.height > 0).toBe(true);
  expect(errors).toEqual([]);
});

test('the opening walk to the first rod plays, and the same seed repeats it exactly', async ({ page }) => {
  // The reference replay's opening: Enter, up 0.65 s, right 0.34 s, then stand at the rod 2.4 s.
  async function run(): Promise<{ scene: string; t: number; done: string[]; state: unknown; errors: string[] }> {
    const errors = await open(page, 'manual=1&seed=7&fresh=1');
    const out = await page.evaluate(() => {
      const g = window.game!;
      g.press('Enter'); g.step(1, false);
      g.hold('ArrowUp', true); g.step(39, false); g.hold('ArrowUp', false);
      g.hold('ArrowRight', true); g.step(20, false); g.hold('ArrowRight', false);
      g.step(144);
      const s = g.state as { t: number; done: string[] };
      return { scene: g.scene, t: s.t, done: s.done, state: JSON.parse(JSON.stringify(g.state)) };
    });
    return { ...out, errors };
  }
  const first = await run();
  expect(first.scene).toBe('play');
  expect(first.t).toBeCloseTo(204 / 60, 6); // 1 + 39 + 20 + 144 steps; the title's clock runs too
  expect(first.done).toEqual([]);
  expect(first.errors).toEqual([]);
  expect(await run()).toEqual(first);
});

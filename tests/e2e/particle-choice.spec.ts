import { expect, test, type Page } from '@playwright/test';
import { seedSettings, tap } from './helpers';

// éist le can cross the 'le' already down in cuir suas le, or take 'le' from the river; the river way is a
// fresh line and draws 2. With both open, the builder waits for the player to tap the particle.
async function position(page: Page) {
  await page.evaluate(() => {
    const c = (window as any).__game;
    const s = structuredClone(c.gs.value);
    s.board = [
      { id: 9001, k: 'V', t: 'cuir', x: 0, y: 0, axis: null, owner: 1 },
      { id: 9002, k: 'P', t: 'suas', x: 1, y: 0, axis: 'h', owner: 1 },
      { id: 9003, k: 'P', t: 'le', x: 2, y: 0, axis: 'h', owner: 1 },
      { id: 9004, k: 'M', t: 'm35', x: 3, y: 0, axis: null, owner: 1, used: 'PUT UP WITH' },
    ];
    s.lines = [{ p: 1, c: 'c08', g: 'PUT UP WITH', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], wild: false, straddle: false, turnNo: 1 }];
    s.piles = [['ar'], ['le'], ['amach'], ['do'], ['as']].map((p: string[], i: number) => p.map((t) => ({ id: 9100 + i, k: 'P', t })));
    s.hands[0] = [{ id: 9201, k: 'M', t: 'm01' }, { id: 9202, k: 'V', t: 'éist' }, { id: 9205, k: 'V', t: 'fan' }];
    s.turn = 0;
    c.gs.value = s;
    c.botPlaying.value = null;
    c.clearSelection();
  });
  await page.locator('.tray [data-card="9201"]').click();
  await page.locator('.tray [data-card="9202"]').click();
  await expect(page.locator('.th-title')).toHaveText('From the table or the river?');
  expect(await page.evaluate(() => (window as any).__game.gs.value.lines.length)).toBe(1);
}

test.beforeEach(async ({ page }) => {
  await seedSettings(page);
  await page.goto('./?e2e&seed=3');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
});

test('table particle or river: nothing is laid until the player taps one; the table one draws nothing', async ({ page }) => {
  await position(page);
  await page.locator('.board-fit').click();
  await page.waitForTimeout(400);
  await tap(page, '[data-cell="2,0"] .ba-card');
  await expect.poll(() => page.evaluate(() => (window as any).__game.gs.value.lines.length)).toBe(2);
  const s = await page.evaluate(() => { const g = (window as any).__game.gs.value; return { straddle: g.lines[1].straddle, hand: g.hands[0].length, river: g.piles[1].length }; });
  expect(s).toEqual({ straddle: true, hand: 2, river: 1 }); // fan, and a meaning card refilled
});

test('…and the river one takes the card and draws 2', async ({ page }) => {
  await position(page);
  await page.locator('[data-pile="1"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__game.gs.value.lines.length)).toBe(2);
  const s = await page.evaluate(() => { const g = (window as any).__game.gs.value; return { straddle: g.lines[1].straddle, hand: g.hands[0].length }; });
  expect(s).toEqual({ straddle: false, hand: 4 }); // fan, 2 drawn, a meaning card refilled
});

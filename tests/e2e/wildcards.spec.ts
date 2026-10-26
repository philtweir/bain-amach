import { expect, test } from '@playwright/test';
import { seedSettings } from './helpers';

test('a line that needs a wildcard waits for the player to tap it', async ({ page }) => {
  await seedSettings(page);
  await page.goto('./?e2e&seed=3');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  // Your turn, LISTEN TO in hand, éist in hand, two wildcards, and no 'le' anywhere on the river.
  await page.evaluate(() => {
    const c = (window as any).__game;
    const s = structuredClone(c.gs.value);
    s.board = [{ id: 9001, k: 'V', t: 'cuir', x: 0, y: 0, axis: null, owner: -1 }];
    s.piles = [['ar'], ['do'], ['amach'], ['suas'], ['as']].map((p: string[], i: number) => p.map((t) => ({ id: 9100 + i, k: 'P', t })));
    s.hands[0] = [{ id: 9201, k: 'M', t: 'm01' }, { id: 9202, k: 'V', t: 'éist' }, { id: 9203, k: 'W', t: '*' }, { id: 9204, k: 'W', t: '*' }, { id: 9205, k: 'V', t: 'fan' }];
    s.turn = 0;
    c.gs.value = s;
    c.botPlaying.value = null;
    c.clearSelection();
  });
  await page.locator('.tray [data-card="9201"]').click();
  await page.locator('.tray [data-card="9202"]').click();
  await expect(page.locator('.th-title')).toHaveText('Use your wildcard?');
  expect(await page.evaluate(() => (window as any).__game.gs.value.lines.length)).toBe(0);
  // Tap the second wildcard: that's the one spent.
  await page.locator('.tray [data-card="9204"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__game.gs.value.lines.length)).toBe(1);
  const hand = await page.evaluate(() => (window as any).__game.gs.value.hands[0].map((c: any) => c.id));
  expect(hand).toContain(9203);
  expect(hand).not.toContain(9204);
});

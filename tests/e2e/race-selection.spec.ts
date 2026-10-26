import { expect, test, type Page } from '@playwright/test';
import { seedSettings, waitForMyTurn } from './helpers';

// Another player's move can change the table under a half-built line (in a race, at any moment).
// These tests change the state directly, as that move would, and check what the selection keeps.

async function startWithLitRiver(page: Page) {
  await seedSettings(page);
  await page.goto('./?e2e&seed=4242');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  expect(await waitForMyTurn(page)).toBe(true);
  const meanings = page.locator('.tray .lane-scroll .ba-meaning');
  const n = await meanings.count();
  for (let k = 0; k < n; k++) {
    await meanings.nth(k).click();
    if (await page.locator('.river .ba-card.is-lit').count()) return meanings.nth(k);
    await meanings.nth(k).click(); // deselect and try the next one
  }
  throw new Error('no meaning card lights the river on this seed');
}

/** Take the top card off river piles, as another player's line would, then recheck the selection. */
async function takeTops(page: Page, which: 'lit' | 'picked', dropWildcards = false) {
  await page.evaluate(([which, dropWildcards]) => {
    const c = (window as any).__game;
    const s = structuredClone(c.gs.value);
    const piles: number[] = which === 'lit' ? [...c.lit.value.river] : [...c.sel.value.river];
    for (const i of piles) s.piles[i].pop();
    // Without wildcards no line survives the loss, which is the case under test.
    if (dropWildcards) s.hands[c.viewer.value] = s.hands[c.viewer.value].filter((x: { k: string }) => x.k !== 'W');
    c.gs.value = s;
    c.validateSelection();
  }, [which, dropWildcards] as const);
}

test('lit options someone else takes just go: no toast, your meaning card stays picked', async ({ page }) => {
  const meaning = await startWithLitRiver(page);
  // Keep taking whatever lights up until nothing does.
  for (let i = 0; i < 6 && (await page.locator('.river .ba-card.is-lit').count()); i++) await takeTops(page, 'lit', true);
  expect(await page.evaluate(() => (window as any).__game.lit.value.river.size)).toBe(0);
  await expect(meaning).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ba-toast', { hasText: 'Taken' })).toHaveCount(0);
});

test('a river card you picked that someone takes: a Taken toast, the rest of the line stays', async ({ page }) => {
  const meaning = await startWithLitRiver(page);
  await page.locator('.river .ba-stack:has(.ba-card.is-lit)').first().click();
  expect(await page.evaluate(() => (window as any).__game.sel.value.river.length)).toBe(1);
  await takeTops(page, 'picked');
  await expect(page.locator('.ba-toast', { hasText: 'Taken' })).toBeVisible();
  await expect(meaning).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => (window as any).__game.sel.value.river.length)).toBe(0);
});

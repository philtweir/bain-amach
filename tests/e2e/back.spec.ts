import { expect, test } from '@playwright/test';
import { seedSettings, waitForMyTurn } from './helpers';

// The hardware back button (history back) behaves like a native app: it pops screens, closes
// sheets, opens Pause on the table, and never leaves the app mid-game.
test('back button: screens pop, the table pauses, the pause sheet closes', async ({ page }) => {
  await seedSettings(page);
  await page.goto('./?e2e&seed=9');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();

  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await waitForMyTurn(page);
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await page.goBack(); // straight away, as a quick double press would
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden();
  await expect(page.locator('.table')).toBeVisible();

  // Rules from the pause menu, then back returns to the paused table with the same game.
  const before = await page.evaluate(() => JSON.stringify((window as any).__game.gs.value));
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Rules' }).click();
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
  await page.goBack();
  await expect(page.locator('.table')).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify((window as any).__game.gs.value))).toBe(before);
});

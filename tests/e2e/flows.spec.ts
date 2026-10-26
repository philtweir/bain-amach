import { expect, test } from '@playwright/test';
import { playTurn, seedSettings, waitForMyTurn } from './helpers';

test('a full turn-mode game against a bot, to the recap', async ({ page }) => {
  await seedSettings(page);
  await page.goto('./?e2e&seed=4242');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  let lines = 0;
  while (await waitForMyTurn(page)) if ((await playTurn(page)) === 'line') lines++;
  await expect(page.locator('.end-card')).toBeVisible();
  await page.getByRole('button', { name: 'See recap' }).click();
  await expect(page.getByText('Compounds made')).toBeVisible();
  await expect(page.locator('.recap .list-row').first()).toBeVisible();
  expect(lines).toBeGreaterThan(0);
  // The glossary picked up what this player made.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.glossary-card')).toContainText(/[1-9]\d* of 36 made/);
});

test('reload mid-game, then Continue restores the exact state', async ({ page }) => {
  await seedSettings(page);
  await page.goto('./?e2e&seed=777');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await waitForMyTurn(page);
    await playTurn(page);
  }
  await waitForMyTurn(page);
  const before = await page.evaluate(() => JSON.stringify((window as any).__game.gs.value));
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.table')).toBeVisible();
  const after = await page.evaluate(() => JSON.stringify((window as any).__game.gs.value));
  expect(after).toBe(before);
});

test('works offline after the first load', async ({ page, context }) => {
  await seedSettings(page);
  await page.goto('./?e2e');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    return !!reg.active;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
  // Fonts come from the precache too.
  expect(await page.evaluate(() => document.fonts.check('800 20px "Bricolage Grotesque"'))).toBe(true);
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.river .ba-pile')).toHaveCount(5);
});

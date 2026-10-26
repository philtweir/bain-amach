import { expect, test } from '@playwright/test';
import { playTurn, seedSettings, waitForMyTurn } from './helpers';

test('tapping a meaning card on the table shows all three of its meanings', async ({ page }) => {
  await seedSettings(page);
  await page.goto('./?e2e&seed=4242');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  // Play until a meaning card is on the table and visible.
  const tableMeaning = page.locator('.board .cell .ba-meaning');
  for (let i = 0; i < 12 && !(await tableMeaning.count()); i++) {
    if (!(await waitForMyTurn(page))) break;
    await playTurn(page);
  }
  await waitForMyTurn(page);
  // Let any pop-up of an opponent's new card clear first: it sits over the board.
  const pop = page.locator('.peek.is-new');
  while (await pop.count()) await page.mouse.click(5, 300);
  await page.locator('.board-fit').click();
  await page.waitForTimeout(400);
  const box = (await tableMeaning.first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const peek = page.locator('.peek:not(.is-new)');
  await expect(peek).toBeVisible();
  await expect(peek.locator('.ba-m')).toHaveCount(3);
  await expect(peek).toContainText('any of these can end a new line');
});

test("an opponent's new meaning card pops up in full view, and a tap dismisses it", async ({ page }) => {
  await seedSettings(page);
  await page.goto('./?e2e&seed=4242');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const pop = page.locator('.peek.is-new');
  // Pass until the bot lays a line with a meaning card of its own.
  for (let i = 0; i < 15 && !(await pop.count()); i++) {
    if (!(await waitForMyTurn(page))) break;
    if (await pop.count()) break;
    await page.getByRole('button', { name: /Draw and pass|^Pass$/ }).click();
    await page.waitForTimeout(300);
  }
  await expect(pop).toBeVisible({ timeout: 15_000 });
  await expect(pop.locator('.ba-m')).toHaveCount(3);
  await expect(pop).toContainText('New on the table from B');
  // A tap anywhere dismisses it; it never blocks the table underneath.
  const box = (await pop.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(pop).toBeHidden();
});

test('a game saved before the rule change picks the new rules up on Continue', async ({ page }) => {
  await seedSettings(page);
  await page.goto('./?e2e&seed=31');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await waitForMyTurn(page);
  // Rewrite the save as an old build would have written it: no rules field.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('ba.game')!);
    delete raw.data.state.config.rules;
    localStorage.setItem('ba.game', JSON.stringify(raw));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  expect(await page.evaluate(() => (window as any).__game.gs.value.config.rules)).toEqual({ refillMeaning: true, tableMeanings: true, freshLineDraw: 2, swapRefresh: true });
});

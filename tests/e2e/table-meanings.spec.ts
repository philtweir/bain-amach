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
  await page.locator('.board-fit').click();
  await page.waitForTimeout(400);
  const box = (await tableMeaning.first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const peek = page.locator('.peek');
  await expect(peek).toBeVisible();
  await expect(peek.locator('.ba-m')).toHaveCount(3);
  await expect(peek).toContainText('any of these can end a new line');
});

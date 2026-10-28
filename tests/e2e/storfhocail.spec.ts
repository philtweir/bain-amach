import { expect, test, type Page } from '@playwright/test';
import { seedSettings } from './helpers';

// spec/storfhocal.md §12: unlock and visibility, the bag, the glossary, and a game that lays one and wins.
async function seedSf(page: Page, data: Record<string, unknown>) {
  await page.addInitScript((d) => {
    if (!localStorage.getItem('ba.sf')) localStorage.setItem('ba.sf', JSON.stringify({ v: 1, data: d }));
  }, data);
}
const sfSection = (page: Page) => page.locator('.sec', { has: page.locator('.sec-label', { hasText: 'Stórfhocail' }) });

test('the toggle: locked with its count at 19 games, the secret unlocks it, open at 20; never in pass-and-play', async ({ page }) => {
  await seedSettings(page);
  await seedSf(page, { finishedSoloGames: 19 });
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(sfSection(page)).toContainText('19 of 20');
  await expect(page.getByRole('switch', { name: 'Play with stórfhocail' })).toHaveCount(0);
  // The secret: seven quick taps on the locked row.
  for (let i = 0; i < 7; i++) await sfSection(page).locator('.sf-locked').click();
  const toggle = page.getByRole('switch', { name: 'Play with stórfhocail' });
  await expect(toggle).toBeVisible();
  // Only Hard bots carry stórfhocail: with an Easy bot it is off and can't be turned on.
  await expect(toggle).toBeDisabled();
  await expect(sfSection(page)).toContainText('Needs a Hard bot');
  await page.getByRole('radio', { name: 'Pass-and-play' }).click();
  await expect(sfSection(page)).toHaveCount(0);
});

test('at 20 finished solo games the toggle shows; it starts off every new game', async ({ page }) => {
  await seedSettings(page);
  await seedSf(page, { finishedSoloGames: 20 });
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.locator('.bot-row').first().getByRole('radio', { name: 'Hard' }).click();
  const toggle = page.getByRole('switch', { name: 'Play with stórfhocail' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(toggle).toBeEnabled();
});

test('the bag stays off Home until the first tile, and stays once revealed even when empty', async ({ page }) => {
  await seedSettings(page);
  await seedSf(page, { finishedSoloGames: 3 });
  await page.goto('./');
  await expect(page.locator('.bag-card')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('ba.sf', JSON.stringify({ v: 1, data: { bagRevealed: true, owned: {}, seen: { s05a: { times: 1, last: 'd' } } } })));
  await page.reload();
  await page.locator('.bag-card').click();
  await expect(page.locator('.hdr-right')).toHaveText('0 / 26');
  // Seen but not owned: outlined, word shown; never seen: blank.
  await expect(page.locator('.bag-slot.is-seen')).toHaveCount(1);
  await expect(page.locator('.bag-slot.is-seen')).toContainText('geit');
  await expect(page.locator('.bag-slot.is-unseen')).toHaveCount(25);
});

test('the glossary lists a phrase only once it has been laid or its tile is owned', async ({ page }) => {
  await seedSettings(page);
  await seedSf(page, { bagRevealed: true, owned: { s06: 1 }, seen: { s05a: { times: 2, last: 'd' } } });
  await page.goto('./');
  await page.locator('.glossary-card').click();
  const rows = page.locator('.sf-gloss .g-row');
  await expect(rows).toHaveCount(3); // geit (seen), and greim's two phrases (owned)
  await expect(page.locator('.sf-gloss')).toContainText('bain geit as');
  await expect(page.locator('.sf-gloss')).toContainText('coinnigh greim ar');
  await expect(page.locator('.sf-gloss')).not.toContainText('aire');
});

test('bring a tile in, lay it to go out, and win the bot’s tile on the table', async ({ page }) => {
  test.setTimeout(90000);
  await seedSettings(page);
  await seedSf(page, { finishedSoloGames: 20, bagRevealed: true, owned: { s01: 1 }, seen: { s05a: { times: 1, last: 'd' } } });
  await page.goto('./?e2e&seed=21');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.locator('.bot-row').first().getByRole('radio', { name: 'Hard' }).click();
  await page.getByRole('switch', { name: 'Play with stórfhocail' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  // Your turn, tabhair your only card, 'do' on the river, and the bot has already laid geit.
  await page.evaluate(() => {
    const c = (window as any).__game;
    const s = structuredClone(c.gs.value);
    s.turn = 0;
    s.hands[0] = [{ id: 9301, k: 'V', t: 'tabhair' }];
    s.piles[0].push({ id: 9302, k: 'P', t: 'do' });
    s.sf.laid.push({ word: 's05', phrase: 's05a', p: 1 });
    c.gs.value = s;
    c.botPlaying.value = null;
    c.clearSelection();
  });
  await page.getByRole('button', { name: /Your bag/ }).click();
  await page.locator('.sf-pick', { hasText: 'aire' }).getByRole('button', { name: 'Bring in' }).click();
  await expect(page.getByText("If you lay aire and don't win, the winner keeps it.")).toBeVisible();
  await page.getByRole('button', { name: 'Bring it in' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.locator('.pouch [data-tile="s01"]').click();
  await page.locator('.tray [data-card="9301"]').click();
  await page.getByRole('button', { name: 'See recap' }).click({ timeout: 20000 });
  await expect(page.locator('.sf-recap')).toContainText('You won geit');
  await expect(page.locator('.sf-recap')).toContainText('aire goes back to your bag');
  const pr = await page.evaluate(() => JSON.parse(localStorage.getItem('ba.sf')!).data);
  expect(pr.owned).toEqual({ s01: 1, s05: 1 });
  expect(pr.finishedSoloGames).toBe(21);
  expect(pr.seen.s01a.times).toBe(1);
});

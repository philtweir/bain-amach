import { expect, test, type Page } from '@playwright/test';
import { seedSettings } from './helpers';

// spec/storfhocal.md §12: unlock and visibility, the bag, the glossary, and a game that lays one and wins.
async function seedSf(page: Page, data: Record<string, unknown>) {
  await page.addInitScript((d) => {
    if (!localStorage.getItem('ba.sf')) localStorage.setItem('ba.sf', JSON.stringify({ v: 1, data: d }));
  }, data);
}
const sfSection = (page: Page) => page.locator('.sf-sec');

test('the toggle: locked with its count at 19 games, the secret unlocks it; no Hard bot gives a note; never in pass-and-play', async ({ page }) => {
  await seedSettings(page);
  await seedSf(page, { finishedGames: 19 });
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(sfSection(page)).toContainText('19 of 20');
  await expect(sfSection(page).getByRole('radio', { name: 'On', exact: true })).toHaveCount(0);
  // The secret: seven quick taps on the locked row.
  for (let i = 0; i < 7; i++) await sfSection(page).locator('.sf-locked').click();
  const on = sfSection(page).getByRole('radio', { name: 'On', exact: true });
  await expect(on).toBeEnabled();
  // Only Hard bots lay tiles: with an Easy bot it stays available, with a note.
  await on.click();
  await expect(sfSection(page)).toContainText('Tiles appear only with a Hard bot');
  await page.getByRole('radio', { name: 'Pass-and-play' }).click();
  await expect(sfSection(page)).toHaveCount(0);
});

test('at 20 finished games the choice shows, off on a new install, and it remembers the last setting', async ({ page }) => {
  await seedSettings(page);
  await seedSf(page, { finishedGames: 20 });
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.locator('.bot-row').first().getByRole('radio', { name: 'Hard' }).click();
  const off = sfSection(page).getByRole('radio', { name: 'Off', exact: true });
  await expect(off).toHaveAttribute('aria-checked', 'true');
  await sfSection(page).getByRole('radio', { name: 'On', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: /Save and quit|Quit/ }).first().click();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(sfSection(page).getByRole('radio', { name: 'On', exact: true })).toHaveAttribute('aria-checked', 'true');
});

test('the bag stays off Home until the first tile, stays once revealed even when empty, and never spoils a word', async ({ page }) => {
  await seedSettings(page);
  await seedSf(page, { finishedGames: 3 });
  await page.goto('./');
  await expect(page.locator('.bag-card')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('ba.sf', JSON.stringify({ v: 1, data: { bagRevealed: true, owned: {}, seen: { s05a: { times: 1, last: 'd' } } } })));
  await page.reload();
  await page.locator('.bag-card').click();
  await expect(page.locator('.hdr-right')).toHaveText('0 of 26');
  await expect(page.locator('.bag-slot.is-empty')).toHaveCount(26);
  await expect(page.locator('.bag-grid')).not.toContainText('geit');
});

test('a restore point at 10 tiles brings the bag back, only into an empty bag', async ({ page }) => {
  await seedSettings(page);
  const ten = Object.fromEntries(['s01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10'].map((w) => [w, 1]));
  await seedSf(page, { finishedGames: 30, bagRevealed: true, owned: ten });
  await page.goto('./');
  await page.locator('.bag-card').click();
  await expect(page.locator('.restore-point')).toContainText('10 collected');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save restore point' }).click();
  const code = (await (await dl).createReadStream().then(async (st) => {
    const parts: Buffer[] = [];
    for await (const ch of st!) parts.push(ch as Buffer);
    return Buffer.concat(parts).toString('utf8');
  })).trim();
  expect(code).toMatch(/^BA1-/);
  await expect(page.locator('.restore-point')).toHaveCount(0);
  // Storage lost: an empty bag. Restore from Settings.
  await page.evaluate(() => localStorage.setItem('ba.sf', JSON.stringify({ v: 1, data: { finishedGames: 30 } })));
  await page.goto('./');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByText('Restore your Stórfhocail').click();
  await page.getByRole('button', { name: 'Restore a bag from its code' }).click();
  await page.getByRole('textbox', { name: 'Restore code' }).fill(code);
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.locator('.hdr-right')).toHaveText('10 of 26');
  await expect(page.locator('.restore-point')).toHaveCount(0);
});

test('the glossary lists a phrase in its verb’s group only once it has been laid or its tile is owned', async ({ page }) => {
  await seedSettings(page);
  await seedSf(page, { bagRevealed: true, owned: { s06: 1 }, seen: { s05a: { times: 2, last: 'd' } } });
  await page.goto('./');
  await page.locator('.glossary-card').click();
  const rows = page.locator('.g-row.sf-gloss');
  await expect(rows).toHaveCount(3); // geit (seen), and greim's two phrases (owned)
  await expect(page.locator('.g-group', { hasText: 'bain geit as' })).toContainText('seen 2×');
  await expect(page.locator('.g-group', { hasText: 'coinnigh greim ar' })).toContainText('in your bag');
  await expect(page.locator('.glossary')).not.toContainText('tabhair aire do');
});

test('take a tile from the bag, lay it to go out, and win the bot’s tile on the table', async ({ page }) => {
  test.setTimeout(90000);
  await seedSettings(page);
  await seedSf(page, { finishedGames: 20, bagRevealed: true, owned: { s01: 1 }, seen: { s05a: { times: 1, last: 'd' } } });
  await page.goto('./?e2e&seed=21');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.locator('.bot-row').first().getByRole('radio', { name: 'Hard' }).click();
  await sfSection(page).getByRole('radio', { name: 'On', exact: true }).click();
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
  await expect(page.locator('.ba-stake')).toBeVisible();
  await page.getByRole('button', { name: 'Stórfhocail' }).click();
  await expect(page.locator('.sf-row.is-selected')).toContainText('tabhair aire do');
  await expect(page.locator('.sf-warn')).toContainText('If you lay aire and lose, Giorria keeps it.');
  await page.getByRole('button', { name: 'Take aire' }).click();
  await page.locator('.tray [data-tile="s01"]').click();
  await page.locator('.tray [data-card="9301"]').click();
  await page.getByRole('button', { name: 'See recap' }).click({ timeout: 20000 });
  await expect(page.locator('.recap .sf-rows-block')).toContainText('geit joins your bag');
  await expect(page.locator('.recap .sf-rows-block')).toContainText('aire stays in your bag');
  const pr = await page.evaluate(() => JSON.parse(localStorage.getItem('ba.sf')!).data);
  expect(pr.owned).toEqual({ s01: 1, s05: 1 });
  expect(pr.finishedGames).toBe(21);
  expect(pr.wonFrom.s05.name).toBe('Giorria');
  expect(pr.seen.s01a.times).toBe(1);
});

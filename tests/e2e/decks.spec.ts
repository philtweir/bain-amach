import { expect, test } from '@playwright/test';
import { seedSettings } from './helpers';

// Deck editor acceptance (feature plan): make a deck from Standard, change it (it saves as you go), test
// it with bots, play with it; a game saved with a custom deck plays on unchanged after the deck is deleted.
test('make a deck, test it, play it; deleting it never breaks the saved game', async ({ page }) => {
  test.setTimeout(180000);
  await seedSettings(page);
  await page.goto('./?e2e&seed=5');
  await page.getByRole('button', { name: 'Decks' }).click();
  await page.getByRole('button', { name: 'New deck from Standard' }).click();
  // Rename it from the menu.
  await page.getByRole('button', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.locator('.name-input').fill('Adverbs');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.hdr-title')).toHaveText('Adverbs');
  // Adverbs only: no prepositions.
  for (const w of ['ar', 'le', 'as', 'do', 'de', 'faoi', 'ó']) {
    const less = page.getByRole('button', { name: 'One fewer ' + w, exact: true });
    while (!(await less.isDisabled())) await less.click();
  }
  await expect(page.locator('.ba-fit.is-ok').first()).toBeVisible();
  // Fewer meaning cards: 18.
  await page.getByRole('radio', { name: 'Meanings' }).click();
  const cards = page.getByRole('group', { name: 'Meaning cards' });
  while (Number(await cards.locator('output').textContent()) > 18) await cards.getByRole('button', { name: 'One fewer Meaning cards' }).click();
  await page.getByRole('button', { name: 'Test with bots' }).click();
  await expect(page.locator('.ts-grid')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('.ts-stat')).toHaveCount(4);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.deck-card .dc-name', { hasText: /^Adverbs$/ })).toBeVisible();

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await page.locator('.deck-row-btn').click();
  await page.locator('.dp-row', { hasText: 'Adverbs' }).click();
  await expect(page.locator('.deck-row-btn')).toContainText('Adverbs');
  const note = (await page.locator('.deck-note').textContent()) ?? '';
  const hands = Number(/Hands of (\d+)/.exec(note)?.[1]);
  expect(hands).toBeGreaterThanOrEqual(7);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const before = await page.evaluate(() => {
    const s = (window as any).__game.gs.value;
    return { name: s.config.deck?.custom?.name, cards: s.hands[0].filter((c: any) => c.k === 'M').map((c: any) => c.t), hand: s.hands[0].length };
  });
  expect(before.name).toBe('Adverbs');
  expect(before.cards.every((t: string) => t.startsWith('x'))).toBe(true);
  expect(before.hand).toBe(hands);

  // Save and quit, delete the deck (it says a saved game uses it), continue.
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: /Save and quit|Quit/ }).first().click();
  await page.getByRole('button', { name: 'Decks' }).click();
  await expect(page.locator('.deck-card', { hasText: 'Adverbs' })).toContainText('In use by a saved game');
  await page.getByRole('button', { name: 'Edit Adverbs' }).click();
  await page.getByRole('button', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.deck-card .dc-name', { hasText: /^Adverbs$/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const after = await page.evaluate(() => {
    const s = (window as any).__game.gs.value;
    return { name: s.config.deck?.custom?.name, cards: s.hands[0].filter((c: any) => c.k === 'M').map((c: any) => c.t), hand: s.hands[0].length };
  });
  expect(after).toEqual(before);
  // The table still shows the deck's meanings (from the embedded deck, not the stored one).
  await expect(page.locator('.tray .ba-meaning').first()).not.toBeEmpty();
});

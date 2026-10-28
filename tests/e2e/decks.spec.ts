import { expect, test } from '@playwright/test';
import { seedSettings } from './helpers';

// spec/deck-editor.md acceptance: make a deck, test it, play with it; a game saved with a custom deck
// plays on unchanged after the deck is deleted.
test('make a deck, test it, play it; deleting it never breaks the saved game', async ({ page }) => {
  test.setTimeout(120000);
  await seedSettings(page);
  await page.goto('./?e2e&seed=5');
  await page.locator('.decks-card').click();
  await page.getByRole('button', { name: /Default/ }).click();
  await page.getByRole('button', { name: 'Copy, 2-player counts' }).click();
  // Adverbs only: no prepositions.
  for (const w of ['ar', 'le', 'as', 'do', 'de', 'faoi', 'ó']) {
    const row = page.locator('.step-row', { has: page.locator('.row-label', { hasText: new RegExp('^' + w + '$') }) });
    const less = row.getByRole('button', { name: 'One fewer ' + w });
    while (!(await less.isDisabled())) await less.click();
  }
  await page.locator('.deck-name').fill('Adverbs');
  // Fewer meaning cards: 18.
  const cards = page.locator('.step-row', { has: page.locator('.row-label', { hasText: /^Meaning cards$/ }) });
  const value = cards.locator('.step-n');
  while (Number(await value.textContent()) > 18) await cards.getByRole('button', { name: 'One fewer Meaning cards' }).click();
  await page.getByRole('button', { name: 'Play 50 bot games' }).click();
  await expect(page.getByText(/lines a game/)).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.deck-row .row-label', { hasText: /^Adverbs$/ })).toBeVisible();

  await page.goBack();
  await page.getByRole('button', { name: 'New game' }).click();
  await page.locator('.deck-select').selectOption({ label: 'Adverbs' });
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

  // Save and quit, delete the deck, continue.
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: /Save and quit|Quit/ }).first().click();
  await page.locator('.decks-card').click();
  await page.locator('.deck-row .row-btn', { has: page.locator('.row-label', { hasText: /^Adverbs$/ }) }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.deck-row .row-label', { hasText: /^Adverbs$/ })).toHaveCount(0);
  await page.goBack();
  await page.getByRole('button', { name: 'Continue' }).click();
  const after = await page.evaluate(() => {
    const s = (window as any).__game.gs.value;
    return { name: s.config.deck?.custom?.name, cards: s.hands[0].filter((c: any) => c.k === 'M').map((c: any) => c.t), hand: s.hands[0].length };
  });
  expect(after).toEqual(before);
  // The table still shows the deck's meanings (from the embedded deck, not the stored one).
  await expect(page.locator('.tray .ba-meaning').first()).not.toBeEmpty();
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedSettings, waitForMyTurn } from './helpers';

const found: string[] = [];
const check = async (page: import('@playwright/test').Page, name: string) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (bad.length) console.log(name, JSON.stringify(bad.map((v) => ({ id: v.id, n: v.nodes.length, ex: v.nodes[0]?.target, msg: v.nodes[0]?.failureSummary?.slice(0, 160) })), null, 1));
  for (const v of bad) found.push(`${name}: ${v.id} (${v.nodes.length})`);
};

for (const theme of ['light', 'dark'] as const)
  test(`no serious axe violations (${theme})`, async ({ page }) => {
    await seedSettings(page, { theme });
    await page.addInitScript(() => localStorage.setItem('ba.sf', JSON.stringify({ v: 1, data: { bagRevealed: true, owned: { s01: 2 }, seen: { s05a: { times: 1, last: 'd' } } } })));
    await page.goto('./?e2e&seed=11');
    await check(page, 'home');
    for (const [btn, name] of [['Glossary', 'glossary'], ['Rules', 'rules'], ['Settings', 'settings']] as const) {
      await page.getByRole('button', { name: btn }).first().click();
      await page.waitForTimeout(450);
      await check(page, name);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await page.waitForTimeout(450);
    }
    // v1.1 screens: decks, the deck editor and the bag.
    await page.getByRole('button', { name: 'Decks' }).click();
    await page.waitForTimeout(450);
    await check(page, 'decks');
    await page.getByRole('button', { name: 'New deck from Standard' }).click();
    await page.waitForTimeout(450);
    await check(page, 'deck-edit');
    await page.getByRole('radio', { name: 'Compounds' }).click();
    await check(page, 'deck-edit-compounds');
    await page.getByRole('radio', { name: 'Meanings' }).click();
    await check(page, 'deck-edit-meanings');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForTimeout(450);
    await page.locator('.bag-card').click();
    await page.waitForTimeout(450);
    await check(page, 'bag');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: 'New game' }).click();
    await page.waitForTimeout(450);
    await check(page, 'setup');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await waitForMyTurn(page);
    await check(page, 'table');
    await page.locator('.tray .lane-scroll .ba-meaning').first().click();
    await check(page, 'table-building');
    expect(found).toEqual([]);
    found.length = 0;
  });

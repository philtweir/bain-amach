import type { Page } from '@playwright/test';

/** Settings for a quick, deterministic run: English UI, reduced motion (short animations), fast bots. */
export async function seedSettings(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem('ba.settings')) localStorage.setItem('ba.settings', JSON.stringify({ v: 1, data }));
  }, { onboarded: true, lang: 'en', reducedMotion: 'always', botSpeed: 'fast', ...extra });
}

/** Tap the centre of an element, as a finger would (goes through the board's own hit testing). */
export async function tap(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

export async function waitForMyTurn(page: Page) {
  for (let i = 0; i < 400; i++) {
    if (await page.locator('.end-card').count()) return false;
    // The state is over a beat before the end card shows (while "Your turn" may still read): wait for it.
    if (await page.evaluate(() => !!(window as any).__game?.gs.value.over)) {
      await page.locator('.end-card').waitFor();
      return false;
    }
    const st = (await page.locator('.st-turn').textContent().catch(() => '')) ?? '';
    if (st.includes('Your turn') && !(await page.locator('.made-wrap').count())) return true;
    await page.waitForTimeout(100);
  }
  throw new Error('never got a turn');
}

/** One human turn through the UI: try each meaning card for a lit verb, else draw and pass. */
export async function playTurn(page: Page): Promise<'line' | 'pass'> {
  const meanings = page.locator('.tray .lane-scroll .ba-meaning');
  const n = await meanings.count();
  for (let k = 0; k < n; k++) {
    await meanings.nth(k).click();
    const handVerb = page.locator('.tray .lane-v .ba-verb.is-lit');
    const tableVerb = page.locator('.board .ba-verb.is-lit');
    let tapped = false;
    if (await handVerb.count()) {
      await handVerb.first().click();
      tapped = true;
    } else if (await tableVerb.count()) {
      const box = await tableVerb.first().boundingBox();
      const board = await page.locator('.board').boundingBox();
      if (box && board && box.y > board.y && box.y + box.height < board.y + board.height && box.x > board.x && box.x + box.width < board.x + board.width) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        tapped = true;
      }
    }
    if (tapped) {
      const choice = page.locator('.choice');
      if (await choice.count()) await choice.first().click();
      // A line that needs a wildcard waits for the player to tap one, as a player would.
      for (let i = 0; i < 2 && ((await page.locator('.th-title').textContent()) ?? '') === 'Use your wildcard?'; i++) {
        const wild = page.locator('.tray .lane-v .ba-wild.is-lit');
        if (!(await wild.count())) break;
        await wild.first().click();
      }
      // A particle that could come from the table or the river waits for a tap: take the river one.
      if (((await page.locator('.th-title').textContent()) ?? '') === 'From the table or the river?') {
        const pile = page.locator('.river .ba-stack:has(.ba-card.is-lit)');
        if (await pile.count()) await pile.first().click();
      }
      const title = (await page.locator('.th-title').textContent()) ?? '';
      if (!/Pick a verb|Two ways|Choose a spot|Use your wildcard|From the table or the river/.test(title)) return 'line';
    }
    const cancel = page.getByRole('button', { name: 'Cancel' });
    if (await cancel.count()) await cancel.click();
  }
  await page.getByRole('button', { name: /Draw and pass|^Pass$/ }).click();
  return 'pass';
}

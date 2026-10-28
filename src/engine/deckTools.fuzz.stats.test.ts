// Acceptance (spec/deck-editor.md): bot games on any deck the validator accepts finish. 200 random valid
// decks × 20 games at every player count each can deal. Slow: run with npm run test:stats.
import { expect, it } from 'vitest';
import { BASE } from './deck';
import { buildDeck } from './deckTools';
import { playDeck, randomValidDecks } from './testDecks';

it('200 random valid decks × 20 games each: no game fails to finish', () => {
  const decks = randomValidDecks(200, 11);
  expect(decks.length).toBe(200);
  let games = 0;
  for (const c of decks) {
    const deck = buildDeck(BASE, c);
    for (const n of Object.keys(deck.setup).map(Number)) {
      const r = playDeck(deck, n, 20);
      games += 20;
      expect(r.unfinished, `${JSON.stringify(c)} at ${n}p`).toBe(0);
    }
  }
  console.log(`fuzz: ${games} games on 200 decks, all finished`);
});

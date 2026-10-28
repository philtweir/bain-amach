// Runs "Test with bots" off the main thread: the deck, and Standard at the same table to compare.
import { testDeck } from '../engine/deckTest';
import type { DeckData } from '../engine/deck';

self.onmessage = (e: MessageEvent<{ deck: DeckData; n: number; games: number; standard?: DeckData }>) => {
  const { deck, n, games, standard } = e.data;
  (self as unknown as Worker).postMessage({ r: testDeck(deck, n, games), standard: standard ? testDeck(standard, n, games) : undefined });
};

// Runs "Test this deck" off the main thread.
import { testDeck } from '../engine/deckTest';
import type { DeckData } from '../engine/deck';

self.onmessage = (e: MessageEvent<{ deck: DeckData; n: number; games: number }>) => {
  const { deck, n, games } = e.data;
  (self as unknown as Worker).postMessage(testDeck(deck, n, games));
};

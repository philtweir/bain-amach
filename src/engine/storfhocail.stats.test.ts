import { describe, expect, it } from 'vitest';
import { botTurn } from './bot';
import { newGame } from './game';
import type { SfDeal } from './storfhocail';
import { APP_RULES, type PlayerConfig } from './types';

// How often a Hard bot lays a stórfhocal per game, by the player's bag (feature plan: stakes set the odds).
// The "player" here is a Normal bot standing in for a human who never lays a tile of their own.
function rate(sf: SfDeal, games = 300) {
  let withTile = 0;
  for (let seed = 1; seed <= games; seed++) {
    const players: PlayerConfig[] = [{ name: 'You', kind: 'human', color: 0 }, { name: 'B', kind: 'bot', level: 'hard', color: 1 }];
    let s = newGame({ seed, mode: 'turns', answers: 'shown', hints: 'off', rules: APP_RULES, players, sf: { ...sf, roll: (seed * 7919 + 13) >>> 0 } });
    // The human seat plays as a Normal bot that never lays a tile.
    s.config = { ...s.config, players: [{ ...players[0] }, players[1]] };
    let t = 0;
    while (!s.over && t < 4000) {
      if (s.turn === 0) {
        const asBot = { ...s, config: { ...s.config, players: [{ ...players[0], kind: 'bot' as const, level: 'normal' as const }, players[1]] } };
        s = { ...botTurn(asBot, 0), config: s.config };
      } else s = botTurn(s, s.turn);
      t++;
    }
    if (s.sf!.laid.length) withTile++;
  }
  return withTile / games;
}

describe('stórfhocal pace', () => {
  it('reports how often a Hard bot lays a tile, by the player’s bag', () => {
    const first = rate({ on: true, owned: [], seenAny: false });
    const empty = rate({ on: true, owned: [], seenAny: true });
    const unrisked = rate({ on: true, owned: ['s01'], seenAny: true });
    console.log(`games with a bot tile: first-tile odds ${(first * 100).toFixed(0)}%, empty bag ${(empty * 100).toFixed(0)}%, bag never risked ${(unrisked * 100).toFixed(0)}%`);
    expect(first).toBeGreaterThanOrEqual(empty);
    expect(empty).toBeGreaterThan(unrisked);
  }, 300000);
});

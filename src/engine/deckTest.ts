// "Test this deck" (spec/deck-editor.md): seeded bot-vs-bot games on a built deck. Runs in a Web Worker.
import { botTurn } from './bot';
import type { DeckData } from './deck';
import { newGame } from './game';
import { APP_RULES } from './types';

export interface DeckTestResult {
  games: number;
  lines: number;
  /** Share of games someone went out. */
  out: number;
  stalls: number;
  unfinished: number;
}

export function testDeck(deck: DeckData, n: number, games = 50): DeckTestResult {
  let lines = 0,
    out = 0,
    stalls = 0,
    unfinished = 0;
  for (let seed = 1; seed <= games; seed++) {
    let s = newGame({ seed, mode: 'turns', answers: 'shown', hints: 'off', rules: APP_RULES, deck, players: Array.from({ length: n }, (_, i) => ({ name: 'B' + i, kind: 'bot' as const, level: 'hard' as const, color: i })) });
    let t = 0;
    while (!s.over && t < 6000) {
      s = botTurn(s, s.turn);
      t++;
    }
    if (!s.over) {
      unfinished++;
      continue;
    }
    lines += s.lines.length;
    stalls += s.log.filter((e) => e.e === 'stall').length;
    if (s.over.how === 'out') out++;
  }
  const done = Math.max(1, games - unfinished);
  return { games, lines: lines / done, out: out / done, stalls: stalls / done, unfinished };
}

// "Test with bots" (feature plan): seeded Normal-bot games on a built deck, with the four numbers the
// sheet shows. Runs in a Web Worker. It shows whether a deck plays, not whether it is balanced.
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
  /** Compounds on the meaning cards that no game made, as "verb particles". */
  never: string[];
}

export function testDeck(deck: DeckData, n: number, games = 100, level: 'normal' | 'hard' = 'normal'): DeckTestResult {
  const made = new Set<string>();
  let lines = 0,
    out = 0,
    stalls = 0,
    unfinished = 0;
  for (let seed = 1; seed <= games; seed++) {
    let s = newGame({ seed, mode: 'turns', answers: 'shown', hints: 'off', rules: APP_RULES, deck, players: Array.from({ length: n }, (_, i) => ({ name: 'B' + i, kind: 'bot' as const, level, color: i })) });
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
    for (const l of s.lines) made.add(l.c);
    stalls += s.log.filter((e) => e.e === 'stall').length;
    if (s.over.how === 'out') out++;
  }
  const done = Math.max(1, games - unfinished);
  // A compound is on the cards when its meaning is; any compound with that meaning answers it.
  const onCards = new Set(deck.meaningCards.flatMap((m) => m.meanings));
  const never = deck.compounds.filter((c) => onCards.has(c.meaning) && !made.has(c.id)).map((c) => [c.verb, ...c.particles].join(' '));
  return { games, lines: lines / done, out: out / done, stalls: stalls / done, unfinished, never };
}

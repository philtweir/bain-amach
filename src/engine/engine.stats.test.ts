// Milestone 1 acceptance: 300 seeded bot games per player count, within noise of the reference engine
// run on the same deck. On the app deck (handoff deck + 27 draft meaning cards and the draft verbs) the
// reference makes 42.8 / 49.2 / 48.3 lines, wildcard lines 3.9, straddles 2.8–3.8. (With only the
// first 13 draft cards: 31.5 / 38.6 / 37.6, straddles 1.6–2.8. Handoff deck: 28.2 / 31.9 / 31.3.)
import { describe, expect, it } from 'vitest';
import { botTurn } from './bot';
import { DECK } from './deck';
import { newGame } from './game';
import type { GameConfig } from './types';

const REF_LINES: Record<number, number> = { 2: 42.8, 3: 49.2, 4: 48.3 };

function run(n: number, games: number, extra: Partial<GameConfig> = {}) {
  let out = 0, lines = 0, straddles = 0, wild = 0, unfinished = 0, short = 0, ties = 0, firstWins = 0, decided = 0;
  for (let seed = 1; seed <= games; seed++) {
    let s = newGame({
      seed, mode: 'turns', answers: 'shown', hints: 'off',
      players: Array.from({ length: n }, (_, i) => ({ name: 'B' + i, kind: 'bot' as const, level: 'hard' as const, color: i })),
      ...extra,
    });
    if (s.hands.some((h) => h.length !== DECK.setup[n].handSize)) short++;
    const first = s.turn;
    let t = 0;
    while (!s.over && t < 4000) { s = botTurn(s, s.turn); t++; }
    if (!s.over) { unfinished++; continue; }
    if (s.over.how === 'out') out++;
    if (s.over.tie) ties++;
    else { decided++; if (s.over.winners[0] === first) firstWins++; }
    lines += s.lines.length;
    straddles += s.lines.filter((l) => l.straddle).length;
    wild += s.lines.filter((l) => l.wild).length;
  }
  return { short, unfinished, lines: lines / games, straddles: straddles / games, wild: wild / games, out: out / games, ties, firstWins: firstWins / decided };
}

describe('bot games match the reference within noise', () => {
  for (const n of [2, 3, 4])
    it(`${n} players, 300 games`, () => {
      const r = run(n, 300);
      console.log(`${n}p: lines ${r.lines.toFixed(1)}, straddles ${r.straddles.toFixed(2)}, wildcard lines ${r.wild.toFixed(2)}, out ${Math.round(r.out * 100)}%, ties ${r.ties}, first player wins ${Math.round(r.firstWins * 100)}%`);
      expect(r.short).toBe(0);
      expect(r.unfinished).toBe(0);
      // Within 10%: the production engine differs from the reference on purpose (random first player,
      // bot swaps, final-stall count reset after a line). Exact equality under the reference's own rules
      // is engine.parity.test.ts's job.
      expect(Math.abs(r.lines - REF_LINES[n]) / REF_LINES[n]).toBeLessThan(0.1);
      expect(r.wild).toBeGreaterThan(3.0);
      expect(r.wild).toBeLessThan(4.5);
      expect(r.straddles).toBeGreaterThan(1.5);
      expect(r.straddles).toBeLessThan(5.0);
    });
});

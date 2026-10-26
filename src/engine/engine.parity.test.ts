// Parity with the reference engine: same seed, same bot, same game, move for move.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { botTurn } from './bot';
import { newGame } from './game';
import type { GameConfig, GameState } from './types';

// The reference is CommonJS but the repo is "type": "module", so evaluate it with a CommonJS wrapper.
const refPath = new URL('../../handoff/reference/engine/engine.js', import.meta.url);
const refModule: { exports: any } = { exports: {} };
// The reference reads ../../data/deck.json relative to itself; hand it the app's deck instead, so both
// engines deal from the same cards (the app deck adds draft meanings to the handoff's).
const appDeck = JSON.parse(readFileSync(new URL('../../data/deck.json', import.meta.url), 'utf8'));
const baseRequire = createRequire(refPath);
const refRequire = ((id: string) => (id.endsWith('data/deck.json') ? appDeck : baseRequire(id))) as NodeRequire;
new Function('module', 'require', readFileSync(refPath, 'utf8'))(refModule, refRequire);
const { Game } = refModule.exports;

function cfg(seed: number, n: number): GameConfig {
  return {
    seed,
    mode: 'turns',
    answers: 'shown',
    hints: 'off',
    firstPlayer: 0,
    botSwaps: false,
    legacyStall: true,
    players: Array.from({ length: n }, (_, i) => ({ name: 'B' + i, kind: 'bot' as const, level: 'hard' as const, color: i })),
  };
}

function snapRef(g: any) {
  const board = [...g.board.values()].map((c: any) => `${c.x},${c.y}:${c.id}${c.cross ? 'x' : ''}`).sort();
  return { board, hands: g.hands.map((h: any[]) => h.map((c) => c.id)), piles: g.piles.map((p: any[]) => p.map((c) => c.id)), over: !!g.over };
}
function snapMine(s: GameState) {
  const board = s.board.map((c) => `${c.x},${c.y}:${c.id}${c.cross ? 'x' : ''}`).sort();
  return { board, hands: s.hands.map((h) => h.map((c) => c.id)), piles: s.piles.map((p) => p.map((c) => c.id)), over: !!s.over };
}

describe('reference parity', () => {
  for (const n of [2, 3, 4])
    it(`${n} players: identical games for 25 seeds`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const ref = new Game(seed, n);
        let s = newGame(cfg(seed, n));
        expect(snapMine(s)).toEqual(snapRef(ref));
        let t = 0;
        while (!ref.over && t < 4000) {
          const p = ref.turn,
            mv = ref.botMove(p);
          if (mv) ref.apply(p, mv);
          else ref.pass(p);
          ref.next();
          expect(s.turn).toBe(p);
          s = botTurn(s, p);
          const a = snapMine(s),
            b = snapRef(ref);
          if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`seed ${seed}, ${n}p, step ${t}: diverged`);
          t++;
        }
        expect(!!s.over).toBe(true);
        if (ref.over.how === 'fewest') expect(s.over!.how).toBe('fewest');
        else expect(s.over!.winners).toEqual([ref.over.winner]);
      }
    }, 120000);
});

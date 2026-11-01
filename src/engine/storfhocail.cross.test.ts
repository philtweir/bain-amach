// Regression: a particle laid as part of a stórfhocal phrase can still be crossed by an ordinary line,
// by the player (builder ways) and by the bots (lineMoves). Phil saw this fail in a playtest build.
import { describe, expect, it } from 'vitest';
import { apply, lineMoves, newGame, sfMoves } from './game';
import { emptySelection, ways } from './builder';
import { APP_RULES, type Card, type GameState, type PlayerConfig, type Placed } from './types';

let nid = 9000;
const V = (t: string): Card => ({ id: nid++, k: 'V', t });
const P = (t: string): Card => ({ id: nid++, k: 'P', t });
const M = (t: string): Card => ({ id: nid++, k: 'M', t });
const at = (c: Card, x: number, y: number): Placed => ({ ...c, x, y, axis: null, owner: -1 });
const you: PlayerConfig = { name: 'You', kind: 'human', color: 0 };
const bot: PlayerConfig = { name: 'B', kind: 'bot', level: 'hard', color: 1 };

function position(hand: Card[], piles: string[][], pouch: string[]): GameState {
  const s = structuredClone(newGame({ seed: 1, mode: 'turns', answers: 'shown', hints: 'off', rules: APP_RULES, players: [you, bot], firstPlayer: 0, sf: { on: true, owned: [], seenAny: true, layChance: 0 } }));
  s.board = [at(V('tabhair'), 0, 0)];
  s.piles = piles.map((p) => p.map(P));
  s.hands = [hand, [V('tóg')]];
  s.sf = { pouch: { 0: pouch }, laid: [], stake: false };
  s.turn = 0;
  return structuredClone(s);
}

describe('crossing a stórfhocal particle', () => {
  for (const d of [[1, 0], [0, 1]] as const)
    it(`lig do runs through the do of tabhair aire do (${d[0] ? 'across' : 'down'})`, () => {
      // m19 carries LEAVE ALONE (lig do).
      const s = position([V('lig'), V('fan'), M('m19')], [['do'], ['as'], ['ar'], ['le'], ['amach']], ['s01']);
      const mv = sfMoves(s, 0, 's01').find((x) => 'table' in x.verb && x.d[0] === d[0] && x.d[1] === d[1])!;
      const r = apply(s, 0, mv);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const st = { ...r.state, turn: 0 };
      const doCell = st.board.find((b) => b.k === 'P' && b.t === 'do')!;
      const crossing = lineMoves(st, 0).filter((l) => l.c === 'c29' && l.src.some((x) => 'existing' in x));
      expect(crossing.length).toBeGreaterThan(0);
      expect(ways(st, 0, { ...emptySelection(), cross: { x: doCell.x, y: doCell.y } }).map((w) => w.c)).toContain('c29');
      const r2 = apply(st, 0, crossing[0]);
      expect(r2.ok).toBe(true);
    });
});

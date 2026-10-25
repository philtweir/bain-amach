// RULES §10 edge cases, determinism and the builder queries.
import { describe, expect, it } from 'vitest';
import { botTurn } from './bot';
import { emptySelection, hint, judge, lit, placements, preferredWay, ways, wayToMove } from './builder';
import { FINAL_STALLS, apply, lineMoves, loneMoves, newGame, pass, raceStall, setStuck } from './game';
import type { Card, GameConfig, GameState, Placed } from './types';

const bots = (n: number) => Array.from({ length: n }, (_, i) => ({ name: 'P' + i, kind: (i === 0 ? 'human' : 'bot') as 'human' | 'bot', level: 'hard' as const, color: i }));
const cfg = (o: Partial<GameConfig> = {}): GameConfig => ({ seed: 1, mode: 'turns', answers: 'shown', hints: 'off', players: bots(2), firstPlayer: 0, ...o });

let nid = 1000;
const V = (t: string): Card => ({ id: nid++, k: 'V', t });
const P = (t: string): Card => ({ id: nid++, k: 'P', t });
const W = (): Card => ({ id: nid++, k: 'W', t: '*' });
/** Meaning card by deck id: m01 = LISTEN TO, PUT ON, SUCCEED; m02 = STAND BY, LOOK AT, REACH … */
const M = (t: string): Card => ({ id: nid++, k: 'M', t });
const at = (c: Card, x: number, y: number, axis: Placed['axis'] = null, owner = -1): Placed => ({ ...c, x, y, axis, owner });

/** A hand-built position. Piles are listed bottom to top. */
function fixture(o: { board?: Placed[]; piles?: string[][]; hands: Card[][]; main?: Card[]; mpile?: Card[]; faceUp?: Card; config?: Partial<GameConfig> }): GameState {
  const s = newGame(cfg(o.config));
  s.board = o.board ?? [at(V('cuir'), 0, 0)];
  s.piles = (o.piles ?? [['ar'], ['le'], ['amach'], ['suas'], ['as']]).map((p) => p.map(P));
  s.hands = o.hands;
  s.main = o.main ?? [V('bain'), V('tóg')];
  s.mpile = o.mpile ?? [M('m05'), M('m06')];
  s.faceUp = o.faceUp ?? M('m07');
  s.stuck = s.hands.map(() => false);
  s.missed = s.hands.map(() => []);
  s.hintsUsed = s.hands.map(() => false);
  s.config = { ...s.config, players: bots(s.hands.length) };
  // a fresh object: the engine caches a cell index per state object
  return structuredClone(s);
}

function findMeaningCard(...gl: string[]): string {
  // locate a deck meaning card that carries all the given glosses
  const deck = (globalThis as any).__deck as { meaningCards: { id: string; meanings: string[] }[] };
  return deck.meaningCards.find((m) => gl.every((g) => m.meanings.includes(g)))!.id;
}
import deck from '@deck';
(globalThis as any).__deck = deck;

describe('setup', () => {
  it('deals honest hands and four different starter verbs', () => {
    for (const n of [2, 3, 4]) {
      const s = newGame(cfg({ players: bots(n), firstPlayer: undefined, seed: 42 }));
      const size = (deck as any).setup[n].handSize;
      expect(s.hands.every((h) => h.length === size)).toBe(true);
      expect(s.hands.every((h) => h.filter((c) => c.k === 'M').length === 3)).toBe(true);
      expect(new Set(s.board.map((c) => c.t)).size).toBe(4);
      expect(s.piles.length).toBe(5);
      expect(s.turn).toBeGreaterThanOrEqual(0);
      expect(s.turn).toBeLessThan(n);
    }
  });
  it('random first player varies by seed', () => {
    const firsts = new Set(Array.from({ length: 30 }, (_, i) => newGame(cfg({ players: bots(4), firstPlayer: undefined, seed: i + 1 })).turn));
    expect(firsts.size).toBeGreaterThan(2);
  });
});

describe('determinism', () => {
  it('same seed and same moves give an identical state', () => {
    const play = () => {
      let s = newGame(cfg({ seed: 99, players: bots(3).map((p) => ({ ...p, kind: 'bot' as const, level: 'normal' as const })), firstPlayer: undefined }));
      for (let i = 0; i < 200 && !s.over; i++) s = botTurn(s, s.turn);
      return JSON.stringify(s);
    };
    expect(play()).toBe(play());
  });
  it('state survives a JSON round trip', () => {
    let s = newGame(cfg({ seed: 5 }));
    for (let i = 0; i < 20 && !s.over; i++) s = botTurn(s, s.turn);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('RULES §10', () => {
  const put = findMeaningCard('PUT UP WITH');
  it('two particles from the same river pile: top, then the card under it', () => {
    const m = M(put);
    const s = fixture({ piles: [['le', 'suas'], ['ar'], ['do'], ['as'], ['de']], hands: [[m, V('éist')], [V('fan')]] });
    const lines = lineMoves(s, 0).filter((l) => l.c === 'c08');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].src).toEqual([{ river: 0 }, { river: 0 }]);
    const r = apply(s, 0, lines[0]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.piles[0].length).toBe(0);
  });

  it('a verb from hand far from other cards is legal: the grid is unbounded', () => {
    const m = M(findMeaningCard('LISTEN TO'));
    const v = V('éist');
    const s = fixture({ hands: [[m, v, V('fan')], [V('fan')]] });
    const r = apply(s, 0, { type: 'line', m: m.id, g: 'LISTEN TO', c: 'c32', verb: { hand: v.id }, x: 40, y: -30, d: [1, 0], src: [{ river: 1 }] });
    expect(r.ok).toBe(true);
  });

  it('a crossing line must match the particle at that exact position', () => {
    // cuir suas le already down; éist le crosses the le (position 0 of éist le).
    const m = M(findMeaningCard('LISTEN TO'));
    const board = [at(V('cuir'), 0, 0), at(P('suas'), 1, 0, 'h', 1), at(P('le'), 2, 0, 'h', 1), at(M(put), 3, 0, 'h', 1)];
    const ev = V('éist');
    const s = fixture({ board, piles: [['ar'], ['do'], ['amach'], ['suas'], ['as']], hands: [[m, ev, V('fan')], [V('fan')]] });
    const cross = lineMoves(s, 0).filter((l) => l.src.some((x) => 'existing' in x));
    expect(cross.length).toBeGreaterThan(0);
    for (const l of cross) {
      // verb sits directly above or below the le, meaning on the other side
      expect(l.x).toBe(2);
      expect(Math.abs(l.y)).toBe(1);
    }
    // crossing suas (wrong word for éist le) is impossible
    expect(cross.every((l) => l.x === 2)).toBe(true);
    const r = apply(s, 0, cross[0]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.board.find((c) => c.x === 2 && c.y === 0)!.cross).toBe(true);
  });

  it('GIVE UP accepts tabhair suas and éirigh as', () => {
    const gu = findMeaningCard('GIVE UP');
    for (const [verb, part, cid] of [['tabhair', 'suas', 'c11'], ['éirigh', 'as', 'c18']] as const) {
      const m = M(gu);
      const v = V(verb);
      const s = fixture({ board: [at(V('cuir'), 0, 0)], piles: [[part], ['ar'], ['le'], ['do'], ['de']], hands: [[m, v, V('fan')], [V('fan')]] });
      const ok = lineMoves(s, 0).some((l) => l.c === cid && l.g === 'GIVE UP');
      expect(ok).toBe(true);
      const j = judge(s, 0, { meaning: m.id, verb: { hand: v.id }, parts: [{ river: 0 }] });
      expect(j.ok).toBe(true);
    }
  });

  it('race: two commits needing the same river top; the second is Taken', () => {
    const m0 = M(findMeaningCard('LISTEN TO')),
      m1 = M(findMeaningCard('MEET'));
    const v0 = V('éist'),
      v1 = V('buail');
    const s = fixture({ piles: [['le'], ['ar'], ['amach'], ['suas'], ['as']], hands: [[m0, v0, V('fan')], [m1, v1, V('fan')]], config: { mode: 'race' } });
    const a = lineMoves(s, 0).find((l) => l.c === 'c32')!;
    const b = lineMoves(s, 1).find((l) => l.c === 'c30')!;
    const r1 = apply(s, 0, a);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = apply(r1.state, 1, b);
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.reason.why).toBe('Taken');
      if (r2.reason.why === 'Taken') expect(r2.reason.by).toBe(0);
    }
  });

  it('both piles empty: lone verbs are illegal, passing still works', () => {
    const v = V('fan');
    const s = fixture({ main: [], mpile: [], hands: [[v, V('cuir')], [V('tóg')]] });
    expect(loneMoves(s, 0)).toEqual([]);
    expect(apply(s, 0, { type: 'lone', v: v.id, x: 9, y: 9 }).ok).toBe(false);
    expect(pass(s, 0).ok).toBe(true);
  });

  it('a tie on fewest cards shares the win', () => {
    let s = fixture({ main: [], mpile: [], hands: [[V('fan'), V('cuir')], [V('tóg'), V('lig')]] });
    for (let i = 0; i < FINAL_STALLS * 2 && !s.over; i++) {
      const r = pass(s, s.turn);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
    }
    expect(s.over?.how).toBe('fewest');
    expect(s.over?.tie).toBe(true);
    expect(s.over?.winners).toEqual([0, 1]);
  });
});

describe('plays, passing and stalls', () => {
  it('a full round of passes buries the river', () => {
    const s0 = fixture({ piles: [['le', 'ar'], ['do'], ['amach'], ['suas'], ['as']], hands: [[V('fan')], [V('tóg')]] });
    let s = (pass(s0, 0) as any).state as GameState;
    s = (pass(s, 1) as any).state;
    expect(s.piles[0].map((c) => c.t)).toEqual(['ar', 'le']);
    expect(s.log.some((e) => e.e === 'stall')).toBe(true);
  });
  it('passing with fewer than 2 meanings draws a meaning', () => {
    const s0 = fixture({ hands: [[V('fan')], [V('tóg')]] });
    const s = (pass(s0, 0) as any).state as GameState;
    expect(s.hands[0].some((c) => c.k === 'M')).toBe(true);
  });
  it('a line resets the final-stall count', () => {
    const m = M(findMeaningCard('LISTEN TO'));
    const ev = V('éist');
    let s = fixture({ main: [], mpile: [], piles: [['le', 'le'], ['ar'], ['amach'], ['suas'], ['as']], hands: [[m, ev, V('fan')], [V('tóg'), V('lig')]] });
    s = (pass(s, 0) as any).state;
    s = (pass(s, 1) as any).state;
    expect(s.stalls).toBe(1);
    const mv = lineMoves(s, 0).find((l) => l.c === 'c32')!;
    s = (apply(s, 0, mv) as any).state;
    expect(s.stalls).toBe(0);
  });
  it('swap exchanges a hand meaning for the face-up one', () => {
    const m = M('m01');
    const face = M('m02');
    const s0 = fixture({ hands: [[m, V('fan')], [V('tóg')]], faceUp: face });
    const r = apply(s0, 0, { type: 'swap', m: m.id });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.faceUp!.id).toBe(m.id);
      expect(r.state.hands[0].some((c) => c.id === face.id)).toBe(true);
    }
  });
  it('turn mode refuses a play out of turn', () => {
    const v = V('fan');
    const s = fixture({ hands: [[V('tóg')], [v]] });
    expect(apply(s, 1, { type: 'lone', v: v.id, x: 5, y: 5 }).ok).toBe(false);
  });
  it('race stall: everyone draws one and Stuck clears', () => {
    let s = fixture({ hands: [[V('fan')], [V('tóg')]], config: { mode: 'race' } });
    s = setStuck(s, 0, true);
    expect(s.stuck[0]).toBe(true);
    const before = s.hands.map((h) => h.length);
    s = raceStall(s);
    expect(s.hands.map((h) => h.length)).toEqual(before.map((n) => n + 1));
    expect(s.stuck.every((x) => !x)).toBe(true);
  });
  it('a human passing with a legal line records a missed play', () => {
    const m = M(findMeaningCard('LISTEN TO'));
    const s0 = fixture({ hands: [[m, V('éist'), V('fan')], [V('tóg')]] });
    const s = (pass(s0, 0) as any).state as GameState;
    expect(s.missed[0].length).toBe(1);
    expect(s.missed[0][0].c).toBe('c32');
  });
});

describe('builder', () => {
  it('lights the verbs and river tops for a meaning card', () => {
    const m = M(findMeaningCard('LISTEN TO'));
    const ev = V('éist');
    const s = fixture({ piles: [['ar'], ['le'], ['amach'], ['suas'], ['as']], hands: [[m, ev, V('fan')], [V('tóg')]] });
    const sel = { ...emptySelection(), meaning: m.id };
    const L = lit(s, 0, sel);
    expect(L.handVerbs.has(ev.id)).toBe(true);
    expect(L.river.has(1)).toBe(true);
  });
  it('prefers river tops over wildcards and finds a placement', () => {
    const m = M(findMeaningCard('LISTEN TO'));
    const ev = V('éist');
    const w = W();
    const s = fixture({ piles: [['ar'], ['le'], ['amach'], ['suas'], ['as']], hands: [[m, ev, w], [V('tóg')]] });
    const ws = ways(s, 0, { ...emptySelection(), meaning: m.id, verb: { hand: ev.id } }).filter((x) => x.c === 'c32');
    const best = preferredWay(ws)!;
    expect(best.src).toEqual([{ river: 1 }]);
    const pl = placements(s, best)[0];
    expect(apply(s, 0, wayToMove(best, pl)).ok).toBe(true);
  });
  it('hidden mode: names a compound that does not exist, or one not on the card', () => {
    const m = M(findMeaningCard('LISTEN TO'));
    const cuir = { table: { x: 0, y: 0 } };
    const s = fixture({ piles: [['faoi'], ['le'], ['suas'], ['ar'], ['as']], hands: [[m, V('fan')], [V('tóg')]] });
    const a = judge(s, 0, { meaning: m.id, verb: cuir, parts: [{ river: 0 }] });
    expect(a.ok).toBe(false);
    if (!a.ok && a.reason.why === 'WrongLine') expect(a.reason.kind).toBe('NoSuchCompound');
    const b = judge(s, 0, { meaning: m.id, verb: cuir, parts: [{ river: 2 }, { river: 1 }] });
    expect(b.ok).toBe(false);
    if (!b.ok && b.reason.why === 'WrongLine') {
      expect(b.reason.kind).toBe('NotOnCard');
      if (b.reason.kind === 'NotOnCard') expect(b.reason.text).toBe('cuir suas le');
    }
  });
  it('hint lights one usable verb', () => {
    const m = M(findMeaningCard('LISTEN TO'));
    const ev = V('éist');
    const s = fixture({ hands: [[m, ev, V('fan')], [V('tóg')]] });
    expect(hint(s, 0, m.id)).toEqual({ hand: ev.id });
  });
});

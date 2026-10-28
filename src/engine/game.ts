// The rules engine: setup, legal moves, apply, passing and stalls. Pure: no DOM, no timers.
// Behaviour follows spec/RULES.md; enumeration order follows reference/engine/engine.js so the
// bots play the same games as the reference given the same seed (see engine.parity.test.ts).
import { COMPOUNDS, COMPOUNDS_BY_MEANING, COMPOUND_BY_ID, DECK, MEANING_CARD, useDeck, useDeckOf, type Compound } from './deck';
import { rng, shuffle } from './rng';
import { SF_CARD_ID, SF_PHRASE, SF_WORD, phraseInDeck, phraseParticles, wordInDeck } from './storfhocail';
import type {
  Card,
  Dir,
  GameConfig,
  GameEvent,
  GameState,
  LineMove,
  LoneMove,
  Move,
  Placed,
  Rejection,
  Result,
  SfMove,
  Src,
} from './types';

export const DIRS: Dir[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const K = (x: number, y: number) => x + ',' + y;
const STARTER_SPOTS: [number, number][] = [
  [0, 0],
  [4, 1],
  [1, 4],
  [5, 5],
];

export interface Spot {
  x: number;
  y: number;
  d: Dir;
  dist: number;
}

/** Read/write view over a state with a cell index. Never shared with the UI for writing. */
export class Ctx {
  idx = new Map<string, Placed>();
  private spotCache = new Map<number, Spot[]>();
  private boundsCache: [number, number, number, number] | null = null;
  constructor(public s: GameState) {
    for (const c of s.board) this.idx.set(K(c.x, c.y), c);
  }
  at(x: number, y: number) {
    return this.idx.get(K(x, y));
  }
  free(x: number, y: number) {
    return !this.idx.has(K(x, y));
  }
  put(x: number, y: number, c: Card, axis: Placed['axis'], owner: number, extra: Partial<Placed> = {}) {
    const placed: Placed = { ...c, x, y, axis, owner, ...extra };
    this.s.board.push(placed);
    this.idx.set(K(x, y), placed);
    this.spotCache.clear();
    this.boundsCache = null;
    return placed;
  }
  bounds(): [number, number, number, number] {
    if (this.boundsCache) return this.boundsCache;
    let a: [number, number, number, number] = [1e9, 1e9, -1e9, -1e9];
    for (const c of this.s.board) a = [Math.min(a[0], c.x), Math.min(a[1], c.y), Math.max(a[2], c.x), Math.max(a[3], c.y)];
    return (this.boundsCache = a);
  }
  /** Every place a verb could go with `len` free cells after it, nearest the board's centre first. */
  spots(len: number): Spot[] {
    const hit = this.spotCache.get(len);
    if (hit) return hit;
    const [x0, y0, x1, y1] = this.bounds();
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2,
      out: Spot[] = [];
    for (let x = x0 - len - 2; x <= x1 + len + 2; x++)
      for (let y = y0 - len - 2; y <= y1 + len + 2; y++) {
        if (!this.free(x, y)) continue;
        for (const d of DIRS) {
          if (!this.runFree(x, y, d, 1, len + 1)) continue;
          out.push({ x, y, d, dist: Math.abs(x + (d[0] * (len + 1)) / 2 - cx) + Math.abs(y + (d[1] * (len + 1)) / 2 - cy) });
        }
      }
    out.sort((a, b) => a.dist - b.dist);
    this.spotCache.set(len, out);
    return out;
  }
  runFree(x: number, y: number, d: Dir, from: number, to: number, skip = -1) {
    for (let k = from; k <= to; k++) if (k !== skip && !this.free(x + d[0] * k, y + d[1] * k)) return false;
    return true;
  }
  /** Where each particle would come from: river tops first (two may come from one pile), then wildcards. */
  plan(ps: string[], wildIds: number[]): Src[] | null {
    const piles = this.s.piles,
      st = piles.map((p) => p.length),
      src: Src[] = [];
    let w = 0;
    for (const p of ps) {
      const i = piles.findIndex((pl, j) => st[j] > 0 && pl[st[j] - 1].t === p);
      if (i >= 0) {
        st[i]--;
        src.push({ river: i });
        continue;
      }
      if (w < wildIds.length) {
        src.push({ wild: wildIds[w++] });
        continue;
      }
      return null;
    }
    return src;
  }
}

const ctxCache = new WeakMap<GameState, Ctx>();
/** Read-only context for a state (cached). */
export function view(s: GameState): Ctx {
  let c = ctxCache.get(s);
  if (!c) ctxCache.set(s, (c = new Ctx(s)));
  return c;
}

export function clone(s: GameState): GameState {
  return structuredClone(s);
}

export function meaningsOf(card: Card): string[] {
  return MEANING_CARD[card.t] ?? [];
}

export function canDraw(s: GameState) {
  return s.main.length > 0 || s.mpile.length > 0;
}

// ---------- setup ----------

export function newGame(config: GameConfig): GameState {
  useDeck(config.deck);
  const n = config.players.length;
  const setup = DECK.setup[String(n)];
  if (!setup) throw new Error('2 to 4 players');
  const r = rng(config.seed);
  let id = 0;
  const card = (k: Card['k'], t: string): Card => ({ id: id++, k, t });
  const verbCounts: Record<string, number> = { ...DECK.verbs.base };
  if (setup.verbs.includes('pack3to4'))
    for (const [v, c] of Object.entries(DECK.verbs.pack3to4)) verbCounts[v] = (verbCounts[v] || 0) + c;
  const main: Card[] = [];
  for (const [v, c] of Object.entries(verbCounts)) for (let i = 0; i < c; i++) main.push(card('V', v));
  for (let i = 0; i < DECK.wildcards; i++) main.push(card('W', '*'));
  const parts: Card[] = [];
  for (const p of DECK.particles) for (let i = 0; i < p.copies; i++) parts.push(card('P', p.word));
  const means = DECK.meaningCards.map((m) => card('M', m.id));
  shuffle(main, r);
  shuffle(parts, r);
  shuffle(means, r);

  const s: GameState = {
    v: 1,
    config,
    // A stórfhocal game's bots choose afresh on a replay (only the deal repeats).
    rng: (config.seed ^ 0x9e3779b9 ^ (config.sf?.roll ?? 0)) >>> 0,
    board: [],
    lines: [],
    piles: [],
    main,
    mpile: means,
    faceUp: null,
    hands: [],
    turn: 0,
    turnNo: 1,
    passes: 0,
    stalls: 0,
    stuck: Array(n).fill(false),
    over: null,
    log: [],
    missed: Array.from({ length: n }, () => []),
    hintsUsed: Array(n).fill(false),
  };
  const g = new Ctx(s);
  const starters: Card[] = [];
  const seen = new Set<string>();
  for (let i = main.length - 1; i >= 0 && starters.length < DECK.starterVerbs; i--)
    if (main[i].k === 'V' && !seen.has(main[i].t)) {
      seen.add(main[i].t);
      starters.push(main.splice(i, 1)[0]);
    }
  starters.forEach((c, i) => {
    const [x, y] = STARTER_SPOTS[i] ?? [i * 4, 0];
    g.put(x, y, c, null, -1);
  });
  const np = DECK.riverPiles;
  s.piles = Array.from({ length: np }, (_, i) => parts.filter((_, j) => j % np === i));
  s.faceUp = s.mpile.pop() ?? null;
  for (let p = 0; p < n; p++) {
    const h: Card[] = [];
    const nm = config.rules?.meaningsInHand ?? setup.meaningsInHand;
    for (let i = 0; i < setup.handSize - nm; i++) h.push(s.main.pop()!);
    for (let i = 0; i < nm; i++) h.push(s.mpile.pop()!);
    s.hands.push(h);
  }
  s.turn = config.firstPlayer ?? Math.floor(r() * n);
  if (config.sf?.on) s.sf = { pouch: {}, laid: [], stake: false };
  ctxCache.set(s, g);
  return s;
}

// ---------- legal moves ----------

export interface LineOpts {
  /** Hand-verb placements per compound: a number keeps the best N (bots), Infinity keeps all. */
  handSpots?: number;
  straddles?: boolean;
  meanings?: Card[];
  /** Include lines ending on a table meaning card (when the rule is on). Default: unless `meanings` is given. */
  onto?: boolean;
}

/** Line moves for player p, in the reference engine's order. */
export function lineMoves(s: GameState, p: number, o: LineOpts = {}): LineMove[] {
  const g = view(s);
  const hand = s.hands[p];
  const wildIds = hand.filter((c) => c.k === 'W').map((c) => c.id);
  const ms = o.meanings ?? hand.filter((c) => c.k === 'M');
  const hv = hand.filter((c) => c.k === 'V');
  const nSpots = o.handSpots ?? 4;
  const out: LineMove[] = [];
  for (const m of ms)
    for (const gl of meaningsOf(m))
      for (const c of COMPOUNDS_BY_MEANING[gl] ?? []) {
        const L = c.ps.length;
        for (const v of s.board) {
          if (v.k !== 'V' || v.t !== c.v) continue;
          for (const d of DIRS) {
            if (!g.runFree(v.x, v.y, d, 1, L + 1)) continue;
            const src = g.plan(c.ps, wildIds);
            if (!src) continue;
            out.push({ type: 'line', m: m.id, g: gl, c: c.id, verb: { table: { x: v.x, y: v.y } }, x: v.x, y: v.y, d, src });
          }
        }
        const vc = hv.find((h) => h.t === c.v);
        if (!vc) continue;
        const src = g.plan(c.ps, wildIds);
        if (src) {
          const spots = g.spots(L);
          const lim = Math.min(spots.length, nSpots);
          for (let i = 0; i < lim; i++) {
            const sp = spots[i];
            out.push({ type: 'line', m: m.id, g: gl, c: c.id, verb: { hand: vc.id }, x: sp.x, y: sp.y, d: sp.d, src });
          }
        }
        if (o.straddles === false) continue;
        for (const b of s.board) {
          if (b.k !== 'P') continue;
          c.ps.forEach((pt, i) => {
            if (pt !== b.t) return;
            for (const d of DIRS) {
              const vx = b.x - d[0] * (i + 1),
                vy = b.y - d[1] * (i + 1);
              if (!g.runFree(vx, vy, d, 0, L + 1, i + 1)) continue;
              const rest = c.ps.filter((_, j) => j !== i);
              const src0 = g.plan(rest, wildIds);
              if (!src0) continue;
              const src2: Src[] = [];
              let q = 0;
              c.ps.forEach((_, j) => src2.push(j === i ? { existing: true } : src0[q++]));
              out.push({ type: 'line', m: m.id, g: gl, c: c.id, verb: { hand: vc.id }, x: vx, y: vy, d, src: src2 });
            }
          });
        }
      }
  if (s.config.rules?.tableMeanings && (o.onto ?? !o.meanings)) out.push(...ontoMoves(s, p, g, hv, wildIds));
  return out;
}

/** Lines ending on a meaning card already on the table, as any of its meanings, verb from the hand. */
function ontoMoves(s: GameState, p: number, g: Ctx, hv: Card[], wildIds: number[]): LineMove[] {
  void p;
  const out: LineMove[] = [];
  for (const t of s.board) {
    if (t.k !== 'M') continue;
    for (const gl of meaningsOf(t))
      for (const c of COMPOUNDS_BY_MEANING[gl] ?? []) {
        const vc = hv.find((h) => h.t === c.v);
        if (!vc) continue;
        const L = c.ps.length;
        for (const d of DIRS) {
          // The line runs verb → particles → t, so the verb sits L+1 cells back along -d.
          const vx = t.x - d[0] * (L + 1),
            vy = t.y - d[1] * (L + 1);
          if (!g.runFree(vx, vy, d, 0, L)) continue;
          const src = g.plan(c.ps, wildIds);
          if (!src) continue;
          out.push({ type: 'line', m: t.id, g: gl, c: c.id, verb: { hand: vc.id }, x: vx, y: vy, d, src, onto: { x: t.x, y: t.y } });
        }
      }
  }
  return out;
}

// ---------- stórfhocail ----------

/** Whether p holds this tile now: the player's in their pouch; a Hard bot draws from the whole list
 *  (any word this deck can complete, not already on the table). */
export function holdsTile(s: GameState, p: number, word: string): boolean {
  if (!s.sf) return false;
  const pl = s.config.players[p];
  if (pl?.kind === 'bot') return pl.level === 'hard' && !!SF_WORD[word] && wordInDeck(SF_WORD[word]) && !s.sf.laid.some((l) => l.word === word);
  return (s.sf.pouch[p] ?? []).includes(word);
}

/**
 * Stórfhocal lines p could lay with this tile: a verb on the table with a free run, or one from the
 * hand at the best few spots, or (verb from the hand) through one particle already down. Only phrases
 * the game's deck can make.
 */
export function sfMoves(s: GameState, p: number, word: string, handSpots = 4): SfMove[] {
  const w = SF_WORD[word];
  if (!w || !holdsTile(s, p, word)) return [];
  const g = view(s);
  const hand = s.hands[p];
  const wildIds = hand.filter((c) => c.k === 'W').map((c) => c.id);
  const out: SfMove[] = [];
  for (const ph of w.phrases) {
    if (!phraseInDeck(ph)) continue;
    const L = ph.pattern.length;
    const parts = phraseParticles(ph);
    const src = g.plan(parts, wildIds);
    for (const v of s.board) {
      if (v.k !== 'V' || v.t !== ph.verb || !src) continue;
      for (const d of DIRS) if (g.runFree(v.x, v.y, d, 1, L)) out.push({ type: 'sf', word, phrase: ph.id, verb: { table: { x: v.x, y: v.y } }, x: v.x, y: v.y, d, src });
    }
    const vc = hand.find((h) => h.k === 'V' && h.t === ph.verb);
    if (!vc) continue;
    if (src) {
      const spots = g.spots(L - 1);
      for (let i = 0; i < Math.min(spots.length, handSpots); i++) out.push({ type: 'sf', word, phrase: ph.id, verb: { hand: vc.id }, x: spots[i].x, y: spots[i].y, d: spots[i].d, src });
    }
    // Through a particle already down: never through the tile's own cell.
    for (const b of s.board) {
      if (b.k !== 'P' || b.cross) continue;
      ph.pattern.forEach((tok, i) => {
        if (tok !== b.t) return;
        const pi = ph.pattern.slice(0, i).filter((t) => t !== '~').length;
        for (const d of DIRS) {
          const vx = b.x - d[0] * (i + 1),
            vy = b.y - d[1] * (i + 1);
          if (!g.runFree(vx, vy, d, 0, L, i + 1)) continue;
          const src0 = g.plan(parts.filter((_, j) => j !== pi), wildIds);
          if (!src0) continue;
          let q = 0;
          out.push({ type: 'sf', word, phrase: ph.id, verb: { hand: vc.id }, x: vx, y: vy, d, src: parts.map((_, j) => (j === pi ? { existing: true as const } : src0[q++])) });
        }
      });
    }
  }
  return out;
}

/** Take a tile from the bag into p's hand: one at a time. Doesn't use a turn. The caller checks the bag holds it. */
export function pouchPut(s0: GameState, p: number, word: string): Result {
  if (!s0.sf || s0.over) return { ok: false, reason: { why: 'NotLegal', detail: 'stórfhocail are off in this game' } };
  if (!SF_WORD[word]) return { ok: false, reason: { why: 'NotLegal', detail: 'no such tile' } };
  if (s0.sf.pouch[p]?.length) return { ok: false, reason: { why: 'NotLegal', detail: 'one tile at a time' } };
  const s = clone(s0);
  s.sf!.pouch[p] = [...(s.sf!.pouch[p] ?? []), word];
  return { ok: true, state: s };
}

/** Put an unlaid tile back in the bag. */
export function pouchTake(s0: GameState, p: number, word: string): Result {
  const pouch = s0.sf?.pouch[p] ?? [];
  const i = pouch.indexOf(word);
  if (i < 0) return { ok: false, reason: { why: 'NotLegal', detail: 'not in the pouch' } };
  const s = clone(s0);
  s.sf!.pouch[p] = pouch.filter((_, j) => j !== i);
  return { ok: true, state: s };
}

function rejectSf(s: GameState, p: number, mv: SfMove): Rejection | null {
  if (!s.sf) return { why: 'NotLegal', detail: 'stórfhocail are off in this game' };
  const ph = SF_PHRASE[mv.phrase];
  if (!SF_WORD[mv.word] || !ph || ph.word !== mv.word) return { why: 'NotLegal', detail: 'that phrase is not on this tile' };
  if (!holdsTile(s, p, mv.word)) return { why: 'NotLegal', detail: 'tile not held' };
  if (!phraseInDeck(ph)) return { why: 'NotLegal', detail: "this deck can't make that phrase" };
  const parts = phraseParticles(ph);
  if (mv.src.length !== parts.length) return { why: 'NotLegal', detail: 'wrong number of particles' };
  const [dx, dy] = mv.d;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return { why: 'NotLegal', detail: 'bad direction' };
  const g = view(s);
  const hand = s.hands[p];
  const fromHand = 'hand' in mv.verb;
  if ('table' in mv.verb) {
    const v = g.at(mv.verb.table.x, mv.verb.table.y);
    if (!v || v.k !== 'V' || v.t !== ph.verb || v.x !== mv.x || v.y !== mv.y) return { why: 'NotLegal', detail: 'no such verb on the table' };
  } else {
    const vid = mv.verb.hand;
    const v = hand.find((h) => h.id === vid);
    if (!v || v.k !== 'V' || v.t !== ph.verb) return { why: 'NotLegal', detail: 'verb not in hand' };
    const occ = g.at(mv.x, mv.y);
    if (occ) return { why: 'Taken', by: occ.owner >= 0 ? occ.owner : null, card: { x: mv.x, y: mv.y } };
  }
  const tops = s.piles.map((pl) => pl.length);
  const usedWild = new Set<number>();
  let existing = 0,
    q = 0;
  for (let i = 0; i < ph.pattern.length; i++) {
    const tok = ph.pattern[i];
    const x = mv.x + dx * (i + 1),
      y = mv.y + dy * (i + 1),
      occ = g.at(x, y);
    if (tok === '~') {
      // The tile's cell is never shared.
      if (occ) return { why: 'Taken', by: occ.owner >= 0 ? occ.owner : null, card: { x, y } };
      continue;
    }
    const src = mv.src[q++];
    if ('existing' in src) {
      existing++;
      if (!fromHand) return { why: 'NotLegal', detail: 'a line through a particle needs a verb from the hand' };
      if (!occ || occ.k !== 'P' || occ.t !== tok || occ.cross) return { why: 'NotLegal', detail: 'cannot run through that card' };
      continue;
    }
    if (occ) return { why: 'Taken', by: occ.owner >= 0 ? occ.owner : null, card: { x, y } };
    if ('river' in src) {
      const pl = s.piles[src.river];
      if (!pl || tops[src.river] === 0 || pl[tops[src.river] - 1].t !== tok) return { why: 'Taken', by: lastRiverTaker(s, src.river), card: { river: src.river } };
      tops[src.river]--;
    } else {
      const w = hand.find((h) => h.id === src.wild);
      if (!w || w.k !== 'W' || usedWild.has(w.id)) return { why: 'NotLegal', detail: 'wildcard not in hand' };
      usedWild.add(w.id);
    }
  }
  if (existing > 1) return { why: 'NotLegal', detail: 'only one particle may be shared' };
  return null;
}

export function isStraddle(mv: LineMove | SfMove) {
  return mv.src.some((x) => 'existing' in x);
}

export function loneMoves(s: GameState, p: number): LoneMove[] {
  if (!canDraw(s)) return [];
  const g = view(s);
  const out: LoneMove[] = [];
  const seen = new Set<string>();
  for (const v of s.hands[p]) {
    if (v.k !== 'V' || seen.has(v.t)) continue;
    seen.add(v.t);
    const sp = g.spots(2)[0];
    if (sp) out.push({ type: 'lone', v: v.id, x: sp.x, y: sp.y });
  }
  return out;
}

export function shed(mv: LineMove) {
  return (mv.onto ? 0 : 1) + ('hand' in mv.verb ? 1 : 0) + mv.src.filter((x) => 'wild' in x).length;
}

/** The bot's ranking of a line: cards shed, wildcards slightly held back. */
/** A line that uses no card already on the table. */
export function isFresh(mv: LineMove) {
  return 'hand' in mv.verb && !mv.onto && !isStraddle(mv);
}

/** Cards a line draws afterwards under the fresh-line rule. */
export function lineDraws(s: GameState, mv: LineMove) {
  return s.config.rules?.freshLineDraw && isFresh(mv) ? s.config.rules.freshLineDraw : 0;
}

/** The bot's ranking of a line: net cards shed, wildcards slightly held back. */
export function lineScore(mv: LineMove, s?: GameState) {
  return shed(mv) - (s ? lineDraws(s, mv) : 0) - mv.src.filter((x) => 'wild' in x).length * 0.6;
}

export function bestLine(lines: LineMove[], s?: GameState): LineMove | null {
  if (!lines.length) return null;
  return [...lines].sort((a, b) => lineScore(b, s) - lineScore(a, s))[0];
}

// ---------- validation ----------

function rejectLine(s: GameState, p: number, mv: LineMove): Rejection | null {
  const g = view(s);
  const hand = s.hands[p];
  const c: Compound | undefined = COMPOUND_BY_ID[mv.c];
  let m: Card | undefined;
  if (mv.onto) {
    if (!s.config.rules?.tableMeanings) return { why: 'NotLegal', detail: 'lines onto table meaning cards are off' };
    m = g.at(mv.onto.x, mv.onto.y);
    if (!m || m.k !== 'M' || m.id !== mv.m) return { why: 'Taken', by: null, card: { x: mv.onto.x, y: mv.onto.y } };
    if (!('hand' in mv.verb)) return { why: 'NotLegal', detail: 'a line onto a table meaning card needs a verb from the hand' };
    if (mv.src.some((x) => 'existing' in x)) return { why: 'NotLegal', detail: 'a line onto a table meaning card cannot also cross a particle' };
    const L0 = c ? c.ps.length : 0;
    if (mv.x + mv.d[0] * (L0 + 1) !== mv.onto.x || mv.y + mv.d[1] * (L0 + 1) !== mv.onto.y) return { why: 'NotLegal', detail: 'the line must end on that meaning card' };
  } else {
    m = hand.find((x) => x.id === mv.m);
    if (!m || m.k !== 'M') return { why: 'NotLegal', detail: 'meaning card not in hand' };
  }
  if (!c || c.g !== mv.g || !meaningsOf(m).includes(mv.g)) return { why: 'NotLegal', detail: 'compound does not match meaning' };
  if (mv.src.length !== c.ps.length) return { why: 'NotLegal', detail: 'wrong number of particles' };
  const [dx, dy] = mv.d;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return { why: 'NotLegal', detail: 'bad direction' };
  const fromHand = 'hand' in mv.verb;
  if ('table' in mv.verb) {
    const v = g.at(mv.verb.table.x, mv.verb.table.y);
    if (!v || v.k !== 'V' || v.t !== c.v || v.x !== mv.x || v.y !== mv.y) return { why: 'NotLegal', detail: 'no such verb on the table' };
  } else {
    const vid = mv.verb.hand;
    const v = hand.find((h) => h.id === vid);
    if (!v || v.k !== 'V' || v.t !== c.v) return { why: 'NotLegal', detail: 'verb not in hand' };
    const occ = g.at(mv.x, mv.y);
    if (occ) return { why: 'Taken', by: occ.owner >= 0 ? occ.owner : null, card: { x: mv.x, y: mv.y } };
  }
  const tops = s.piles.map((pl) => pl.length);
  const usedWild = new Set<number>();
  let existing = 0;
  for (let i = 0; i < c.ps.length; i++) {
    const x = mv.x + dx * (i + 1),
      y = mv.y + dy * (i + 1),
      src = mv.src[i],
      occ = g.at(x, y);
    if ('existing' in src) {
      existing++;
      if (!fromHand) return { why: 'NotLegal', detail: 'a line through a particle needs a verb from the hand' };
      if (!occ) return { why: 'NotLegal', detail: 'no particle to cross' };
      if (occ.k !== 'P' || occ.t !== c.ps[i] || occ.cross) return { why: 'NotLegal', detail: 'cannot cross that card' };
      continue;
    }
    if (occ) return { why: 'Taken', by: occ.owner >= 0 ? occ.owner : null, card: { x, y } };
    if ('river' in src) {
      const pl = s.piles[src.river];
      if (!pl || tops[src.river] === 0 || pl[tops[src.river] - 1].t !== c.ps[i])
        return { why: 'Taken', by: lastRiverTaker(s, src.river), card: { river: src.river } };
      tops[src.river]--;
    } else {
      const w = hand.find((h) => h.id === src.wild);
      if (!w || w.k !== 'W' || usedWild.has(w.id)) return { why: 'NotLegal', detail: 'wildcard not in hand' };
      usedWild.add(w.id);
    }
  }
  if (existing > 1) return { why: 'NotLegal', detail: 'only one particle may be crossed' };
  if (mv.onto) return null;
  const L = c.ps.length;
  const mo = g.at(mv.x + dx * (L + 1), mv.y + dy * (L + 1));
  if (mo) return { why: 'Taken', by: mo.owner >= 0 ? mo.owner : null, card: { x: mo.x, y: mo.y } };
  return null;
}

function lastRiverTaker(s: GameState, pile: number): number | null {
  for (let i = s.log.length - 1; i >= 0; i--) {
    const e = s.log[i];
    if (e.e === 'line' && e.river.includes(pile)) return e.p;
  }
  return null;
}

export function check(s: GameState, p: number, mv: Move): Rejection | null {
  if (s.over) return { why: 'NotLegal', detail: 'game over' };
  if (s.config.mode === 'turns' && s.turn !== p) return { why: 'NotLegal', detail: 'not your turn' };
  const hand = s.hands[p];
  if (mv.type === 'line') return rejectLine(s, p, mv);
  if (mv.type === 'sf') return rejectSf(s, p, mv);
  if (mv.type === 'lone') {
    const v = hand.find((c) => c.id === mv.v);
    if (!v || v.k !== 'V') return { why: 'NotLegal', detail: 'verb not in hand' };
    if (!canDraw(s)) return { why: 'NotLegal', detail: 'both piles are empty' };
    const occ = view(s).at(mv.x, mv.y);
    if (occ) return { why: 'Taken', by: occ.owner >= 0 ? occ.owner : null, card: { x: mv.x, y: mv.y } };
    return null;
  }
  const m = hand.find((c) => c.id === mv.m);
  if (!m || m.k !== 'M') return { why: 'NotLegal', detail: 'meaning card not in hand' };
  if (!s.faceUp) return { why: 'NotLegal', detail: 'no face-up meaning' };
  return null;
}

// ---------- applying ----------

function removeFromHand(hand: Card[], id: number): Card {
  const i = hand.findIndex((c) => c.id === id);
  return hand.splice(i, 1)[0];
}

/** Draw one card for p (RULES §6). `meaningRule`: when passing or at a stall, fewer than 2 meanings draws a meaning. */
function drawOne(s: GameState, p: number, meaningRule: boolean): Card | null {
  const h = s.hands[p];
  const nm = h.filter((c) => c.k === 'M').length;
  let c: Card | undefined;
  if (meaningRule && nm < 2 && s.mpile.length) c = s.mpile.pop();
  else if (s.main.length) c = s.main.pop();
  else if (s.mpile.length) c = s.mpile.pop();
  if (!c) return null;
  h.push(c);
  return c;
}

function advance(s: GameState) {
  if (s.config.mode !== 'turns' || s.over) return;
  s.turn = (s.turn + 1) % s.hands.length;
  s.turnNo++;
}

function checkOut(s: GameState, p: number) {
  if (!s.hands[p].length && !s.over) {
    s.over = { how: 'out', winners: [p], tie: false, counts: s.hands.map((h) => h.length) };
    s.log.push({ e: 'end', how: 'out' });
  }
}

function endFewest(s: GameState) {
  const counts = s.hands.map((h) => h.length);
  const best = Math.min(...counts);
  const winners = counts.map((n, i) => (n === best ? i : -1)).filter((i) => i >= 0);
  s.over = { how: 'fewest', winners, tie: winners.length > 1, counts };
  s.log.push({ e: 'end', how: 'fewest' });
}

/** Bury: every pile with more than one card turns its top under. Then count final stalls:
 *  a stall counts once the piles were already empty before its last draw (as the reference does).
 *  With swapIsPass only the main deck counts: swaps cycle the meaning pile, so it may never empty. */
function stall(s: GameState, drew: (number | null)[], emptyBefore: boolean) {
  for (const pl of s.piles) if (pl.length > 1) pl.unshift(pl.pop()!);
  let final: number | null = null;
  if (emptyBefore || (s.config.rules?.swapIsPass && !s.main.length)) {
    s.stalls++;
    final = s.stalls;
  }
  s.passes = 0;
  s.stuck = s.stuck.map(() => false);
  s.log.push({ e: 'stall', drew, final, turnNo: s.turnNo });
  s.quiet = (s.quiet ?? 0) + 1;
  if (final !== null && s.stalls >= FINAL_STALLS) endFewest(s);
  // Backstop: with swaps counting as passes nobody need ever draw, so the deck may never run out.
  else if (s.config.rules?.swapIsPass && s.quiet >= QUIET_STALLS) endFewest(s);
}

/** With swapIsPass: this many stalls in a row with no line or lone verb laid end the game. */
export const QUIET_STALLS = 4;

/** RULES §8: once both piles are empty, two stalls in a row with no line between them end the game. */
export const FINAL_STALLS = 2;

export function apply(s0: GameState, p: number, mv: Move): Result {
  useDeckOf(s0);
  const bad = check(s0, p, mv);
  if (bad) return { ok: false, reason: bad };
  const s = clone(s0);
  const g = new Ctx(s);
  const hand = s.hands[p];
  let ev: GameEvent;
  if (mv.type === 'lone') {
    const v = removeFromHand(hand, mv.v);
    g.put(mv.x, mv.y, v, null, p);
    const drew: number[] = [];
    for (let i = 0; i < DECK.loneVerbDraw; i++) {
      const c = drawOne(s, p, !!s.config.rules?.meaningOnAnyDraw);
      if (c) drew.push(c.id);
    }
    ev = { e: 'lone', p, word: v.t, x: mv.x, y: mv.y, drew, turnNo: s.turnNo };
    s.stalls = s.config.legacyStall ? s.stalls : 0;
    s.quiet = 0;
  } else if (mv.type === 'swap') {
    const m = removeFromHand(hand, mv.m);
    const took = s.faceUp!;
    hand.push(took);
    if (s.config.rules?.swapRefresh && s.mpile.length) {
      s.mpile.unshift(m);
      s.faceUp = s.mpile.pop()!;
    } else s.faceUp = m;
    ev = { e: 'swap', p, gave: m.id, took: took.id, turnNo: s.turnNo };
  } else if (mv.type === 'sf') {
    const ph = SF_PHRASE[mv.phrase];
    const [dx, dy] = mv.d,
      axis = dx ? 'h' : 'v';
    const cells: [number, number][] = [];
    const river: number[] = [];
    if ('hand' in mv.verb) g.put(mv.x, mv.y, removeFromHand(hand, mv.verb.hand), null, p);
    cells.push([mv.x, mv.y]);
    let q = 0;
    ph.pattern.forEach((tok, i) => {
      const x = mv.x + dx * (i + 1),
        y = mv.y + dy * (i + 1);
      if (tok === '~') g.put(x, y, { id: SF_CARD_ID + s.lines.length, k: 'S', t: mv.word }, axis, p, { phrase: ph.id });
      else {
        const src = mv.src[q++];
        if ('existing' in src) g.at(x, y)!.cross = true;
        else if ('wild' in src) g.put(x, y, removeFromHand(hand, src.wild), axis, p, { stands: tok });
        else {
          g.put(x, y, s.piles[src.river].pop()!, axis, p);
          river.push(src.river);
        }
      }
      cells.push([x, y]);
    });
    const sf = s.sf!;
    const pouch = sf.pouch[p] ?? [];
    if (pouch.includes(mv.word)) sf.pouch[p] = pouch.filter((w, i) => w !== mv.word || i !== pouch.indexOf(mv.word));
    sf.laid.push({ word: mv.word, phrase: ph.id, p });
    // The player's tile opens a stake; a bot's answers it.
    sf.stake = s.config.players[p]?.kind === 'human';
    const wild = mv.src.some((x) => 'wild' in x),
      straddle = isStraddle(mv);
    s.lines.push({ p, c: ph.id, g: ph.meaning, cells, wild, straddle, turnNo: s.turnNo, sf: true });
    ev = { e: 'line', p, c: ph.id, g: ph.meaning, cells, wild, straddle, river, turnNo: s.turnNo, sf: true };
    if (!s.config.legacyStall) s.stalls = 0;
    s.quiet = 0;
  } else {
    const c = COMPOUND_BY_ID[mv.c];
    const [dx, dy] = mv.d,
      axis = dx ? 'h' : 'v';
    const cells: [number, number][] = [];
    const river: number[] = [];
    if ('hand' in mv.verb) g.put(mv.x, mv.y, removeFromHand(hand, mv.verb.hand), null, p);
    cells.push([mv.x, mv.y]);
    c.ps.forEach((pt, i) => {
      const x = mv.x + dx * (i + 1),
        y = mv.y + dy * (i + 1),
        src = mv.src[i];
      if ('existing' in src) g.at(x, y)!.cross = true;
      else if ('wild' in src) g.put(x, y, removeFromHand(hand, src.wild), axis, p, { stands: pt });
      else {
        g.put(x, y, s.piles[src.river].pop()!, axis, p);
        river.push(src.river);
      }
      cells.push([x, y]);
    });
    const L = c.ps.length;
    const mx = mv.x + dx * (L + 1),
      my = mv.y + dy * (L + 1);
    if (mv.onto) g.at(mx, my)!.cross = true;
    else g.put(mx, my, removeFromHand(hand, mv.m), axis, p, { used: mv.g });
    cells.push([mx, my]);
    const wild = mv.src.some((x) => 'wild' in x),
      straddle = isStraddle(mv);
    s.lines.push({ p, c: c.id, g: mv.g, cells, wild, straddle, turnNo: s.turnNo });
    if (s.config.rules?.refillMeaning && hand.length && !hand.some((x) => x.k === 'M') && s.mpile.length) hand.push(s.mpile.pop()!);
    ev = { e: 'line', p, c: c.id, g: mv.g, cells, wild, straddle, river, turnNo: s.turnNo };
    const nDraw = lineDraws(s, mv);
    if (nDraw && hand.length) {
      const drew: number[] = [];
      for (let i = 0; i < nDraw; i++) {
        const d = drawOne(s, p, !!s.config.rules?.meaningOnAnyDraw);
        if (d) drew.push(d.id);
      }
      ev.drew = drew;
    }
    if (!s.config.legacyStall) s.stalls = 0;
    s.quiet = 0;
  }
  const swapPass = mv.type === 'swap' && !!s.config.rules?.swapIsPass && s.config.mode === 'turns';
  s.passes = swapPass ? s.passes + 1 : 0;
  s.stuck[p] = false;
  s.log.push(ev);
  checkOut(s, p);
  if (swapPass && s.passes >= s.hands.length) stall(s, [], !canDraw(s));
  advance(s);
  return { ok: true, state: s };
}

function recordMissed(s: GameState, p: number) {
  if (s.config.players[p]?.kind !== 'human' || s.missed[p].length >= 3) return;
  const best = bestLine(lineMoves(s, p, { handSpots: 1 }), s);
  if (!best || s.missed[p].some((m) => m.c === best.c)) return;
  s.missed[p].push({
    c: best.c,
    g: best.g,
    turnNo: s.turnNo,
    wild: best.src.some((x) => 'wild' in x),
    river: best.src.flatMap((x) => ('river' in x ? [s.piles[x.river][s.piles[x.river].length - 1].t] : [])),
    verbOnTable: 'table' in best.verb,
  });
}

/** Turn mode: draw one and pass. Always allowed on your turn. */
export function pass(s0: GameState, p: number): Result {
  if (s0.over || s0.config.mode !== 'turns' || s0.turn !== p) return { ok: false, reason: { why: 'NotLegal', detail: 'not your turn' } };
  const s = clone(s0);
  recordMissed(s, p);
  const emptyBefore = !canDraw(s);
  const c = s.config.rules?.noPassDraw ? null : drawOne(s, p, true);
  s.passes++;
  s.log.push({ e: 'pass', p, drew: c ? c.id : null, turnNo: s.turnNo });
  if (s.passes >= s.hands.length) stall(s, [], emptyBefore);
  advance(s);
  return { ok: true, state: s };
}

/** Hidden mode, turn mode: a wrong line ends the turn with no draw and counts as a pass. */
export function wrongLine(s0: GameState, p: number): Result {
  if (s0.over) return { ok: false, reason: { why: 'NotLegal', detail: 'game over' } };
  const s = clone(s0);
  s.log.push({ e: 'wrong', p, turnNo: s.turnNo });
  if (s.config.mode === 'turns') {
    if (s.turn !== p) return { ok: false, reason: { why: 'NotLegal', detail: 'not your turn' } };
    s.passes++;
    if (s.passes >= s.hands.length) stall(s, [], !canDraw(s));
    advance(s);
  }
  return { ok: true, state: s };
}

/** Race mode: toggle Stuck. */
export function setStuck(s0: GameState, p: number, on: boolean): GameState {
  if (s0.stuck[p] === on || s0.over) return s0;
  const s = clone(s0);
  if (on) recordMissed(s, p);
  s.stuck[p] = on;
  s.log.push({ e: 'stuck', p, on });
  return s;
}

/** Race mode stall: everyone draws one (RULES §6), then the river is buried. */
export function raceStall(s0: GameState): GameState {
  if (s0.over) return s0;
  const s = clone(s0);
  const emptyBefore = !canDraw(s);
  const drew = s.hands.map((_, p) => drawOne(s, p, true)?.id ?? null);
  stall(s, drew, emptyBefore);
  s.turnNo++;
  return s;
}

export function useHint(s0: GameState, p: number): GameState {
  if (s0.hintsUsed[p]) return s0;
  const s = clone(s0);
  s.hintsUsed[p] = true;
  return s;
}

/** All compounds, for anything that needs the full list in deck order. */
export { COMPOUNDS };

// Queries for the line builder. `legal moves are the only source of highlights`: everything the UI
// lights or lays comes from here. Also hidden-mode attempts and hints.
import { COMPOUNDS_BY_MEANING, COMPOUNDS_BY_VERB, COMPOUND_BY_ID, compoundText, type Compound } from './deck';
import { DIRS, bestLine, lineMoves, meaningsOf, view, type Ctx } from './game';
import type { Card, Dir, GameState, LineMove, Rejection, Src, VerbSrc } from './types';

/** What the player has picked so far. Any field may be empty; order of picking is free. */
export interface Selection {
  meaning?: number;
  verb?: VerbSrc;
  /** River piles tapped, wildcards tapped, and table particles tapped (to cross). */
  river: number[];
  wild: number[];
  cross?: { x: number; y: number };
  /** A meaning card already on the table, picked as the line's meaning (rule variant tableMeanings). */
  onto?: { x: number; y: number };
}

export const emptySelection = (): Selection => ({ river: [], wild: [] });

/** One way to complete a line: a compound, a verb and particle sources. Placement is chosen separately. */
export interface Way {
  m: number;
  g: string;
  c: string;
  verb: VerbSrc;
  src: Src[];
  /** For a crossing line: the table particle crossed. */
  cross?: { x: number; y: number };
  /** For a line onto a table meaning card: that card's cell (m is its card id). */
  onto?: { x: number; y: number };
}

export interface Placement {
  x: number;
  y: number;
  d: Dir;
}

/** River sources and wildcards that could provide `ps` (ignoring any index in `skip`), every combination. */
function sourceCombos(s: GameState, ps: string[], wildIds: number[], skip: number): Src[][] {
  const out: Src[][] = [];
  const tops = s.piles.map((p) => p.length);
  const used = new Set<number>();
  const cur: Src[] = [];
  const rec = (i: number) => {
    if (out.length > 64) return;
    if (i === ps.length) {
      out.push([...cur]);
      return;
    }
    if (i === skip) {
      cur.push({ existing: true });
      rec(i + 1);
      cur.pop();
      return;
    }
    for (let j = 0; j < s.piles.length; j++) {
      if (tops[j] > 0 && s.piles[j][tops[j] - 1].t === ps[i]) {
        tops[j]--;
        cur.push({ river: j });
        rec(i + 1);
        cur.pop();
        tops[j]++;
      }
    }
    for (const w of wildIds) {
      if (used.has(w)) continue;
      used.add(w);
      cur.push({ wild: w });
      rec(i + 1);
      cur.pop();
      used.delete(w);
      break; // wildcards are interchangeable: try only the first free one
    }
  };
  rec(0);
  return out;
}

function tableVerbDirs(g: Ctx, x: number, y: number, L: number): Dir[] {
  return DIRS.filter((d) => g.runFree(x, y, d, 1, L + 1));
}

function crossPlacements(g: Ctx, bx: number, by: number, i: number, L: number): Placement[] {
  const out: Placement[] = [];
  for (const d of DIRS) {
    const vx = bx - d[0] * (i + 1),
      vy = by - d[1] * (i + 1);
    if (g.runFree(vx, vy, d, 0, L + 1, i + 1)) out.push({ x: vx, y: vy, d });
  }
  return out;
}

/** Every way to complete a line for player p consistent with the selection. */
export function ways(s: GameState, p: number, sel: Selection): Way[] {
  const g = view(s);
  const hand = s.hands[p];
  const wildIds = hand.filter((c) => c.k === 'W').map((c) => c.id);
  const meaningCards = sel.onto ? [] : hand.filter((c) => c.k === 'M' && (sel.meaning === undefined || c.id === sel.meaning));
  const out: Way[] = [];
  const handVerbs = hand.filter((c) => c.k === 'V');
  for (const m of meaningCards)
    for (const gl of meaningsOf(m))
      for (const c of COMPOUNDS_BY_MEANING[gl] ?? []) {
        const L = c.ps.length;
        const verbOk = (v: VerbSrc) => {
          if (!sel.verb) return true;
          if ('table' in sel.verb) return 'table' in v && v.table.x === sel.verb.table.x && v.table.y === sel.verb.table.y;
          return 'hand' in v && v.hand === sel.verb.hand;
        };
        const srcOk = (src: Src[]) => {
          for (const r of sel.river) if (!src.some((x) => 'river' in x && x.river === r)) return false;
          for (const w of sel.wild) if (!src.some((x) => 'wild' in x && x.wild === w)) return false;
          // Two taps on one pile mean two cards from it.
          const counts = new Map<number, number>();
          for (const r of sel.river) counts.set(r, (counts.get(r) ?? 0) + 1);
          for (const [r, n] of counts) if (src.filter((x) => 'river' in x && x.river === r).length < n) return false;
          return true;
        };
        if (!sel.cross) {
          // Verbs on the table.
          for (const v of s.board) {
            if (v.k !== 'V' || v.t !== c.v) continue;
            const vs: VerbSrc = { table: { x: v.x, y: v.y } };
            if (!verbOk(vs) || !tableVerbDirs(g, v.x, v.y, L).length) continue;
            for (const src of sourceCombos(s, c.ps, wildIds, -1)) if (srcOk(src)) out.push({ m: m.id, g: gl, c: c.id, verb: vs, src });
          }
          // A verb from the hand: one way per distinct verb card picked (any copy will do).
          const hvs = sel.verb && 'hand' in sel.verb ? handVerbs.filter((h) => h.id === (sel.verb as { hand: number }).hand) : handVerbs;
          const hv = hvs.find((h) => h.t === c.v);
          if (hv)
            for (const src of sourceCombos(s, c.ps, wildIds, -1))
              if (srcOk(src)) out.push({ m: m.id, g: gl, c: c.id, verb: { hand: hv.id }, src });
        }
        // Lines through a particle already down.
        const hvs = sel.verb && 'hand' in sel.verb ? handVerbs.filter((h) => h.id === (sel.verb as { hand: number }).hand) : sel.verb ? [] : handVerbs;
        const hv = hvs.find((h) => h.t === c.v);
        if (!hv) continue;
        for (const b of s.board) {
          if (b.k !== 'P' || b.cross) continue;
          if (sel.cross && (sel.cross.x !== b.x || sel.cross.y !== b.y)) continue;
          c.ps.forEach((pt, i) => {
            if (pt !== b.t || !crossPlacements(g, b.x, b.y, i, L).length) return;
            for (const src of sourceCombos(s, c.ps, wildIds, i))
              if (srcOk(src)) out.push({ m: m.id, g: gl, c: c.id, verb: { hand: hv.id }, src, cross: { x: b.x, y: b.y } });
          });
        }
      }
  // Lines onto a meaning card already on the table: any of its meanings, verb from the hand.
  if (s.config.rules?.tableMeanings && sel.meaning === undefined && !sel.cross && !(sel.verb && 'table' in sel.verb)) {
    const hvs = sel.verb && 'hand' in sel.verb ? handVerbs.filter((h) => h.id === (sel.verb as { hand: number }).hand) : handVerbs;
    for (const t of s.board) {
      if (t.k !== 'M' || (sel.onto && (sel.onto.x !== t.x || sel.onto.y !== t.y))) continue;
      for (const gl of meaningsOf(t))
        for (const c of COMPOUNDS_BY_MEANING[gl] ?? []) {
          const hv = hvs.find((h) => h.t === c.v);
          if (!hv || !ontoPlacements(g, t.x, t.y, c.ps.length).length) continue;
          for (const src of sourceCombos(s, c.ps, wildIds, -1)) {
            let ok = true;
            for (const r of sel.river) if (!src.some((x) => 'river' in x && x.river === r)) ok = false;
            for (const w of sel.wild) if (!src.some((x) => 'wild' in x && x.wild === w)) ok = false;
            if (ok) out.push({ m: t.id, g: gl, c: c.id, verb: { hand: hv.id }, src, onto: { x: t.x, y: t.y } });
          }
        }
    }
  }
  return out;
}

/** Where a line of L particles can arrive at a table meaning card: the verb L+1 cells back, all cells free. */
function ontoPlacements(g: Ctx, tx: number, ty: number, L: number): Placement[] {
  const out: Placement[] = [];
  for (const d of DIRS) {
    const vx = tx - d[0] * (L + 1),
      vy = ty - d[1] * (L + 1);
    if (g.runFree(vx, vy, d, 0, L)) out.push({ x: vx, y: vy, d });
  }
  return out;
}

/** Placements for a way, nearest the focus point first. */
export function placements(s: GameState, w: Way, focus?: { x: number; y: number }): Placement[] {
  const g = view(s);
  const c = COMPOUND_BY_ID[w.c];
  const L = c.ps.length;
  let out: Placement[];
  if (w.onto) out = ontoPlacements(g, w.onto.x, w.onto.y, L);
  else if (w.cross) {
    const i = w.src.findIndex((x) => 'existing' in x);
    out = crossPlacements(g, w.cross.x, w.cross.y, i, L);
  } else if ('table' in w.verb) {
    const { x, y } = w.verb.table;
    out = tableVerbDirs(g, x, y, L).map((d) => ({ x, y, d }));
  } else out = g.spots(L).map(({ x, y, d }) => ({ x, y, d }));
  const [x0, y0, x1, y1] = g.bounds();
  const f = focus ?? { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const score = (pl: Placement) => {
    const mx = pl.x + (pl.d[0] * (L + 1)) / 2,
      my = pl.y + (pl.d[1] * (L + 1)) / 2;
    // Prefer lines near the focus that leave the board compact; rightward and downward lines read best.
    return Math.abs(mx - f.x) + Math.abs(my - f.y) + (pl.d[0] < 0 || pl.d[1] < 0 ? 0.3 : 0) + (pl.d[1] !== 0 ? 0.1 : 0);
  };
  return out.map((pl) => [score(pl), pl] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

export function wayToMove(w: Way, pl: Placement): LineMove {
  const mv: LineMove = { type: 'line', m: w.m, g: w.g, c: w.c, verb: w.verb, x: pl.x, y: pl.y, d: pl.d, src: w.src };
  if (w.onto) mv.onto = w.onto;
  return mv;
}

/** Fewest wildcards, then river piles in order: the default way among equals. */
export function preferredWay(ws: Way[]): Way | null {
  if (!ws.length) return null;
  const wilds = (w: Way) => w.src.filter((x) => 'wild' in x).length;
  return [...ws].sort((a, b) => wilds(a) - wilds(b))[0];
}

export interface Lit {
  meanings: Set<number>;
  handVerbs: Set<number>;
  tableCells: Set<string>;
  river: Set<number>;
  wild: Set<number>;
}

/** Everything that would extend the current selection toward some completion. */
export function lit(s: GameState, p: number, sel: Selection, ws = ways(s, p, sel)): Lit {
  const out: Lit = { meanings: new Set(), handVerbs: new Set(), tableCells: new Set(), river: new Set(), wild: new Set() };
  const hand = s.hands[p];
  for (const w of ws) {
    if (w.onto) {
      if (!sel.onto) out.tableCells.add(w.onto.x + ',' + w.onto.y);
    } else if (sel.meaning === undefined) out.meanings.add(w.m);
    if (!sel.verb) {
      if ('table' in w.verb) out.tableCells.add(w.verb.table.x + ',' + w.verb.table.y);
      else {
        // light every copy of the verb in hand
        const t = hand.find((c) => c.id === (w.verb as { hand: number }).hand)!.t;
        for (const c of hand) if (c.k === 'V' && c.t === t) out.handVerbs.add(c.id);
      }
    }
    for (const x of w.src) {
      if ('river' in x) out.river.add(x.river);
      if ('wild' in x) for (const c of hand) if (c.k === 'W') out.wild.add(c.id);
    }
    if (w.cross && !sel.cross) out.tableCells.add(w.cross.x + ',' + w.cross.y);
  }
  for (const r of sel.river) out.river.delete(r);
  return out;
}

/** The distinct compounds among a set of ways (the "two ways to finish" choice). */
export function distinctCompounds(ws: Way[]): string[] {
  return [...new Set(ws.map((w) => w.c))];
}

// ---------- hidden mode ----------

export interface Attempt {
  /** A meaning card id: from the hand, or the table card at `onto`. */
  meaning: number;
  onto?: { x: number; y: number };
  verb: VerbSrc;
  /** Particle sources in the order picked. */
  parts: ({ river: number } | { wild: number } | { cross: { x: number; y: number } })[];
  place?: Placement;
}

export type AttemptResult = { ok: true; move: LineMove } | { ok: false; reason: Rejection };

/** Judge a hidden-mode line. A wildcard matches any particle. */
export function judge(s: GameState, p: number, a: Attempt, focus?: { x: number; y: number }): AttemptResult {
  const g = view(s);
  const hand = s.hands[p];
  const m = a.onto ? g.at(a.onto.x, a.onto.y) : hand.find((c) => c.id === a.meaning);
  if (!m || m.k !== 'M') return { ok: false, reason: { why: 'NotLegal', detail: 'Pick a meaning card' } };
  if (a.onto && 'table' in a.verb) return { ok: false, reason: { why: 'NotLegal', detail: 'A line onto a meaning card on the table needs a verb from your hand' } };
  let verbWord: string | undefined;
  if ('table' in a.verb) verbWord = g.at(a.verb.table.x, a.verb.table.y)?.t;
  else {
    const id = a.verb.hand;
    verbWord = hand.find((c) => c.id === id)?.t;
  }
  if (!verbWord) return { ok: false, reason: { why: 'NotLegal', detail: 'Pick a verb' } };
  if (!a.parts.length) return { ok: false, reason: { why: 'NotLegal', detail: 'Pick the particles from the river' } };
  // Words as picked, simulating two taps on one pile.
  const tops = s.piles.map((pl) => pl.length);
  const words: (string | null)[] = [];
  for (const x of a.parts) {
    if ('river' in x) {
      const pl = s.piles[x.river];
      if (!tops[x.river]) return { ok: false, reason: { why: 'Taken', by: null, card: { river: x.river } } };
      words.push(pl[--tops[x.river]].t);
    } else if ('wild' in x) words.push(null);
    else words.push(g.at(x.cross.x, x.cross.y)?.t ?? '');
  }
  const fits = (COMPOUNDS_BY_VERB[verbWord] ?? []).filter(
    (c) => c.ps.length === words.length && c.ps.every((w, i) => words[i] === null || words[i] === w),
  );
  const shown = words.map((w) => w ?? '?');
  if (!fits.length) return { ok: false, reason: { why: 'WrongLine', kind: 'NoSuchCompound', verb: verbWord, parts: shown } };
  const opts = meaningsOf(m);
  const c: Compound | undefined = fits.find((c) => opts.includes(c.g));
  if (!c) return { ok: false, reason: { why: 'WrongLine', kind: 'NotOnCard', text: compoundText(fits[0]) } };
  const crossIdx = a.parts.findIndex((x) => 'cross' in x);
  const src: Src[] = a.parts.map((x) => ('river' in x ? { river: x.river } : 'wild' in x ? { wild: x.wild } : { existing: true }));
  const w: Way = { m: m.id, g: c.g, c: c.id, verb: a.verb, src };
  if (a.onto) {
    if (crossIdx >= 0) return { ok: false, reason: { why: 'NotLegal', detail: 'A line onto a meaning card on the table cannot also cross a particle' } };
    w.onto = a.onto;
  }
  if (crossIdx >= 0) {
    const cr = (a.parts[crossIdx] as { cross: { x: number; y: number } }).cross;
    if ('table' in a.verb) return { ok: false, reason: { why: 'NotLegal', detail: 'A line through a particle needs a verb from your hand' } };
    w.cross = cr;
  }
  const pls = placements(s, w, focus);
  const pl = a.place && pls.some((q) => q.x === a.place!.x && q.y === a.place!.y && q.d[0] === a.place!.d[0] && q.d[1] === a.place!.d[1]) ? a.place : pls[0];
  if (!pl) return { ok: false, reason: { why: 'NotLegal', detail: 'No room for that line' } };
  return { ok: true, move: wayToMove(w, pl) };
}

// ---------- hints ----------

/** One usable verb for the selected meaning card, or null. */
export function hint(s: GameState, p: number, meaningId: number): VerbSrc | null {
  const m = s.hands[p].find((c) => c.id === meaningId);
  if (!m) return null;
  const best = bestLine(lineMoves(s, p, { meanings: [m as Card], handSpots: 1 }));
  return best ? best.verb : null;
}

/** Does p hold any legal line right now? */
export function hasLine(s: GameState, p: number): boolean {
  return lineMoves(s, p, { handSpots: 1 }).length > 0;
}

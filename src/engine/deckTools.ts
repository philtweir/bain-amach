// Deck editor tools (spec/deck-editor.md): which compounds a custom deck can make, its meaning cards,
// its hand sizes, validation, and the built deck the engine deals from. Pure functions over the base
// deck (deck.json) and the editor's settings. A port of handoff/reference/editor/deck-tools.js: same
// outputs for the same inputs and seed.
import type { DeckCompound, DeckData } from './deck';

/** What the editor stores for one deck (the deck itself is rebuilt from it). */
export interface CustomSettings {
  name: string;
  verbs: Record<string, number>;
  particles: Record<string, number>;
  wildcards: number;
  /** Selected glosses, kept even while the counts can't make them. */
  meanings: string[];
  meaningCards: number;
  seed: number;
}

export interface CustomDeck extends CustomSettings {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** deck.json version it was made against. */
  baseVersion: string;
  /** Stored, so a generator change never alters a saved deck. */
  generated: { id: string; meanings: string[] }[];
  /** Presets ship locked: duplicate one to change it. */
  locked?: boolean;
}

export interface Issue {
  code: string;
  text: string;
  items?: string[];
  meanings?: string[];
}

export type PlayerFit = { ok: true; handSize: number; note?: string } | { ok: false; reason: string };

export interface Validation {
  errors: Issue[];
  warnings: Issue[];
  players: Record<2 | 3 | 4, PlayerFit>;
}

export const MIN_HAND = 7;
/** At most this many meaning cards; never fewer than the bundled deck has (it grew past 60 with drafts). */
export const maxCards = (base: DeckData) => Math.max(60, base.meaningCards.length);
export const MAX_COPIES = 12;
export const MAX_WILDCARDS = 8;
const COUNTS = [2, 3, 4] as const;

/** mulberry32, as the reference uses. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

/** Hand size per player count: the base size, shrunk until verbs + wildcards deal every hand in full; null below MIN_HAND. */
export function handSizes(base: DeckData, custom: CustomSettings): Record<2 | 3 | 4, number | null> {
  const have = sum(custom.verbs) + custom.wildcards - base.starterVerbs;
  const out = {} as Record<2 | 3 | 4, number | null>;
  for (const n of COUNTS) {
    const s = base.setup[String(n)];
    let h = s.handSize;
    while (h >= MIN_HAND && n * (h - s.meaningsInHand) > have) h--;
    out[n] = h >= MIN_HAND ? h : null;
  }
  return out;
}

export function buildableCompounds(base: DeckData, custom: CustomSettings): DeckCompound[] {
  return base.compounds.filter((c) => (custom.verbs[c.verb] || 0) > 0 && c.particles.every((p) => (custom.particles[p] || 0) > 0));
}

/** Meanings the counts can make, each with its buildable compounds, in deck order. */
export function availableMeanings(base: DeckData, custom: CustomSettings): Map<string, DeckCompound[]> {
  const out = new Map<string, DeckCompound[]>();
  for (const c of buildableCompounds(base, custom)) {
    if (!out.has(c.meaning)) out.set(c.meaning, []);
    out.get(c.meaning)!.push(c);
  }
  return out;
}

interface Sel {
  m: string;
  comps: DeckCompound[];
  verbs: Set<string>;
}

function selected(base: DeckData, custom: CustomSettings): Sel[] {
  const avail = availableMeanings(base, custom);
  return custom.meanings.filter((m) => avail.has(m)).map((m) => ({ m, comps: avail.get(m)!, verbs: new Set(avail.get(m)!.map((c) => c.verb)) }));
}

export interface Generated {
  cards: { id: string; meanings: string[] }[];
  verbClashes: number;
  impossible: boolean;
}

/**
 * Each selected meaning appears in proportion to its buildable compounds (GIVE UP with both answers
 * counts double). No meaning twice on a card; two meanings sharing a verb on one card only when there
 * is no other way, and then counted.
 */
export function generateMeaningCards(base: DeckData, custom: CustomSettings): Generated {
  const sel = selected(base, custom),
    N = custom.meaningCards,
    S = 3 * N;
  if (sel.length < 3 || S < sel.length) return { cards: [], verbClashes: 0, impossible: true };
  const W = sel.reduce((s, x) => s + x.comps.length, 0);
  // Largest-remainder apportionment: at least 1 each, at most N each.
  const t = sel.map((x) => Math.max(1, Math.min(N, Math.floor((S * x.comps.length) / W))));
  let rem = S - t.reduce((a, b) => a + b, 0);
  const order = sel
    .map((x, i) => [(S * x.comps.length) / W - Math.floor((S * x.comps.length) / W), i] as const)
    .sort((a, b) => b[0] - a[0])
    .map((a) => a[1]);
  for (let k = 0; rem > 0 && k < 10 * S; k++) {
    const i = order[k % order.length];
    if (t[i] < N) {
      t[i]++;
      rem--;
    }
  }
  for (let k = 0; rem < 0 && k < 10 * S; k++) {
    const i = order[order.length - 1 - (k % order.length)];
    if (t[i] > 1) {
      t[i]--;
      rem++;
    }
  }
  let best: { cards: number[][]; verbClashes: number } | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = rng((custom.seed || 1) * 1000 + attempt);
    const cards: number[][] = Array.from({ length: N }, () => []);
    let clashes = 0,
      failed = false;
    const tokens: number[] = [];
    sel.forEach((_, i) => {
      for (let k = 0; k < t[i]; k++) tokens.push(i);
    });
    tokens.sort((a, b) => t[b] - t[a] || sel[b].verbs.size - sel[a].verbs.size || r() - 0.5);
    for (const i of tokens) {
      const fits = (strict: boolean) =>
        cards
          .map((_, ci) => ci)
          .filter((ci) => cards[ci].length < 3 && !cards[ci].includes(i) && (!strict || cards[ci].every((j) => ![...sel[j].verbs].some((v) => sel[i].verbs.has(v)))));
      let cand = fits(true);
      if (!cand.length) {
        cand = fits(false);
        if (cand.length) clashes++;
      }
      if (!cand.length) {
        failed = true;
        break;
      }
      const minLen = Math.min(...cand.map((ci) => cards[ci].length));
      cand = cand.filter((ci) => cards[ci].length === minLen);
      cards[cand[Math.floor(r() * cand.length)]].push(i);
    }
    if (failed) continue;
    if (!best || clashes < best.verbClashes) best = { cards, verbClashes: clashes };
    if (clashes === 0) break;
  }
  if (!best) return { cards: [], verbClashes: 0, impossible: true };
  return {
    cards: best.cards.map((c, k) => ({ id: 'x' + String(k + 1).padStart(2, '0'), meanings: c.map((i) => sel[i].m) })),
    verbClashes: best.verbClashes,
    impossible: false,
  };
}

export function validateDeck(base: DeckData, custom: CustomSettings): Validation {
  const errors: Issue[] = [],
    warnings: Issue[] = [];
  const avail = availableMeanings(base, custom),
    sel = selected(base, custom);
  const verbTotal = sum(custom.verbs);
  const partTotal = sum(custom.particles);
  const distinctVerbs = Object.values(custom.verbs).filter((n) => n > 0).length;
  const N = custom.meaningCards;
  const MAX = maxCards(base);
  const dropped = custom.meanings.filter((m) => !avail.has(m));
  if (dropped.length) warnings.push({ code: 'W_UNBUILDABLE', meanings: dropped, text: `${dropped.length} selected meaning(s) can't be made with these counts and will be left out` });
  if (distinctVerbs < base.starterVerbs) errors.push({ code: 'E_FEW_VERBS', text: `Needs at least ${base.starterVerbs} different verbs (the table starts with ${base.starterVerbs})` });
  if (sel.length < 3) errors.push({ code: 'E_FEW_MEANINGS', text: 'Choose at least 3 meanings (each card shows 3)' });
  if (N > MAX) errors.push({ code: 'E_TOO_MANY_CARDS', text: `At most ${MAX} meaning cards` });
  if (sel.length >= 3 && 3 * N < sel.length) errors.push({ code: 'E_FEW_CARDS', text: `${sel.length} meanings need at least ${Math.ceil(sel.length / 3)} meaning cards to appear once each` });
  if (partTotal < base.riverPiles) errors.push({ code: 'E_RIVER', text: `Needs at least ${base.riverPiles} particles to fill the river` });
  if (!errors.length) {
    const g = generateMeaningCards(base, custom);
    if (g.impossible) errors.push({ code: 'E_CARDS', text: "Can't make meaning cards from this selection" });
    else if (g.verbClashes) warnings.push({ code: 'W_VERB_CLASH', text: `${g.verbClashes} card(s) show two meanings with the same verb` });
  }
  // Dead cards: verbs and particles no selected meaning uses.
  const usedV = new Set<string>(),
    usedP = new Set<string>();
  sel.forEach((x) =>
    x.comps.forEach((c) => {
      usedV.add(c.verb);
      c.particles.forEach((p) => usedP.add(p));
    }),
  );
  const deadV = Object.keys(custom.verbs).filter((v) => custom.verbs[v] > 0 && !usedV.has(v));
  const deadP = Object.keys(custom.particles).filter((p) => custom.particles[p] > 0 && !usedP.has(p));
  if (deadV.length) warnings.push({ code: 'W_DEAD_VERBS', items: deadV, text: `No chosen meaning uses ${deadV.join(', ')}: those cards can only be laid alone` });
  if (deadP.length) warnings.push({ code: 'W_DEAD_PARTICLES', items: deadP, text: `No chosen meaning uses ${deadP.join(', ')}: they clog the river` });
  // Particle supply against demand: share of particle slots in the chosen lines vs share of the river.
  if (sel.length && partTotal) {
    const demand: Record<string, number> = {};
    let dTot = 0;
    sel.forEach((x) =>
      x.comps.forEach((c) =>
        c.particles.forEach((p) => {
          demand[p] = (demand[p] || 0) + 1 / x.comps.length;
          dTot += 1 / x.comps.length;
        }),
      ),
    );
    for (const [p, d] of Object.entries(demand)) {
      const ratio = (custom.particles[p] || 0) / partTotal / (d / dTot);
      if (ratio < 0.5)
        warnings.push({ code: 'W_STARVED', items: [p], text: `${p} is in ${Math.round((100 * d) / dTot)}% of the chosen lines but only ${Math.round((100 * (custom.particles[p] || 0)) / partTotal)}% of the river` });
    }
  }
  const players = {} as Record<2 | 3 | 4, PlayerFit>,
    hs = handSizes(base, custom);
  for (const n of COUNTS) {
    const s = base.setup[String(n)],
      have = verbTotal + custom.wildcards - base.starterVerbs;
    const needM = n * s.meaningsInHand + 2; // hands + face-up + at least one left to draw
    const h = hs[n];
    if (h === null) players[n] = { ok: false, reason: `needs ${n * (MIN_HAND - s.meaningsInHand) - have} more verb or wildcard cards` };
    else if (N < needM) players[n] = { ok: false, reason: `needs at least ${needM} meaning cards` };
    else players[n] = { ok: true, handSize: h, ...(h < s.handSize ? { note: `hands of ${h} instead of ${s.handSize}` } : {}) };
  }
  if (!Object.values(players).some((p) => p.ok)) errors.push({ code: 'E_NO_PLAYERS', text: 'Too small to deal for any player count' });
  return { errors, warnings, players };
}

/**
 * A full deck in the deck.json schema, ready for the engine. One verb set for every player count; hand
 * sizes as handSizes(); player counts it can't deal are left out of `setup`. `cards` overrides the
 * generated meaning cards (a saved deck keeps the cards it was saved with).
 */
export function buildDeck(base: DeckData, custom: CustomSettings, cards?: { id: string; meanings: string[] }[], id?: string): DeckData {
  const sel = new Set(selected(base, custom).map((x) => x.m));
  const meaningCards = cards ?? generateMeaningCards(base, custom).cards;
  const hs = handSizes(base, custom),
    v = validateDeck(base, custom),
    setup: DeckData['setup'] = {};
  for (const n of COUNTS) {
    const h = hs[n];
    if (h !== null && v.players[n].ok) setup[String(n)] = { ...base.setup[String(n)], verbs: 'base', handSize: h };
  }
  const verbs = Object.fromEntries(Object.entries(custom.verbs).filter(([, n]) => n > 0));
  return {
    ...base,
    custom: { id, name: custom.name },
    compounds: buildableCompounds(base, custom).filter((c) => sel.has(c.meaning)),
    meaningCards,
    verbs: { base: verbs, pack3to4: {}, baseTotal: sum(verbs), withPackTotal: sum(verbs) } as DeckData['verbs'],
    particles: base.particles.map((p) => ({ ...p, copies: custom.particles[p.word] || 0 })).filter((p) => p.copies > 0),
    wildcards: custom.wildcards,
    setup,
  };
}

/** The bundled deck as editor settings: what "Start from default" offers, for 2 players or 3–4 (the pack added). */
export function defaultCustom(base: DeckData, players: 2 | 3 | 4 = 2): CustomSettings {
  const verbs = { ...base.verbs.base };
  if (players > 2) for (const [v, n] of Object.entries(base.verbs.pack3to4)) verbs[v] = (verbs[v] || 0) + n;
  return {
    name: 'Default',
    verbs,
    particles: Object.fromEntries(base.particles.map((p) => [p.word, p.copies])),
    wildcards: base.wildcards,
    meanings: [...new Set(base.compounds.map((c) => c.meaning))],
    meaningCards: base.meaningCards.length,
    seed: 1,
  };
}

/** The editor's settings part of a stored deck. */
export function settingsOf(d: CustomSettings): CustomSettings {
  return { name: d.name, verbs: d.verbs, particles: d.particles, wildcards: d.wildcards, meanings: d.meanings, meaningCards: d.meaningCards, seed: d.seed };
}

const FORMAT = 'bain-amach-deck';

/** A deck as an export file. */
export function serializeDeck(d: CustomDeck): string {
  return JSON.stringify({ format: FORMAT, v: 1, deck: d }, null, 2);
}

/**
 * An import file read back. Words the word list doesn't have are dropped and named; a deck that is
 * left invalid (or isn't a deck file) is refused with the reason.
 */
export function parseDeck(text: string, base: DeckData): { deck?: CustomDeck; error?: string; dropped: string[] } {
  let raw: { format?: string; deck?: Partial<CustomDeck> };
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'not a deck file', dropped: [] };
  }
  const d = raw?.deck;
  if (raw?.format !== FORMAT || !d || typeof d !== 'object' || typeof d.verbs !== 'object' || typeof d.particles !== 'object' || !Array.isArray(d.meanings))
    return { error: 'not a deck file', dropped: [] };
  const { deck, removed } = migrateDeck(
    {
      id: String(d.id ?? ''),
      name: String(d.name ?? 'Deck').slice(0, 40),
      createdAt: String(d.createdAt ?? new Date().toISOString()),
      updatedAt: String(d.updatedAt ?? new Date().toISOString()),
      baseVersion: String(d.baseVersion ?? ''),
      verbs: counts(d.verbs, MAX_COPIES),
      particles: counts(d.particles, MAX_COPIES),
      wildcards: clamp(Number(d.wildcards) || 0, 0, MAX_WILDCARDS),
      meanings: d.meanings.map(String),
      meaningCards: clamp(Math.round(Number(d.meaningCards) || 0), 0, maxCards(base)),
      seed: Math.round(Number(d.seed) || 1),
      generated: Array.isArray(d.generated) ? d.generated : [],
    },
    base,
  );
  const v = validateDeck(base, deck);
  if (v.errors.length) return { error: v.errors.map((e) => e.text).join('; '), dropped: removed };
  return { deck, dropped: removed };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const counts = (r: unknown, max: number): Record<string, number> =>
  Object.fromEntries(Object.entries((r ?? {}) as Record<string, unknown>).map(([k, n]) => [k, clamp(Math.round(Number(n) || 0), 0, max)]));

/**
 * A stored deck brought up to the current word list: verbs, particles and meanings it no longer has are
 * dropped (and named in `removed`); new meanings stay unselected. The cards are regenerated only when the
 * selection changed, or if they no longer fit it.
 */
export function migrateDeck(d: CustomDeck, base: DeckData): { deck: CustomDeck; removed: string[] } {
  const verbs = new Set(base.compounds.map((c) => c.verb));
  const parts = new Set(base.particles.map((p) => p.word));
  const meanings = new Set(base.compounds.map((c) => c.meaning));
  const removed = [...Object.keys(d.verbs).filter((v) => !verbs.has(v)), ...Object.keys(d.particles).filter((p) => !parts.has(p)), ...d.meanings.filter((m) => !meanings.has(m))];
  const next: CustomDeck = {
    ...d,
    verbs: Object.fromEntries(Object.entries(d.verbs).filter(([v]) => verbs.has(v))),
    particles: Object.fromEntries(Object.entries(d.particles).filter(([p]) => parts.has(p))),
    meanings: d.meanings.filter((m) => meanings.has(m)),
  };
  const sel = new Set(selected(base, next).map((x) => x.m));
  const stale = !next.generated.length || next.generated.some((c) => c.meanings.some((m) => !sel.has(m))) || next.generated.length !== next.meaningCards;
  if (removed.some((m) => meanings.has(m) === false && d.meanings.includes(m)) || stale) {
    const g = generateMeaningCards(base, next);
    if (!g.impossible) next.generated = g.cards;
  }
  if (removed.length) next.baseVersion = base.version;
  return { deck: next, removed };
}

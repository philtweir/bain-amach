// Deck data, loaded at build time. Deck changes are data changes: never hard-code a count here.
import raw from '@deck';
import type { GameState } from './types';

export interface DeckCompound {
  id: string;
  verb: string;
  particles: string[];
  meaning: string;
  check_note?: string;
  /** A sense added for playtesting that Phil hasn't checked yet. */
  draft?: boolean;
}

export interface DeckData {
  version: string;
  compounds: DeckCompound[];
  meaningCards: { id: string; meanings: string[] }[];
  verbs: { base: Record<string, number>; pack3to4: Record<string, number> };
  particles: { word: string; type: 'adverb' | 'preposition'; copies: number }[];
  wildcards: number;
  riverPiles: number;
  starterVerbs: number;
  loneVerbDraw: number;
  setup: Record<string, { verbs: string; handSize: number; meaningsInHand: number }>;
  /** Set on a deck built by the editor: its name, for the setup screen and recap. */
  custom?: { id?: string; name: string };
}

/** The bundled deck: the glossary, the editor and every default game use it. */
export const BASE = raw as unknown as DeckData;

/** A compound in the engine's short form. `g` is the English meaning (gloss). */
export interface Compound {
  id: string;
  v: string;
  ps: string[];
  g: string;
}

const short = (c: DeckCompound): Compound => ({ id: c.id, v: c.verb, ps: c.particles, g: c.meaning });

// Base-wide tables: every compound in the word list, whatever deck a game uses.
export const BASE_COMPOUNDS: Compound[] = BASE.compounds.map(short);
export const BASE_COMPOUND_BY_ID: Record<string, Compound> = Object.fromEntries(BASE_COMPOUNDS.map((c) => [c.id, c]));
export const DRAFT_COMPOUNDS = new Set(BASE.compounds.filter((c) => c.draft).map((c) => c.id));
export const PARTICLE_TYPE: Record<string, 'adverb' | 'preposition'> = Object.fromEntries(BASE.particles.map((p) => [p.word, p.type]));
/** Every verb in the word list, for the glossary grouping. */
export const VERBS: string[] = [...new Set(BASE_COMPOUNDS.map((c) => c.v))];

// The active deck: the one the game being played deals from (a custom deck, or the bundled one). These
// bindings are reassigned by useDeck(), and modules that import them see the current values.
export let DECK: DeckData = BASE;
export let COMPOUNDS: Compound[] = [];
export let COMPOUND_BY_ID: Record<string, Compound> = {};
export let COMPOUNDS_BY_MEANING: Record<string, Compound[]> = {};
export let COMPOUNDS_BY_VERB: Record<string, Compound[]> = {};
export let MEANING_CARD: Record<string, string[]> = {};
let PRINTED: Record<string, Record<string, string>> = {};
let built: DeckData | null = null;

/** Make `d` the active deck (a no-op if it already is). A game's deck is `config.deck ?? BASE`. */
export function useDeck(d: DeckData = BASE) {
  if (d === built) return;
  built = d;
  DECK = d;
  COMPOUNDS = d.compounds.map(short);
  COMPOUND_BY_ID = Object.fromEntries(COMPOUNDS.map((c) => [c.id, c]));
  COMPOUNDS_BY_MEANING = {};
  for (const c of COMPOUNDS) (COMPOUNDS_BY_MEANING[c.g] ??= []).push(c);
  COMPOUNDS_BY_VERB = {};
  for (const c of COMPOUNDS) (COMPOUNDS_BY_VERB[c.v] ??= []).push(c);
  MEANING_CARD = Object.fromEntries(d.meaningCards.map((m) => [m.id, m.meanings]));
  // Each compound is printed on exactly three meaning cards. A meaning with two compounds
  // (GIVE UP) prints the first compound on its first three cards and the second on the next three.
  PRINTED = {};
  const seen: Record<string, number> = {};
  for (const m of d.meaningCards) {
    PRINTED[m.id] = {};
    for (const g of m.meanings) {
      const cs = COMPOUNDS_BY_MEANING[g] ?? [];
      const i = seen[g] ?? 0;
      seen[g] = i + 1;
      const c = cs[Math.min(cs.length - 1, Math.floor(i / 3))];
      if (c) PRINTED[m.id][g] = compoundText(c);
    }
  }
}

/** The deck a game state deals from, made active. */
export function useDeckOf(s: { config: { deck?: DeckData } }) {
  useDeck(s.config.deck ?? BASE);
}

export function compoundText(c: Compound): string {
  return c.v + ' ' + c.ps.join(' ');
}

/** The Irish answers printed for a meaning in the active deck (GIVE UP has two). */
export function answersFor(g: string): string[] {
  return (COMPOUNDS_BY_MEANING[g] ?? []).map(compoundText);
}

export function deckSize(nPlayers: number): number {
  const s = DECK.setup[String(nPlayers)];
  const verbs = Object.values(DECK.verbs.base).reduce((a, b) => a + b, 0) +
    (s.verbs.includes('pack3to4') ? Object.values(DECK.verbs.pack3to4).reduce((a, b) => a + b, 0) : 0);
  const parts = DECK.particles.reduce((a, p) => a + p.copies, 0);
  return verbs + parts + DECK.meaningCards.length + DECK.wildcards;
}

export function packSize(): number {
  return Object.values(DECK.verbs.pack3to4).reduce((a, b) => a + b, 0);
}

useDeck(BASE);

/**
 * Which of its compound's meanings `g` is, in deck order: [1, 2] for cuir ar PUT ON (CLOTHES) when cuir ar also
 * means BOTHER. Null when the compound has only the one meaning.
 */
export function senseOf(text: string, g: string): [number, number] | null {
  const same = COMPOUNDS.filter((c) => compoundText(c) === text);
  const i = same.findIndex((c) => c.g === g);
  return same.length > 1 && i >= 0 ? [i + 1, same.length] : null;
}

/** The Irish answer printed under meaning `g` on meaning card `cardT` (m01…). */
export function printedAnswer(cardT: string, g: string): string {
  return PRINTED[cardT]?.[g] ?? answersFor(g)[0] ?? '';
}

/** Glosses renamed to say which sense they mean (Phil, 2026-10-27): old → new. */
const GLOSS_RENAMED: Record<string, string> = {
  'PUT ON': 'PUT ON (CLOTHES)',
  'TAKE OFF': 'TAKE OFF (CLOTHES)',
  'THROW UP': 'THROW UP (VOMIT)',
  'GET FROM': 'EXTRACT FROM',
  'GET (USE) OUT OF': 'EXTRACT FROM',
  'MAKE (SOMEONE)': 'MAKE (SOMEONE DO)',
  'COME ACROSS': 'COME ACROSS (FIND)',
  'KEEP UP': 'KEEP UP (MAINTAIN)',
  'CONCERN': 'CONCERN (RELATE TO)',
  'STAND BY': 'STAND BY (SUPPORT)',
  'PUT OUT': 'PUT OUT (EJECT)',
  'CALL': 'CALL (NAME)',
  'FALL OUT': 'FALL OUT (QUARREL)',
};

/** A saved game from before a gloss was renamed, with its lines, cards and log in the new wording. */
export function migrateGlosses(s: GameState): GameState {
  const r = (g: string) => GLOSS_RENAMED[g] ?? g;
  return {
    ...s,
    board: s.board.map((c) => (c.used ? { ...c, used: r(c.used) } : c)),
    lines: s.lines.map((l) => ({ ...l, g: r(l.g) })),
    log: s.log.map((e) => (e.e === 'line' ? { ...e, g: r(e.g) } : e)),
    missed: s.missed.map((ms) => ms.map((m) => ({ ...m, g: r(m.g) }))),
  };
}

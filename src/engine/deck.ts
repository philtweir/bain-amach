// Deck data, loaded at build time. Deck changes are data changes: never hard-code a count here.
import raw from '@deck';

export interface DeckCompound {
  id: string;
  verb: string;
  particles: string[];
  meaning: string;
  check_note?: string;
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
}

export const DECK = raw as unknown as DeckData;

/** A compound in the engine's short form. `g` is the English meaning (gloss). */
export interface Compound {
  id: string;
  v: string;
  ps: string[];
  g: string;
}

export const COMPOUNDS: Compound[] = DECK.compounds.map((c) => ({ id: c.id, v: c.verb, ps: c.particles, g: c.meaning }));
export const COMPOUND_BY_ID: Record<string, Compound> = Object.fromEntries(COMPOUNDS.map((c) => [c.id, c]));
export const COMPOUNDS_BY_MEANING: Record<string, Compound[]> = {};
for (const c of COMPOUNDS) (COMPOUNDS_BY_MEANING[c.g] ??= []).push(c);
export const COMPOUNDS_BY_VERB: Record<string, Compound[]> = {};
for (const c of COMPOUNDS) (COMPOUNDS_BY_VERB[c.v] ??= []).push(c);

export const PARTICLE_TYPE: Record<string, 'adverb' | 'preposition'> = Object.fromEntries(
  DECK.particles.map((p) => [p.word, p.type]),
);

export const MEANING_CARD: Record<string, string[]> = Object.fromEntries(DECK.meaningCards.map((m) => [m.id, m.meanings]));

/** Every verb that appears in the deck, for the glossary grouping. */
export const VERBS: string[] = [...new Set(COMPOUNDS.map((c) => c.v))];

export function compoundText(c: Compound): string {
  return c.v + ' ' + c.ps.join(' ');
}

/** The Irish answers printed for a meaning (GIVE UP has two). */
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

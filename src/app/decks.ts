// Custom decks in the app: storage, the built deck a game deals from, files in and out, and bringing
// stored decks up to date when the word list changes.
import { signal } from '@preact/signals';
import { BASE, type DeckData } from '../engine/deck';
import { buildDeck, defaultCustom, generateMeaningCards, migrateDeck, parseDeck, serializeDeck, settingsOf, validateDeck, type CustomDeck, type CustomSettings } from '../engine/deckTools';
import { customDecks } from '../storage';

/** Said once after the word list changed under a saved deck ("2 meanings were removed …"). */
export const deckNotice = signal<number>(0);

// Bring every stored deck up to the current word list, once per app start.
{
  let removed = 0;
  const next = customDecks.value.map((d) => {
    const m = migrateDeck(d, BASE);
    removed += m.removed.length;
    return m.deck;
  });
  if (removed) {
    customDecks.value = next;
    deckNotice.value = removed;
  }
}

export function deckById(id: string | undefined): CustomDeck | undefined {
  return id ? customDecks.value.find((d) => d.id === id) : undefined;
}

const builtCache = new WeakMap<CustomDeck, DeckData>();
/** The deck in deck.json's schema, with the cards it was saved with. */
export function built(d: CustomDeck): DeckData {
  let b = builtCache.get(d);
  if (!b) builtCache.set(d, (b = buildDeck(BASE, d, d.generated, d.id)));
  return b;
}

/** Which player counts a deck (or the default, for undefined) can deal, and its hand sizes. */
export function deckFit(d: CustomDeck | undefined) {
  if (!d) return { 2: BASE.setup['2'].handSize, 3: BASE.setup['3'].handSize, 4: BASE.setup['4'].handSize } as Record<2 | 3 | 4, number | null>;
  const v = validateDeck(BASE, d).players;
  return { 2: v[2].ok ? v[2].handSize : null, 3: v[3].ok ? v[3].handSize : null, 4: v[4].ok ? v[4].handSize : null } as Record<2 | 3 | 4, number | null>;
}

/** Cards in the deck for n players (verbs, particles, wildcards and meaning cards). */
export function cardTotal(d: CustomDeck | undefined, n = 2): number {
  if (!d) {
    const pack = n > 2 ? Object.values(BASE.verbs.pack3to4).reduce((a, b) => a + b, 0) : 0;
    return Object.values(BASE.verbs.base).reduce((a, b) => a + b, 0) + pack + BASE.particles.reduce((a, p) => a + p.copies, 0) + BASE.wildcards + BASE.meaningCards.length;
  }
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  return sum(d.verbs) + sum(d.particles) + d.wildcards + d.meaningCards;
}

const newId = () => 'd' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

/** A new stored deck from editor settings (its cards generated now). */
export function makeDeck(s: CustomSettings, id = newId()): CustomDeck {
  const now = new Date().toISOString();
  return { ...settingsOf(s), id, createdAt: now, updatedAt: now, baseVersion: BASE.version, generated: generateMeaningCards(BASE, s).cards };
}

/** Save (insert or replace), regenerating the cards from the settings. */
export function saveDeck(d: CustomDeck): CustomDeck {
  const next: CustomDeck = { ...d, updatedAt: new Date().toISOString(), baseVersion: BASE.version, generated: generateMeaningCards(BASE, d).cards };
  const i = customDecks.value.findIndex((x) => x.id === d.id);
  customDecks.value = i >= 0 ? customDecks.value.map((x, j) => (j === i ? next : x)) : [...customDecks.value, next];
  return next;
}

export function renameDeck(id: string, name: string) {
  customDecks.value = customDecks.value.map((d) => (d.id === id ? { ...d, name: name.trim() || d.name, updatedAt: new Date().toISOString() } : d));
}

export function deleteDeck(id: string) {
  customDecks.value = customDecks.value.filter((d) => d.id !== id);
}

/** A copy of a deck, or of the default (2-player counts, or 3–4 with the pack added). */
export function duplicateDeck(from: CustomDeck | 2 | 4, name: string): CustomDeck {
  const s = typeof from === 'number' ? defaultCustom(BASE, from) : settingsOf(from);
  const d = makeDeck({ ...s, name });
  customDecks.value = [...customDecks.value, d];
  return d;
}

export function exportDeck(d: CustomDeck): string {
  return serializeDeck(d);
}

/** Read an import file and store the deck. A new id if one with this id is already stored. */
export function importDeck(text: string): { deck?: CustomDeck; error?: string; dropped: string[] } {
  const r = parseDeck(text, BASE);
  if (!r.deck) return r;
  const deck = { ...r.deck, id: r.deck.id && !deckById(r.deck.id) ? r.deck.id : newId() };
  customDecks.value = [...customDecks.value, deck];
  return { ...r, deck };
}

/** The built deck for a setup's choice: undefined for the bundled deck (or a deck since deleted). */
export function deckForSetup(id: string | undefined): DeckData | undefined {
  const d = deckById(id);
  return d ? built(d) : undefined;
}

// Custom decks in the app: storage, the built deck a game deals from, files in and out, and bringing
// stored decks up to date when the word list changes.
import { signal } from '@preact/signals';
import { BASE, type DeckData } from '../engine/deck';
import { buildDeck, defaultCustom, generateMeaningCards, migrateDeck, parseDeck, serializeDeck, settingsOf, validateDeck, type CustomDeck, type CustomSettings } from '../engine/deckTools';
import { customDecks } from '../storage';
import originalRaw from '../../data/decks/original.json';

/** Built-in decks besides Standard: read-only, dealt exactly as shipped, verb pack and all. */
export interface Preset {
  id: string;
  data: DeckData;
}
/** The first deck, from the 25 October handoff (Phil liked it best). */
export const ORIGINAL = originalRaw as unknown as DeckData;
export const PRESETS: Preset[] = [{ id: 'preset:original', data: ORIGINAL }];
export const presetById = (id: string | undefined): Preset | undefined => (id ? PRESETS.find((p) => p.id === id) : undefined);

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

/** Which player counts a deck (Standard, or a built-in's data, for undefined) can deal, and its hand sizes. */
export function deckFit(d: CustomDeck | undefined, data: DeckData = BASE) {
  if (!d) return { 2: data.setup['2'].handSize, 3: data.setup['3'].handSize, 4: data.setup['4'].handSize } as Record<2 | 3 | 4, number | null>;
  const v = validateDeck(BASE, d).players;
  return { 2: v[2].ok ? v[2].handSize : null, 3: v[3].ok ? v[3].handSize : null, 4: v[4].ok ? v[4].handSize : null } as Record<2 | 3 | 4, number | null>;
}

/** Cards in the deck for n players (verbs, particles, wildcards and meaning cards). */
export function cardTotal(d: CustomDeck | undefined, n = 2, data: DeckData = BASE): number {
  if (!d) {
    const pack = n > 2 ? Object.values(data.verbs.pack3to4).reduce((a, b) => a + b, 0) : 0;
    return Object.values(data.verbs.base).reduce((a, b) => a + b, 0) + pack + data.particles.reduce((a, p) => a + p.copies, 0) + data.wildcards + data.meaningCards.length;
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

/** A copy of a deck, of the default (2-player counts, or 3–4 with the pack added), or of a built-in
 *  (3–4 counts, keeping its own meaning cards until the copy is edited). */
export function duplicateDeck(from: CustomDeck | 2 | 4 | Preset, name: string): CustomDeck {
  const preset = typeof from === 'object' && 'data' in from ? from : undefined;
  const s = typeof from === 'number' ? defaultCustom(BASE, from) : preset ? defaultCustom(preset.data, 4) : settingsOf(from as CustomDeck);
  const d = preset ? { ...makeDeck({ ...s, name }), generated: preset.data.meaningCards } : makeDeck({ ...s, name });
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
  const pr = presetById(id);
  if (pr) return pr.data;
  const d = deckById(id);
  return d ? built(d) : undefined;
}

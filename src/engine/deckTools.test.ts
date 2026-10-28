import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE, type DeckData } from './deck';
import { availableMeanings, buildDeck, defaultCustom, generateMeaningCards, handSizes, migrateDeck, parseDeck, serializeDeck, validateDeck, type CustomDeck, type CustomSettings } from './deckTools';
import { newGame } from './game';
import { playDeck, randomValidDecks } from './testDecks';

// The reference tools' outputs on the handoff's original deck (deckTools.reference.json, recorded by
// running handoff/reference/editor/deck-tools.js): the port must give the same cards, validation and hands.
const HANDOFF: DeckData = JSON.parse(readFileSync(new URL('../../handoff/data/deck.json', import.meta.url), 'utf8'));
const REF: Record<string, { settings: CustomSettings; cards: unknown; validation: unknown; hands: unknown }> = JSON.parse(
  readFileSync(new URL('./deckTools.reference.json', import.meta.url), 'utf8'),
);
const plain = (x: unknown) => JSON.parse(JSON.stringify(x));

describe('deck tools match the reference', () => {
  for (const [name, r] of Object.entries(REF))
    it(name, () => {
      expect(plain(generateMeaningCards(HANDOFF, r.settings))).toEqual(r.cards);
      expect(plain(validateDeck(HANDOFF, r.settings))).toEqual(r.validation);
      expect(plain(handSizes(HANDOFF, r.settings))).toEqual(r.hands);
    });
});

describe('deck tools on the app deck', () => {
  const def = defaultCustom(BASE, 2);

  it('the default deck rebuilt through the editor: each meaning on 3 cards (GIVE UP 6), no verb clashes', () => {
    expect(validateDeck(BASE, def).errors).toEqual([]);
    const g = generateMeaningCards(BASE, def);
    expect(g.cards.length).toBe(BASE.meaningCards.length);
    expect(g.verbClashes).toBe(0);
    const count: Record<string, number> = {};
    for (const c of g.cards) {
      expect(new Set(c.meanings).size).toBe(3);
      for (const m of c.meanings) count[m] = (count[m] || 0) + 1;
    }
    expect(count['GIVE UP']).toBe(6);
    expect(Object.entries(count).every(([m, k]) => m === 'GIVE UP' || k === 3)).toBe(true);
  });

  it('same settings and seed give the same cards; a new seed, different ones', () => {
    const g = generateMeaningCards(BASE, def);
    expect(generateMeaningCards(BASE, def).cards).toEqual(g.cards);
    expect(generateMeaningCards(BASE, { ...def, seed: 2 }).cards).not.toEqual(g.cards);
  });

  it('an adverbs-only learner deck deals hands of 11 at 2 players and plays to a finish', () => {
    const small: CustomSettings = {
      name: 'Adverbs only',
      verbs: { cuir: 3, bain: 2, tabhair: 2, lig: 2, éirigh: 2, tar: 1, tit: 1, fág: 1, coinnigh: 1, déan: 1, tóg: 1 },
      particles: { amach: 9, isteach: 4, suas: 6, síos: 3 },
      wildcards: 3,
      meanings: [],
      meaningCards: 18,
      seed: 1,
    };
    small.meanings = [...availableMeanings(BASE, small).keys()];
    const v = validateDeck(BASE, small);
    expect(v.errors).toEqual([]);
    expect(v.players[2]).toMatchObject({ ok: true, handSize: 11 });
    const deck = buildDeck(BASE, small);
    expect(deck.setup['2'].handSize).toBe(11);
    expect(playDeck(deck, 2, 20).unfinished).toBe(0);
  });

  it('catches broken and starved decks', () => {
    const vb = validateDeck(BASE, { ...def, verbs: { cuir: 6, bain: 4 }, meaningCards: 2 });
    expect(vb.errors.map((e) => e.code)).toContain('E_FEW_VERBS');
    expect(validateDeck(BASE, { ...def, particles: { ...def.particles, le: 1 } }).warnings.some((w) => w.code === 'W_STARVED' && w.items?.[0] === 'le')).toBe(true);
  });

  it('a built deck answers only with the compounds it can make (GIVE UP without tabhair: éirigh as only)', () => {
    const noTabhair = { ...def, verbs: { ...def.verbs, tabhair: 0 } };
    const deck = buildDeck(BASE, noTabhair);
    const giveUp = deck.compounds.filter((c) => c.meaning === 'GIVE UP').map((c) => c.verb + ' ' + c.particles.join(' '));
    expect(giveUp).toEqual(['éirigh as']);
  });

  it('the default deck rebuilt through the editor plays to a finish, 2 and 4 players', () => {
    expect(playDeck(buildDeck(BASE, def), 2, 20).unfinished).toBe(0);
    expect(playDeck(buildDeck(BASE, defaultCustom(BASE, 4)), 4, 20).unfinished).toBe(0);
  });

  it('a default game after a custom one deals from the bundled deck again', () => {
    // newGame makes the game's deck active; a later default game makes the bundled one active again.
    const deck = buildDeck(BASE, def);
    newGame({ seed: 1, mode: 'turns', answers: 'shown', hints: 'off', deck, players: [{ name: 'A', kind: 'bot', level: 'hard', color: 0 }, { name: 'B', kind: 'bot', level: 'hard', color: 1 }] });
    const s = newGame({ seed: 1, mode: 'turns', answers: 'shown', hints: 'off', players: [{ name: 'A', kind: 'bot', level: 'hard', color: 0 }, { name: 'B', kind: 'bot', level: 'hard', color: 1 }] });
    expect(s.mpile.concat(s.faceUp ? [s.faceUp] : []).concat(s.hands.flat()).filter((c) => c.k === 'M').every((c) => c.t.startsWith('m'))).toBe(true);
  });
});

describe('every deck the validator accepts plays to a finish (quick fuzz)', () => {
  it('20 random valid decks × 3 games at each dealable player count', () => {
    const decks = randomValidDecks(20);
    expect(decks.length).toBe(20);
    for (const c of decks) {
      const deck = buildDeck(BASE, c);
      for (const n of Object.keys(deck.setup).map(Number)) {
        const r = playDeck(deck, n, 3);
        expect(r.unfinished, `${JSON.stringify(c)} at ${n}p`).toBe(0);
      }
    }
  }, 120000);
});

describe('deck files and word-list changes', () => {
  const stored = (): CustomDeck => {
    const s = { ...defaultCustom(BASE, 2), name: 'Mine', meaningCards: 30 };
    return { ...s, id: 'd1', createdAt: '2026-10-28T00:00:00.000Z', updatedAt: '2026-10-28T00:00:00.000Z', baseVersion: BASE.version, generated: generateMeaningCards(BASE, s).cards };
  };

  it('export then import gives an identical deck', () => {
    const d = stored();
    const r = parseDeck(serializeDeck(d), BASE);
    expect(r.error).toBeUndefined();
    expect(r.dropped).toEqual([]);
    expect(r.deck).toEqual(d);
  });

  it('import refuses what is not a deck, and an invalid deck, with the reason', () => {
    expect(parseDeck('hello', BASE).error).toBe('not a deck file');
    expect(parseDeck(JSON.stringify({ format: 'something-else' }), BASE).error).toBe('not a deck file');
    const bad = { ...stored(), verbs: { cuir: 3 } };
    expect(parseDeck(serializeDeck(bad), BASE).error).toMatch(/different verbs/);
  });

  it('import drops words the word list does not have, and names them', () => {
    const d = { ...stored(), verbs: { ...stored().verbs, snámh: 2 }, meanings: [...stored().meanings, 'SWIM AWAY'] };
    const r = parseDeck(serializeDeck(d), BASE);
    expect(r.deck).toBeDefined();
    expect(r.dropped).toEqual(['snámh', 'SWIM AWAY']);
    expect(r.deck!.verbs.snámh).toBeUndefined();
  });

  it('a word-list change drops gone meanings, keeps new ones unselected, and regenerates cards only then', () => {
    const d = stored();
    // Nothing changed: same deck, same cards.
    expect(migrateDeck(d, BASE)).toEqual({ deck: d, removed: [] });
    // A meaning the deck had is no longer in the word list.
    const gone = d.meanings[0];
    const smaller: DeckData = { ...BASE, compounds: BASE.compounds.filter((c) => c.meaning !== gone) };
    const m = migrateDeck(d, smaller);
    expect(m.removed).toEqual([gone]);
    expect(m.deck.meanings).not.toContain(gone);
    expect(m.deck.generated.flatMap((c) => c.meanings)).not.toContain(gone);
  });
});

// Test helpers for custom decks: bot games on any deck, and random settings the validator accepts.
import { botTurn } from './bot';
import { BASE, type DeckData } from './deck';
import { availableMeanings, validateDeck, type CustomSettings } from './deckTools';
import { newGame } from './game';
import { APP_RULES } from './types';

export function playDeck(deck: DeckData, n: number, games: number, rules = APP_RULES) {
  let lines = 0,
    out = 0,
    unfinished = 0;
  for (let seed = 1; seed <= games; seed++) {
    let s = newGame({ seed, mode: 'turns', answers: 'shown', hints: 'off', rules, deck, players: Array.from({ length: n }, (_, i) => ({ name: 'B' + i, kind: 'bot' as const, level: 'hard' as const, color: i })) });
    let t = 0;
    while (!s.over && t < 6000) {
      s = botTurn(s, s.turn);
      t++;
    }
    if (!s.over) unfinished++;
    else {
      lines += s.lines.length;
      if (s.over.how === 'out') out++;
    }
  }
  return { lines: lines / games, out: out / games, unfinished };
}

/** Random settings the validator accepts, from a seeded generator. */
export function randomValidDecks(count: number, seed = 7): CustomSettings[] {
  let a = seed;
  const r = () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296);
  const verbs = Object.keys({ ...BASE.verbs.base, ...BASE.verbs.pack3to4 });
  const parts = BASE.particles.map((p) => p.word);
  const out: CustomSettings[] = [];
  for (let tries = 0; out.length < count && tries < count * 200; tries++) {
    const c: CustomSettings = {
      name: 'fuzz',
      verbs: Object.fromEntries(verbs.map((v) => [v, r() < 0.7 ? Math.floor(r() * 5) : 0])),
      particles: Object.fromEntries(parts.map((p) => [p, r() < 0.8 ? Math.floor(r() * 8) : 0])),
      wildcards: Math.floor(r() * 6),
      meanings: [],
      meaningCards: 0,
      seed: Math.floor(r() * 1000) + 1,
    };
    const avail = [...availableMeanings(BASE, c).keys()];
    c.meanings = avail.filter(() => r() < 0.75);
    c.meaningCards = Math.ceil(c.meanings.length / 3) + Math.floor(r() * (c.meanings.length + 8));
    if (!validateDeck(BASE, c).errors.length) out.push(c);
  }
  return out;
}

// Stórfhocail (spec/storfhocal.md): collectable phrase tiles. The catalogue, which phrases a deck can
// make, the bots' carry roll at the deal, and settling up at the end. Every tuning number lives in
// data/storfhocail.json → settings.
import raw from '../../data/storfhocail.json';
import { BASE, BASE_COMPOUND_BY_ID, DECK, compoundText, type DeckData } from './deck';
import { rng } from './rng';
import type { GameConfig, GameState } from './types';

export interface SfPhrase {
  id: string;
  verb: string;
  /** Tokens after the verb in reading order: '~' is the tile's cell, every other token a particle. */
  pattern: string[];
  meaning: string;
  check_note?: string;
}

export interface SfWord {
  id: string;
  word: string;
  kind: string;
  phrases: SfPhrase[];
}

export interface SfSettings {
  unlockAfterGames: number;
  botCarryChance: number;
  botCarryChanceUntilFirstSeen: number;
  botPlayWindow: [number, number];
  botCarryWeights: { lostByPlayer: number; unownedByPlayer: number; any: number };
  playerMaxPerGame: number;
  lossOnQuit: boolean;
}

export const SF = raw as unknown as { version: string; settings: SfSettings; words: SfWord[] };
export const SF_SETTINGS = SF.settings;
export const SF_WORD: Record<string, SfWord> = Object.fromEntries(SF.words.map((w) => [w.id, w]));
/** Each phrase, with the id of the word it belongs to. */
export const SF_PHRASE: Record<string, SfPhrase & { word: string }> = Object.fromEntries(SF.words.flatMap((w) => w.phrases.map((p) => [p.id, { ...p, word: w.id }])));
/** Card ids for tiles laid on the table: above any dealt card. */
export const SF_CARD_ID = 100000;

export const phraseParticles = (ph: SfPhrase) => ph.pattern.filter((t) => t !== '~');

/** "tabhair aire do": the phrase with the tile's word in its place. */
export function phraseText(ph: SfPhrase, word = SF_WORD[SF_PHRASE[ph.id]?.word]?.word ?? '~'): string {
  return [ph.verb, ...ph.pattern.map((t) => (t === '~' ? word : t))].join(' ');
}

const deckVerbs = (d: DeckData) => {
  const n: Record<string, number> = { ...d.verbs.base };
  for (const [v, c] of Object.entries(d.verbs.pack3to4 ?? {})) n[v] = (n[v] || 0) + c;
  return n;
};

/** Whether a deck has the verb and every particle a phrase needs (a wildcard can't make up for a missing one). */
export function phraseInDeck(ph: SfPhrase, d: DeckData = DECK): boolean {
  const verbs = deckVerbs(d);
  const parts = new Set(d.particles.filter((p) => p.copies > 0).map((p) => p.word));
  return (verbs[ph.verb] ?? 0) > 0 && phraseParticles(ph).every((p) => parts.has(p));
}

export function wordInDeck(w: SfWord, d: DeckData = DECK): boolean {
  return w.phrases.some((ph) => phraseInDeck(ph, d));
}

/** What the player's bag looks like at the deal: it steers which word a bot carries. */
export interface SfDeal {
  on: true;
  /** Words the player lost to bots and hasn't won back. */
  lost: string[];
  /** Words the player owns now (count > 0). */
  owned: string[];
  /** The player has seen a stórfhocal laid before (else the carry chance is the first-game one). */
  seenAny: boolean;
  /** Tests: force the carry chance. */
  carryChance?: number;
}

export interface SfState {
  /** Tiles each player has brought in and not yet laid. */
  pouch: Record<number, string[]>;
  /** Each Hard bot's carried word, the own turn from which it lays it, and whether it has. */
  carry: Record<number, { word: string; target: number; laid: boolean }>;
  /** Tiles on the table, in the order laid. */
  laid: { word: string; phrase: string; p: number }[];
}

/**
 * At the deal: each Hard bot carries one word with the carry chance, chosen by weight from words the
 * deck can make (one the player lost to a bot, one they don't own, any), with a target own-turn from
 * the play window. Uses its own random stream, so turning stórfhocail on never changes the deal.
 */
export function rollCarries(config: GameConfig, sf: SfDeal, deck: DeckData = config.deck ?? BASE): SfState['carry'] {
  const st = SF_SETTINGS;
  const r = rng((config.seed ^ 0x5f0f0c41) >>> 0);
  const playable = SF.words.filter((w) => wordInDeck(w, deck)).map((w) => w.id);
  const owned = new Set(sf.owned);
  const pools = {
    lostByPlayer: playable.filter((w) => sf.lost.includes(w) && !owned.has(w)),
    unownedByPlayer: playable.filter((w) => !owned.has(w)),
    any: playable,
  };
  const chance = sf.carryChance ?? (sf.seenAny ? st.botCarryChance : st.botCarryChanceUntilFirstSeen);
  const out: SfState['carry'] = {};
  config.players.forEach((p, i) => {
    if (p.kind !== 'bot' || p.level !== 'hard' || !playable.length) return;
    if (r() >= chance) return;
    // An empty category passes its weight on to the others.
    const cats = (Object.keys(pools) as (keyof typeof pools)[]).filter((k) => pools[k].length);
    const total = cats.reduce((a, k) => a + st.botCarryWeights[k], 0);
    let x = r() * total;
    let cat = cats[cats.length - 1];
    for (const k of cats) {
      if (x < st.botCarryWeights[k]) {
        cat = k;
        break;
      }
      x -= st.botCarryWeights[k];
    }
    const pool = pools[cat];
    const word = pool[Math.floor(r() * pool.length)];
    const [lo, hi] = st.botPlayWindow;
    out[i] = { word, target: lo + Math.floor(r() * (hi - lo + 1)), laid: false };
  });
  return out;
}

/** The player's turns so far, counting this one (race mode: their plays). A bot's target is one of these. */
export function ownTurn(s: GameState, p: number): number {
  const kinds = s.config.mode === 'race' ? ['line', 'lone'] : ['line', 'lone', 'swap', 'pass', 'wrong'];
  return s.log.filter((e) => 'p' in e && e.p === p && kinds.includes(e.e)).length + 1;
}

export interface Settlement {
  /** Words into the player's bag (+1 each). */
  gained: string[];
  /** Words out of the player's bag (−1 each), to the winner. */
  lost: string[];
  /** Bot-laid words nobody keeps. */
  vanished: string[];
}

/**
 * Settling up (spec §6). The player wins: bots' tiles on the table come to them, theirs go back. A bot
 * wins: the player's laid tiles are lost, bots' vanish. A tie: the player keeps theirs, bots' vanish.
 * Quitting (or restarting) after laying one counts as losing it. Tiles never laid are never at risk.
 */
export function settleStorfhocail(s: GameState, quit = false): Settlement {
  const none: Settlement = { gained: [], lost: [], vanished: [] };
  if (!s.sf) return none;
  const human = s.config.players.findIndex((p) => p.kind === 'human');
  const mine = s.sf.laid.filter((l) => l.p === human).map((l) => l.word);
  const bots = s.sf.laid.filter((l) => l.p !== human).map((l) => l.word);
  if (quit) return { gained: [], lost: SF_SETTINGS.lossOnQuit ? mine : [], vanished: bots };
  if (!s.over) return none;
  if (s.over.tie) return { gained: [], lost: [], vanished: bots };
  if (s.over.winners[0] === human) return { gained: bots, lost: [], vanished: [] };
  return { gained: [], lost: mine, vanished: bots };
}

// ---------- the player's progress (stored on the device) ----------

export interface SfProgress {
  finishedSoloGames: number;
  /** Unlocked early (the secret), whatever the count. */
  unlocked: boolean;
  /** The bag shows on Home from the first tile owned, and stays. */
  bagRevealed: boolean;
  /** Word id → count owned. */
  owned: Record<string, number>;
  /** Phrase id → seen laid on the table (by anyone). */
  seen: Record<string, { times: number; last: string }>;
  /** Word ids lost to bots and not won back since. */
  lostByPlayer: string[];
  /** Word id → times the player laid it. */
  laid: Record<string, number>;
  /** The last 50 games with a transfer. */
  history: { date: string; gained: string[]; lost: string[] }[];
}

export const emptySfProgress = (): SfProgress => ({ finishedSoloGames: 0, unlocked: false, bagRevealed: false, owned: {}, seen: {}, lostByPlayer: [], laid: {}, history: [] });

export function sfUnlocked(pr: SfProgress): boolean {
  return pr.unlocked || pr.finishedSoloGames >= SF_SETTINGS.unlockAfterGames;
}

/** The player has seen this word: they own it, or have seen one of its phrases laid. Owning a tile
 *  counts as seeing its phrases, as they're printed on it. */
export function wordSeen(pr: SfProgress, word: string): boolean {
  return (pr.owned[word] ?? 0) > 0 || (SF_WORD[word]?.phrases ?? []).some((ph) => pr.seen[ph.id]);
}

export function phraseSeen(pr: SfProgress, phrase: string): boolean {
  return !!pr.seen[phrase] || (pr.owned[SF_PHRASE[phrase]?.word] ?? 0) > 0;
}

/** The bag at the deal, for the bots' carry roll. */
export function dealFor(pr: SfProgress): SfDeal {
  return { on: true, lost: pr.lostByPlayer, owned: Object.keys(pr.owned).filter((w) => pr.owned[w] > 0), seenAny: Object.keys(pr.seen).length > 0 };
}

/** A phrase seen laid. */
export function recordSeen(pr: SfProgress, phrase: string, date: string): SfProgress {
  const cur = pr.seen[phrase];
  return { ...pr, seen: { ...pr.seen, [phrase]: { times: (cur?.times ?? 0) + 1, last: date } } };
}

/** Apply a settlement: +1 for each tile won, −1 for each lost (lost ones remembered until won back). */
export function applySettlement(pr: SfProgress, st: Settlement, laidByPlayer: string[], date: string): SfProgress {
  const owned = { ...pr.owned };
  for (const w of st.gained) owned[w] = (owned[w] ?? 0) + 1;
  for (const w of st.lost) owned[w] = Math.max(0, (owned[w] ?? 0) - 1);
  for (const w of Object.keys(owned)) if (!owned[w]) delete owned[w];
  const lostByPlayer = [...new Set([...pr.lostByPlayer.filter((w) => !st.gained.includes(w)), ...st.lost])];
  const laid = { ...pr.laid };
  for (const w of laidByPlayer) laid[w] = (laid[w] ?? 0) + 1;
  const history = st.gained.length || st.lost.length ? [...pr.history, { date, gained: st.gained, lost: st.lost }].slice(-50) : pr.history;
  return { ...pr, owned, lostByPlayer, laid, history, bagRevealed: pr.bagRevealed || Object.keys(owned).length > 0 };
}

// ---------- line ids: a compound, or a stórfhocal phrase ----------

/** The Irish of a line: "cuir suas le", or a phrase with its tile's word ("tabhair aire do"). */
export function lineText(id: string): string {
  const ph = SF_PHRASE[id];
  return ph ? phraseText(ph) : compoundText(BASE_COMPOUND_BY_ID[id]);
}

export function lineGloss(id: string): string {
  return SF_PHRASE[id]?.meaning ?? BASE_COMPOUND_BY_ID[id]?.g ?? '';
}

/** The particles of a line, in order. */
export function lineParticles(id: string): string[] {
  const ph = SF_PHRASE[id];
  return ph ? phraseParticles(ph) : (BASE_COMPOUND_BY_ID[id]?.ps ?? []);
}

/** The words of a line after its verb, in order (the tile's word in its place). */
export function lineWords(id: string): string[] {
  const ph = SF_PHRASE[id];
  if (ph) return ph.pattern.map((t) => (t === '~' ? SF_WORD[SF_PHRASE[id].word].word : t));
  return BASE_COMPOUND_BY_ID[id]?.ps ?? [];
}

export function lineVerb(id: string): string {
  return SF_PHRASE[id]?.verb ?? BASE_COMPOUND_BY_ID[id]?.v ?? '';
}

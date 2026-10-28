// Stórfhocail (spec/storfhocal.md): collectable phrase tiles. The catalogue, which phrases a deck can
// make, the bots' carry roll at the deal, and settling up at the end. Every tuning number lives in
// data/storfhocail.json → settings.
import raw from '../../data/storfhocail.json';
import { BASE_COMPOUND_BY_ID, DECK, compoundText, type DeckData } from './deck';
import type { GameState } from './types';

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
  botLayChance: number;
  firstTileMultiplier: number;
  noStakeDivisor: number;
  botWeights: { unowned: number; owned: number };
  botLeadCap: number;
  restoreEvery: number;
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

/** What the player's bag looks like at the deal: it sets the bots' odds and which words they lean to. */
export interface SfDeal {
  on: true;
  /** Words the player owns now. */
  owned: string[];
  /** The player has seen a stórfhocal laid before (else the raised first-tile odds). */
  seenAny: boolean;
  /** Mixed into the bots' random stream, fresh for every game, so a replay repeats only the deal. */
  roll?: number;
  /** Tests: force p. */
  layChance?: number;
}

export interface SfState {
  /** The tile each player has taken from the bag and not yet laid: one at a time. */
  pouch: Record<number, string[]>;
  /** Tiles on the table, in the order laid. */
  laid: { word: string; phrase: string; p: number }[];
  /** A tile the player laid is waiting for a bot to lay one back. */
  stake: boolean;
}

/** Words the deck can complete. */
export const playableWords = (deck: DeckData = DECK) => SF.words.filter((w) => wordInDeck(w, deck)).map((w) => w.id);

const humanOf = (s: GameState) => s.config.players.findIndex((p) => p.kind === 'human');

/**
 * A Hard bot's chance this turn of laying a stórfhocal, when it has a legal one (spec: stakes set the
 * odds). p, ×3 until the player has seen one; ÷6 while the player has a usable tile in their bag and
 * none of theirs waits for an answer. Never more than one bot tile beyond the player's count.
 */
export function botSfChance(s: GameState): number {
  const sf = s.sf;
  const deal = s.config.sf;
  if (!sf || !deal) return 0;
  const st = SF_SETTINGS;
  const human = humanOf(s);
  const mine = sf.laid.filter((l) => l.p === human).length;
  const theirs = sf.laid.length - mine;
  if (theirs >= mine + st.botLeadCap) return 0;
  let p = deal.layChance ?? st.botLayChance;
  if (!deal.seenAny && !sf.laid.length) p *= st.firstTileMultiplier;
  const onTable = new Set(sf.laid.filter((l) => l.p === human).map((l) => l.word));
  const usable = new Set(playableWords());
  const inBag = deal.owned.some((w) => usable.has(w) && !onTable.has(w));
  if (inBag && !sf.stake) p /= st.noStakeDivisor;
  return Math.min(1, p);
}

/** Which word a bot lays, from those it has a legal line for: weighted towards words the player doesn't own. */
export function pickBotWord(words: string[], deal: SfDeal, r: number): string {
  const owned = new Set(deal.owned);
  const w = (x: string) => (owned.has(x) ? SF_SETTINGS.botWeights.owned : SF_SETTINGS.botWeights.unowned);
  const total = words.reduce((a, x) => a + w(x), 0);
  let x = r * total;
  for (const word of words) {
    if (x < w(word)) return word;
    x -= w(word);
  }
  return words[words.length - 1];
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
  /** Games finished on this device, any mode (not the tutorial; abandoned games don't count). */
  finishedGames: number;
  /** The recap has announced stórfhocal games (once, on the game that unlocked them). */
  announced: boolean;
  /** Unlocked early (the secret), whatever the count. */
  unlocked: boolean;
  /** The bag shows on Home from the first tile owned, and stays. */
  bagRevealed: boolean;
  /** Word id → 1 when owned: each word fills one slot, so a second copy adds nothing. */
  owned: Record<string, number>;
  /** Phrase id → seen laid on the table (by anyone). */
  seen: Record<string, { times: number; last: string }>;
  /** Word ids lost to bots and not won back since. */
  lostByPlayer: string[];
  /** Word id → times the player laid it. */
  laid: Record<string, number>;
  /** The last 50 games with a transfer. */
  history: { date: string; gained: string[]; lost: string[] }[];
  /** Word id → who the player won it from, and when. */
  wonFrom: Record<string, { name: string; date: string }>;
  /** The highest restore point the bag has offered and the player has dealt with (saved or "Not now"). */
  restoreSeen: number;
  /** "Don't warn me again" on the bag sheet's stakes warning. */
  noWarn: boolean;
}

export const emptySfProgress = (): SfProgress => ({ finishedGames: 0, announced: false, unlocked: false, bagRevealed: false, owned: {}, seen: {}, lostByPlayer: [], laid: {}, history: [], wonFrom: {}, restoreSeen: 0, noWarn: false });

/** Stored progress from any earlier version: v1.1's first build counted solo games only. */
export function migrateSfProgress(x: Partial<SfProgress> & { finishedSoloGames?: number }): SfProgress {
  const { finishedSoloGames, ...rest } = x;
  const pr = { ...emptySfProgress(), ...rest };
  if (x.finishedGames === undefined && finishedSoloGames !== undefined) pr.finishedGames = finishedSoloGames;
  for (const w of Object.keys(pr.owned)) if (pr.owned[w] > 0) pr.owned[w] = 1;
  return pr;
}

export const ownedCount = (pr: SfProgress) => Object.values(pr.owned).filter((n) => n > 0).length;

export function sfUnlocked(pr: SfProgress): boolean {
  return pr.unlocked || pr.finishedGames >= SF_SETTINGS.unlockAfterGames;
}

/** The player has seen this word: they own it, or have seen one of its phrases laid. Owning a tile
 *  counts as seeing its phrases, as they're printed on it. */
export function wordSeen(pr: SfProgress, word: string): boolean {
  return (pr.owned[word] ?? 0) > 0 || (SF_WORD[word]?.phrases ?? []).some((ph) => pr.seen[ph.id]);
}

export function phraseSeen(pr: SfProgress, phrase: string): boolean {
  return !!pr.seen[phrase] || (pr.owned[SF_PHRASE[phrase]?.word] ?? 0) > 0;
}

/** The bag at the deal, for the bots' odds. roll seeds their stórfhocal rolls: fresh each game. */
export function dealFor(pr: SfProgress, roll?: number): SfDeal {
  return { on: true, owned: Object.keys(pr.owned).filter((w) => pr.owned[w] > 0), seenAny: Object.keys(pr.seen).length > 0, ...(roll !== undefined ? { roll } : {}) };
}

/** A phrase seen laid. */
export function recordSeen(pr: SfProgress, phrase: string, date: string): SfProgress {
  const cur = pr.seen[phrase];
  return { ...pr, seen: { ...pr.seen, [phrase]: { times: (cur?.times ?? 0) + 1, last: date } } };
}

/** Apply a settlement: each tile won fills its slot (a second copy adds nothing), each lost empties it
 *  (remembered until won back). from: who laid each tile won, for the bag's detail. */
export function applySettlement(pr: SfProgress, st: Settlement, laidByPlayer: string[], date: string, from: Record<string, string> = {}): SfProgress {
  const owned = { ...pr.owned };
  const wonFrom = { ...pr.wonFrom };
  for (const w of st.gained) {
    if (!owned[w] && from[w]) wonFrom[w] = { name: from[w], date };
    owned[w] = 1;
  }
  for (const w of st.lost) owned[w] = 0;
  for (const w of Object.keys(owned)) if (!owned[w]) delete owned[w];
  const lostByPlayer = [...new Set([...pr.lostByPlayer.filter((w) => !st.gained.includes(w)), ...st.lost])];
  const laid = { ...pr.laid };
  for (const w of laidByPlayer) laid[w] = (laid[w] ?? 0) + 1;
  const history = st.gained.length || st.lost.length ? [...pr.history, { date, gained: st.gained, lost: st.lost }].slice(-50) : pr.history;
  return { ...pr, owned, lostByPlayer, laid, history, wonFrom, bagRevealed: pr.bagRevealed || Object.keys(owned).length > 0 };
}

// ---------- restore points ----------

const RESTORE_PREFIX = 'BA1-';

function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36).slice(-4).padStart(4, '0');
}

const toB64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

/** The restore point due now, if any: the bag has reached a multiple of restoreEvery not yet dealt with. */
export function restoreDue(pr: SfProgress): number {
  const step = SF_SETTINGS.restoreEvery;
  const at = Math.floor(ownedCount(pr) / step) * step;
  return at >= step && at > pr.restoreSeen ? at : 0;
}

/** A restore point: a short text code holding the bag and the phrases seen. */
export function restoreCode(pr: SfProgress): string {
  const body = toB64(JSON.stringify({ o: Object.keys(pr.owned).filter((w) => pr.owned[w] > 0).sort(), s: Object.fromEntries(Object.entries(pr.seen).map(([k, v]) => [k, v.times])) }));
  return RESTORE_PREFIX + body + '-' + checksum(body);
}

/** Restore a bag from its code. Only into an empty bag: it recovers a lost bag but can't undo a lost game. */
export function applyRestore(pr: SfProgress, code: string, date: string): { progress?: SfProgress; error?: 'notEmpty' | 'badCode' } {
  if (ownedCount(pr) > 0) return { error: 'notEmpty' };
  const m = code.trim().replace(/\s+/g, '').match(/^BA1-([A-Za-z0-9_-]+)-([0-9a-z]{4})$/);
  if (!m || checksum(m[1]) !== m[2]) return { error: 'badCode' };
  let data: { o: string[]; s: Record<string, number> };
  try {
    data = JSON.parse(fromB64(m[1]));
  } catch {
    return { error: 'badCode' };
  }
  if (!Array.isArray(data.o) || typeof data.s !== 'object') return { error: 'badCode' };
  const owned = Object.fromEntries(data.o.filter((w) => SF_WORD[w]).map((w) => [w, 1]));
  const seen = { ...pr.seen };
  for (const [k, n] of Object.entries(data.s)) if (SF_PHRASE[k] && typeof n === 'number') seen[k] = { times: Math.max(n, seen[k]?.times ?? 0), last: seen[k]?.last ?? date };
  const next = { ...pr, owned, seen, bagRevealed: true, lostByPlayer: pr.lostByPlayer.filter((w) => !owned[w]) };
  return { progress: { ...next, restoreSeen: Math.max(pr.restoreSeen, Math.floor(ownedCount(next) / SF_SETTINGS.restoreEvery) * SF_SETTINGS.restoreEvery) } };
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

// Stórfhocail in the app: the bag and progress on the device, settled at the end of each game.
import type { GameState } from '../engine/types';
import { applySettlement, dealFor, recordSeen, settleStorfhocail, SF_SETTINGS, type SfDeal, type Settlement } from '../engine/storfhocail';
import { sfProgress } from '../storage';
import { botName } from '../game/critters';

const today = () => new Date().toISOString().slice(0, 10);

/** A solo game: one human against bots. Only these count towards the unlock and use the bag. */
export function isSolo(s: GameState): boolean {
  const ps = s.config.players;
  return ps.filter((p) => p.kind === 'human').length === 1 && ps.some((p) => p.kind === 'bot');
}

/** A phrase was laid on the table: it is seen (glossary, bag), by whoever laid it. */
export function noteSeen(phrase: string) {
  sfProgress.value = recordSeen(sfProgress.value, phrase, today());
}

function settle(s: GameState, quit: boolean): Settlement | null {
  if (!s.sf) return null;
  const st = settleStorfhocail(s, quit);
  const human = s.config.players.findIndex((p) => p.kind === 'human');
  const mine = s.sf.laid.filter((l) => l.p === human).map((l) => l.word);
  const hadTile = Object.values(sfProgress.value.owned).some((n) => n > 0);
  const from = Object.fromEntries(s.sf.laid.filter((l) => l.p !== human).map((l) => [l.word, botName(s.config.players, l.p)]));
  sfProgress.value = applySettlement(sfProgress.value, st, mine, today(), from);
  // The one thing players can lose: ask the browser to keep it once there is something to keep.
  if (!hadTile && Object.values(sfProgress.value.owned).some((n) => n > 0)) requestPersist();
  return st;
}

export interface Finished {
  settlement: Settlement | null;
  /** This game unlocked stórfhocal games: the recap says so, once. */
  unlocked: boolean;
  /** The bag before this game settled. */
  ownedBefore: string[];
}

/** The game reached its recap. Counts towards the unlock (any mode, not the tutorial) and settles up. */
export function gameFinished(s: GameState): Finished {
  const ownedBefore = Object.keys(sfProgress.value.owned).filter((w) => sfProgress.value.owned[w] > 0);
  if (!s.over) return { settlement: null, unlocked: false, ownedBefore };
  let unlocked = false;
  if (!s.config.tutorial) {
    const pr = { ...sfProgress.value, finishedGames: sfProgress.value.finishedGames + 1 };
    unlocked = !pr.announced && !pr.unlocked && pr.finishedGames >= SF_SETTINGS.unlockAfterGames;
    if (unlocked) pr.announced = true;
    sfProgress.value = pr;
  }
  return { settlement: settle(s, false), unlocked, ownedBefore };
}

/** The game was given up (discarded or restarted). Laying one of your own and quitting loses it. */
export function gameAbandoned(s: GameState) {
  if (!s.over && SF_SETTINGS.lossOnQuit) settle(s, true);
}

/** The bag at the deal, with a fresh roll for the bots: a replay repeats only the deal. */
export function freshDeal(): SfDeal {
  return dealFor(sfProgress.value, (Math.random() * 2 ** 31) >>> 0);
}

/** Your own tiles on the table in a game: at stake, lost if you quit. */
export function tilesAtStake(s: GameState): string[] {
  const human = s.config.players.findIndex((p) => p.kind === 'human');
  return s.over || !s.sf ? [] : s.sf.laid.filter((l) => l.p === human).map((l) => l.word);
}

/** The secret: unlock the toggle now, whatever the count. */
export function unlockNow() {
  sfProgress.value = { ...sfProgress.value, unlocked: true, announced: true };
}

export function requestPersist() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    // Not supported: the backup file is the answer there.
  }
}

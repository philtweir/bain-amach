// Stórfhocail in the app: the bag and progress on the device, settled at the end of each game.
import type { GameState } from '../engine/types';
import { applySettlement, recordSeen, settleStorfhocail, SF_SETTINGS, type Settlement } from '../engine/storfhocail';
import { sfProgress } from '../storage';

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
  sfProgress.value = applySettlement(sfProgress.value, st, mine, today());
  // The one thing players can lose: ask the browser to keep it once there is something to keep.
  if (!hadTile && Object.values(sfProgress.value.owned).some((n) => n > 0)) requestPersist();
  return st;
}

/** The game reached its recap. Counts towards the unlock (solo games, not the tutorial) and settles up. */
export function gameFinished(s: GameState): Settlement | null {
  if (!s.over) return null;
  if (isSolo(s) && !s.config.tutorial) sfProgress.value = { ...sfProgress.value, finishedSoloGames: sfProgress.value.finishedSoloGames + 1 };
  return settle(s, false);
}

/** The game was given up (discarded or restarted). Laying one of your own and quitting loses it. */
export function gameAbandoned(s: GameState) {
  if (!s.over && SF_SETTINGS.lossOnQuit) settle(s, true);
}

/** The secret: unlock the toggle now, whatever the count. */
export function unlockNow() {
  sfProgress.value = { ...sfProgress.value, unlocked: true };
}

export function requestPersist() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    // Not supported: the backup file is the answer there.
  }
}

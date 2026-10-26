// Bot characters: one species per difficulty, so picking a difficulty picks the face.
// Names and moods are derived from the game state, never stored, so saved games from before
// the characters existed show them too.
import type { GameState, Level, PlayerConfig } from '../engine/types';

export type Species = 'broc' | 'corr' | 'giorria';
export type Mood = 'neutral' | 'thinking' | 'pleased' | 'stuck' | 'beaten';
/** A bot's face and mood, or null/undefined for a human. */
export type CritterFace = { species: Species; mood?: Mood } | null | undefined;

export const SPECIES: Record<Level, Species> = { easy: 'broc', normal: 'corr', hard: 'giorria' };
const NAME: Record<Species, string> = { broc: 'Broc', corr: 'Corr', giorria: 'Giorria' };
/** Two bots of one difficulty share the species; the second and third get óg / mór. */
const EPITHET = ['', ' Óg', ' Mór'];

export const speciesOf = (level: Level | undefined): Species => SPECIES[level ?? 'normal'];

/** The bot's display name, e.g. Broc, or Broc Óg for the second easy bot. */
export function botName(players: PlayerConfig[], i: number): string {
  const sp = speciesOf(players[i].level);
  const nth = players.slice(0, i).filter((p) => p.kind === 'bot' && speciesOf(p.level) === sp).length;
  return NAME[sp] + (EPITHET[nth] ?? ` ${nth + 1}`);
}

/**
 * What a bot's face shows now. In order: game over (pleased if it won, else beaten); its turn or
 * mid-play (thinking); it passed or tapped Stuck since the latest play and the river hasn't turned
 * (stuck); the latest play was its line (pleased); otherwise neutral.
 */
export function moodOf(s: GameState, i: number, playing: number | null): Mood {
  if (s.over) return s.over.winners.includes(i) ? 'pleased' : 'beaten';
  if (playing === i || (s.config.mode === 'turns' && playing === null && s.turn === i)) return 'thinking';
  let k = s.log.length - 1;
  while (k >= 0 && !['line', 'lone', 'swap', 'stall'].includes(s.log[k].e)) k--;
  if (stuckSince(s, i, k)) return 'stuck';
  const e = s.log[k];
  return e && e.e === 'line' && e.p === i ? 'pleased' : 'neutral';
}

/** Whether bot i passed or went stuck after log index `from`, with no stall since. */
function stuckSince(s: GameState, i: number, from: number): boolean {
  if (s.config.mode === 'race') return s.stuck[i];
  for (let k = s.log.length - 1; k > from; k--) {
    const e = s.log[k];
    if (e.e === 'stall') return false;
    if (e.e === 'pass' && e.p === i) return true;
  }
  return false;
}

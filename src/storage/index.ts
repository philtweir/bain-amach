// Local persistence: settings, glossary progress and one saved game. Each key holds
// { v, data } so a schema change can migrate or drop old data instead of crashing.
import { signal, effect } from '@preact/signals';
import { platform } from '../platform';
import type { Answers, GameState, Hints, Level, Mode } from '../engine/types';

function load<T>(key: string, v: number, fallback: T): T {
  const raw = platform.storage.get(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.v !== v) return fallback;
    return parsed.data as T;
  } catch {
    return fallback;
  }
}

/** True if the write landed. A failure here is a real error the UI may report. */
function save(key: string, v: number, data: unknown): boolean {
  return platform.storage.set(key, JSON.stringify({ v, data }));
}

// ---------- settings ----------

export interface SetupPlayer {
  name: string;
  kind: 'human' | 'bot';
  level: Level;
  color: number;
}

export interface SetupPrefs {
  who: 'solo' | 'pass';
  mode: Mode;
  answers: Answers;
  hints: Hints;
  bots: Level[];
  humans: SetupPlayer[];
}

export interface Settings {
  lang: 'ga' | 'en';
  answers: Answers;
  hints: Hints;
  botSpeed: 'slow' | 'normal' | 'fast';
  sound: boolean;
  haptics: boolean;
  reducedMotion: 'system' | 'always';
  theme: 'system' | 'light' | 'dark';
  onboarded: boolean;
  tutorialDone: boolean;
  installNudge: 'waiting' | 'due' | 'dismissed';
  gamesFinished: number;
  lastSetup: SetupPrefs | null;
  lastResult: string | null;
}

export const defaultSettings: Settings = {
  lang: 'ga',
  answers: 'shown',
  hints: 'request',
  botSpeed: 'normal',
  sound: true,
  haptics: true,
  reducedMotion: 'system',
  theme: 'system',
  onboarded: false,
  tutorialDone: false,
  installNudge: 'waiting',
  gamesFinished: 0,
  lastSetup: null,
  lastResult: null,
};

const SETTINGS_KEY = 'ba.settings';
export const settings = signal<Settings>({ ...defaultSettings, ...load<Partial<Settings>>(SETTINGS_KEY, 1, {}) });
export const saveError = signal(false);

export function updateSettings(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch };
}

effect(() => {
  const ok = save(SETTINGS_KEY, 1, settings.value);
  if (!ok) saveError.value = true;
});

// ---------- glossary progress ----------

export interface CompoundProgress {
  made: number;
  lastMade: number | null;
  lastSeen: number | null;
}

export interface Progress {
  byCompound: Record<string, CompoundProgress>;
  lastMadeId: string | null;
}

const PROGRESS_KEY = 'ba.progress';
export const progress = signal<Progress>(load<Progress>(PROGRESS_KEY, 1, { byCompound: {}, lastMadeId: null }));
effect(() => {
  if (!save(PROGRESS_KEY, 1, progress.value)) saveError.value = true;
});

export function madeCount(): number {
  return Object.values(progress.value.byCompound).filter((p) => p.made > 0).length;
}

/** Record a compound laid. Returns true if this is the first time this device's player made it. */
export function recordLine(compoundId: string, byHuman: boolean, now = Date.now()): boolean {
  const cur = progress.value.byCompound[compoundId] ?? { made: 0, lastMade: null, lastSeen: null };
  const first = byHuman && cur.made === 0;
  const next: CompoundProgress = {
    made: cur.made + (byHuman ? 1 : 0),
    lastMade: byHuman ? now : cur.lastMade,
    lastSeen: now,
  };
  progress.value = {
    byCompound: { ...progress.value.byCompound, [compoundId]: next },
    lastMadeId: byHuman ? compoundId : progress.value.lastMadeId,
  };
  return first;
}

export function resetProgress() {
  progress.value = { byCompound: {}, lastMadeId: null };
}

// ---------- saved game ----------

export interface SavedGame {
  state: GameState;
  /** Race clock, ms of play. */
  elapsed: number;
  savedAt: number;
}

const GAME_KEY = 'ba.game';
export const savedGame = signal<SavedGame | null>(load<SavedGame | null>(GAME_KEY, 1, null));

export function writeGame(g: SavedGame | null) {
  savedGame.value = g;
  if (!g) platform.storage.remove(GAME_KEY);
  else if (!save(GAME_KEY, 1, g)) saveError.value = true;
}

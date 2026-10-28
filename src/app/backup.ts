// Back up and restore settings, glossary progress and custom decks. Not the stórfhocal bag: that has
// its own restore points, only at milestones and only into an empty bag (feature plan, decision 11), so
// a backup can't undo a lost game. The unlock and its count do come along.
import type { SfProgress } from '../engine/storfhocail';
import { customDecks, defaultSettings, progress, settings, sfProgress } from '../storage';

const FORMAT = 'bain-amach-backup';

export function backupText(): string {
  const { finishedGames, announced, unlocked, noWarn } = sfProgress.value;
  return JSON.stringify({ format: FORMAT, v: 1, savedAt: new Date().toISOString(), settings: settings.value, progress: progress.value, decks: customDecks.value, sf: { finishedGames, announced, unlocked, noWarn } }, null, 2);
}

/** Restore a backup file. Returns an error string, or null when restored. */
export function restoreText(text: string): string | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return 'not a backup file';
  }
  if (raw?.format !== FORMAT || typeof raw.progress !== 'object' || !raw.progress) return 'not a backup file';
  settings.value = { ...defaultSettings, ...(raw.settings as object) };
  progress.value = raw.progress as typeof progress.value;
  customDecks.value = Array.isArray(raw.decks) ? (raw.decks as typeof customDecks.value) : [];
  const sf = (raw.sf ?? {}) as Partial<SfProgress> & { finishedSoloGames?: number };
  sfProgress.value = {
    ...sfProgress.value,
    finishedGames: Math.max(sfProgress.value.finishedGames, sf.finishedGames ?? sf.finishedSoloGames ?? 0),
    announced: sfProgress.value.announced || !!sf.announced,
    unlocked: sfProgress.value.unlocked || !!sf.unlocked,
    noWarn: sfProgress.value.noWarn || !!sf.noWarn,
  };
  return null;
}

/** Save a text file: the share sheet where there is one, else a download. */
export async function saveFile(name: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const f = new File([blob], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [f] })) {
    try {
      await navigator.share({ files: [f], title: name });
      return;
    } catch {
      // cancelled: fall back to a download
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

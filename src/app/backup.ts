// Back up and restore everything on the device that a player could lose: settings, glossary progress,
// custom decks and the stórfhocal bag (spec/storfhocal.md §9).
import { emptySfProgress } from '../engine/storfhocail';
import { customDecks, defaultSettings, progress, settings, sfProgress } from '../storage';

const FORMAT = 'bain-amach-backup';

export function backupText(): string {
  return JSON.stringify({ format: FORMAT, v: 1, savedAt: new Date().toISOString(), settings: settings.value, progress: progress.value, decks: customDecks.value, sf: sfProgress.value }, null, 2);
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
  sfProgress.value = { ...emptySfProgress(), ...(raw.sf as object) };
  return null;
}

/** Save a text file: the share sheet where there is one, else a download. */
export async function saveFile(name: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const f = new File([blob], name, { type: 'application/json' });
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

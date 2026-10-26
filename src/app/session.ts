// App-level session: the running game, setup defaults, install prompt and update state.
import { signal } from '@preact/signals';
import type { GameConfig, Level, PlayerConfig } from '../engine/types';
import { Controller } from '../game/controller';
import { t } from '../i18n';
import { platform } from '../platform';
import { settings, type SetupPrefs } from '../storage';

export const game = signal<Controller | null>(null);

export function startGame(init: { config: GameConfig } | { state: import('../engine/types').GameState; elapsed?: number }) {
  game.value?.dispose();
  const c = new Controller(init);
  game.value = c;
  c.start();
  // Handle for end-to-end tests and debugging.
  if (import.meta.env.DEV || location.search.includes('e2e')) (window as unknown as { __game: Controller }).__game = c;
  return c;
}

export function endGame() {
  game.value?.dispose();
  game.value = null;
}

export const BOT_LETTERS = ['B', 'C', 'D'];

export function defaultSetup(): SetupPrefs {
  const s = settings.value;
  return (
    s.lastSetup ?? {
      who: 'solo',
      mode: 'turns',
      answers: s.answers,
      hints: s.hints,
      bots: ['easy'],
      humans: [
        { name: '', kind: 'human', level: 'normal', color: 0 },
        { name: '', kind: 'human', level: 'normal', color: 1 },
      ],
    }
  );
}

/** Learner defaults for "Skip to a game": turns, one easy bot, answers shown, hints on request. */
export function learnerSetup(): SetupPrefs {
  return { ...defaultSetup(), who: 'solo', mode: 'turns', answers: 'shown', hints: 'request', bots: ['easy'] };
}

export function configFrom(p: SetupPrefs, seed = (Math.random() * 2 ** 31) >>> 0): GameConfig {
  const players: PlayerConfig[] = [];
  if (p.who === 'solo') {
    players.push({ name: t('table.you'), kind: 'human', color: 0 });
    p.bots.forEach((lv: Level, i) => players.push({ name: BOT_LETTERS[i], kind: 'bot', level: lv, color: i + 1 }));
  } else {
    p.humans.forEach((h, i) => players.push({ name: h.name.trim() || t('setup.defaultName', { n: i + 1 }), kind: 'human', color: h.color }));
    const used = new Set(players.map((x) => x.color));
    p.bots.forEach((lv, i) => {
      let col = 0;
      while (used.has(col)) col++;
      used.add(col);
      players.push({ name: BOT_LETTERS[i], kind: 'bot', level: lv, color: col });
    });
  }
  return { seed, players, mode: p.who === 'pass' ? 'turns' : p.mode, answers: p.answers, hints: p.hints };
}

// ---------- install and update ----------

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const installEvent = signal<BeforeInstallPromptEvent | null>(null);
export const updateReady = signal(false);
let applyUpdate: (() => void) | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent.value = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => (installEvent.value = null));
}

export function setUpdater(fn: () => void) {
  applyUpdate = fn;
  updateReady.value = true;
}

export function restartForUpdate() {
  applyUpdate?.();
}

export function canInstall() {
  return !platform.standalone && (platform.isIOS || !!installEvent.value);
}

// Platform calls behind one small interface. Web implementation only; a native wrapper
// (Tauri 2 or Capacitor) would swap this file, not the callers.

export interface Platform {
  haptic(kind: 'light' | 'strong'): void;
  readonly hapticsAvailable: boolean;
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): boolean;
    remove(key: string): void;
  };
  keepAwake(on: boolean): void;
  readonly isIOS: boolean;
  readonly standalone: boolean;
}

const nav = typeof navigator !== 'undefined' ? navigator : undefined;
const isIOS = !!nav && (/iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1));

/** The test build shares the release's origin, so its keys get a prefix: a test build can't touch
 *  a playtester's real games, glossary or bag. Release keys are unprefixed, as they always were. */
export const STORAGE_PREFIX = typeof __APP_CHANNEL__ !== 'undefined' && __APP_CHANNEL__ === 'main' ? 'ba-main:' : '';

/** Test build only: replace this build's data with a copy of the release's. One way, after a confirm. */
export function copyReleaseData(): number {
  if (!STORAGE_PREFIX) return 0;
  let n = 0;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
    }
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ba.')) keys.push(k);
    }
    for (const k of keys) {
      localStorage.setItem(STORAGE_PREFIX + k, localStorage.getItem(k)!);
      n++;
    }
  } catch {
    /* storage unavailable */
  }
  return n;
}

let wakeLock: { release(): Promise<void> } | null = null;
let wantAwake = false;

async function requestWake() {
  try {
    const wl = (nav as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (wl && document.visibilityState === 'visible') wakeLock = await wl.request('screen');
  } catch {
    wakeLock = null;
  }
}
if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    if (wantAwake && document.visibilityState === 'visible') void requestWake();
  });

export const platform: Platform = {
  hapticsAvailable: !!nav && typeof nav.vibrate === 'function' && !isIOS,
  haptic(kind) {
    try {
      if (this.hapticsAvailable) nav!.vibrate(kind === 'light' ? 8 : [14, 40, 22]);
    } catch {
      /* not supported */
    }
  },
  storage: {
    get(key) {
      try {
        return localStorage.getItem(STORAGE_PREFIX + key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(STORAGE_PREFIX + key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(STORAGE_PREFIX + key);
      } catch {
        /* ignore */
      }
    },
  },
  keepAwake(on) {
    wantAwake = on;
    if (on) void requestWake();
    else if (wakeLock) {
      void wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  },
  isIOS,
  standalone:
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || (nav as Navigator & { standalone?: boolean })?.standalone === true),
};

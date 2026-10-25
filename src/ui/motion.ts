// Reduced motion, theme and haptics, kept in sync with settings and the system.
import { effect, signal } from '@preact/signals';
import { platform } from '../platform';
import { settings } from '../storage';

const mqMotion = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const mqDark = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
const systemReduced = signal(!!mqMotion?.matches);
const systemDark = signal(!!mqDark?.matches);
mqMotion?.addEventListener('change', (e) => (systemReduced.value = e.matches));
mqDark?.addEventListener('change', (e) => (systemDark.value = e.matches));

export function reducedMotion(): boolean {
  return settings.value.reducedMotion === 'always' || systemReduced.value;
}

export const isDark = () => (settings.value.theme === 'system' ? systemDark.value : settings.value.theme === 'dark');

if (typeof document !== 'undefined') {
  effect(() => {
    const root = document.documentElement;
    root.classList.toggle('ba-reduce-motion', reducedMotion());
    const dark = isDark();
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.lang = settings.value.lang;
    // The status bar follows the table in the chosen theme, not only the system one.
    for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = dark ? '#121a19' : '#bfd3cc';
  });
}

export function haptic(kind: 'light' | 'strong') {
  if (settings.value.haptics) platform.haptic(kind);
}

/** ms, or the reduced-motion fade length. */
export function dur(ms: number): number {
  return reducedMotion() ? 120 : ms;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

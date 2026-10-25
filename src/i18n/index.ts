// Bilingual UI, Irish by default. ga.json holds only vetted strings; anything missing falls back
// to English so the app never shows a raw key. Append ?ga-missing to the URL to mark the gaps.
import en from './en.json';
import ga from './ga.json';
import { settings } from '../storage';

export type Key = keyof typeof en;
type Vars = Record<string, string | number>;

const GA = ga as Partial<Record<Key, string>>;
const markMissing = typeof location !== 'undefined' && location.search.includes('ga-missing');

export function t(key: Key, vars?: Vars): string {
  const irish = settings.value.lang === 'ga';
  let s: string = (irish ? GA[key] : undefined) ?? en[key] ?? key;
  if (irish && markMissing && GA[key] === undefined) s = '⟨' + s + '⟩';
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : '{' + k + '}'));
  return s;
}

/** Keys still waiting on Irish, for Phil's checklist. */
export function missingIrish(): Key[] {
  return (Object.keys(en) as Key[]).filter((k) => GA[k] === undefined);
}

export function ago(ts: number, now = Date.now()): string {
  const min = Math.round((now - ts) / 60000);
  if (min < 1) return t('ago.now');
  if (min < 60) return t('ago.min', { n: min });
  const h = Math.round(min / 60);
  if (h < 2) return t('ago.hour');
  const d0 = new Date(now), d1 = new Date(ts);
  const days = Math.round((new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime() - new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime()) / 86400000);
  if (days === 0) return h < 12 ? t('ago.hours', { n: h }) : t('ago.today');
  if (days === 1) return t('ago.yesterday');
  return t('ago.days', { n: days });
}

/** Days-ago label for the glossary ("today", "yesterday", "3 days ago"). */
export function dayLabel(ts: number, now = Date.now()): string {
  const d0 = new Date(now), d1 = new Date(ts);
  const days = Math.round((new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime() - new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime()) / 86400000);
  if (days <= 0) return t('ago.today');
  if (days === 1) return t('ago.yesterday');
  return t('ago.days', { n: days });
}

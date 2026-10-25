// Card faces, built on the design kit's ba- classes.
import type { JSX } from 'preact';
import { PARTICLE_TYPE, printedAnswer } from '../engine/deck';
import { meaningsOf } from '../engine/game';
import type { Card as CardT, Placed } from '../engine/types';
import { t } from '../i18n';

export type Size = 'hand' | 'river' | 'table';
export interface CardState {
  lit?: boolean;
  selected?: boolean;
  dim?: boolean;
  fresh?: boolean;
  taken?: boolean;
  shake?: boolean;
}

/** Word-length step from the character count: 5–6 → ba-l, 7+ → ba-xl. */
export function wordClass(w: string) {
  const n = [...w.normalize('NFC')].length;
  return n >= 7 ? ' ba-xl' : n >= 5 ? ' ba-l' : '';
}

export function typeClass(c: CardT): string {
  if (c.k === 'V') return 'ba-verb';
  if (c.k === 'W') return 'ba-wild';
  if (c.k === 'M') return 'ba-meaning';
  return PARTICLE_TYPE[c.t] === 'adverb' ? 'ba-adverb' : 'ba-preposition';
}

export function cardLabel(c: CardT | Placed): string {
  const p = c as Placed;
  let s: string;
  if (c.k === 'V') s = t('a11y.verb', { word: c.t });
  else if (c.k === 'W') s = p.stands ? t('a11y.wildAs', { word: p.stands }) : t('a11y.wild');
  else if (c.k === 'M')
    s = p.used ? t('a11y.meaningUsed', { meaning: p.used.toLowerCase() }) : t('a11y.meaning', { list: meaningsOf(c).map((g) => g.toLowerCase()).join('; ') });
  else s = PARTICLE_TYPE[c.t] === 'adverb' ? t('a11y.adverb', { word: c.t }) : t('a11y.preposition', { word: c.t });
  if (p.cross) s += ', ' + t('a11y.crossing');
  return s;
}

export function stateClass(st: CardState = {}) {
  return (st.lit ? ' is-lit' : '') + (st.selected ? ' is-selected' : '') + (st.dim ? ' is-dim' : '') + (st.fresh ? ' is-fresh' : '') + (st.taken ? ' is-taken' : '') + (st.shake ? ' is-shake' : '');
}

interface FaceProps extends CardState {
  card: CardT | Placed;
  size: Size;
  owner?: number;
  showOwner?: boolean;
  onTap?: (e: JSX.TargetedMouseEvent<HTMLElement>) => void;
  style?: JSX.CSSProperties;
  label?: string;
  id?: string;
  /** Hidden-answers mode for meaning cards. */
  hideAnswers?: boolean;
  tabIndex?: number;
  extraClass?: string;
}

/** A square card at hand, river or table size. Meaning cards at hand size use MeaningCard. */
export function Face(p: FaceProps) {
  const c = p.card;
  const placed = c as Placed;
  const size = p.size === 'hand' ? '' : p.size === 'river' ? ' ba-river' : ' ba-table';
  const vert = placed.axis === 'v' && (c.k === 'P' || c.k === 'W') ? ' ba-v' : '';
  const cls = 'ba-card ' + typeClass(c) + size + vert + stateClass(p) + (p.extraClass ? ' ' + p.extraClass : '');
  let inner: JSX.Element | JSX.Element[];
  if (c.k === 'W') inner = placed.stands ? <span class="ba-stands">{placed.stands}</span> : <span class="ba-star" />;
  else if (c.k === 'M') {
    const g = placed.used ?? meaningsOf(c)[0] ?? '';
    inner = <span class="ba-en">{g}</span>;
  } else inner = <span class={'ba-word' + wordClass(c.t)}>{c.t}</span>;
  const Tag = p.onTap ? 'button' : 'div';
  return (
    <Tag
      class={cls}
      style={p.style}
      onClick={p.onTap}
      aria-label={p.label ?? cardLabel(c)}
      aria-pressed={p.onTap ? (p.selected ? 'true' : 'false') : undefined}
      data-card={c.id}
      id={p.id}
      tabIndex={p.tabIndex}
      type={p.onTap ? 'button' : undefined}
    >
      {inner}
      {placed.cross && <i class="ba-cross" />}
      {p.showOwner && p.owner !== undefined && p.owner >= 0 && <i class={'ba-own ba-p' + (p.owner + 1)} />}
    </Tag>
  );
}

/** The wide meaning card in the hand: three meanings, the Irish answer under each (or a dotted rule). */
export function MeaningCard(p: { card: CardT; hidden?: boolean; onTap?: () => void; used?: string } & CardState) {
  const ms = meaningsOf(p.card);
  const Tag = p.onTap ? 'button' : 'div';
  const label = t('a11y.meaning', {
    list: ms.map((g) => g.toLowerCase() + (p.hidden ? '' : ', ' + printedAnswer(p.card.t, g))).join('; '),
  });
  return (
    <Tag class={'ba-card ba-meaning' + stateClass(p)} onClick={p.onTap} aria-label={label} aria-pressed={p.onTap ? (p.selected ? 'true' : 'false') : undefined} data-card={p.card.id} type={p.onTap ? 'button' : undefined}>
      {ms.map((g) => (
        <div class={'ba-m' + (p.used === g ? ' is-used' : '')} key={g}>
          <span class="ba-en">{g}</span>
          <span class={'ba-ga' + (p.hidden ? ' is-hidden' : '')}>{p.hidden ? '·' : printedAnswer(p.card.t, g)}</span>
        </div>
      ))}
    </Tag>
  );
}

export function Avatar(p: { player: number; initial: string; count?: number; turn?: boolean; playing?: boolean; name?: string; stuck?: boolean; plus?: number; big?: boolean }) {
  return (
    <span
      class={'ba-avatar ba-p' + (p.player + 1) + (p.turn ? ' is-turn' : '') + (p.playing ? ' is-playing' : '') + (p.big ? ' av-big' : '')}
      role="img"
      aria-label={p.name ? t('a11y.player', { name: p.name, n: p.count ?? 0 }) + (p.stuck ? ', ' + t('table.stuckTag') : '') : undefined}
    >
      <span class="ba-disc">{p.initial}</span>
      {p.name && p.big && <span class="av-name">{p.name}</span>}
      {p.count !== undefined && <span class="ba-cnt">{p.count}</span>}
      {p.stuck && <span class="av-flag">{t('table.stuckTag')}</span>}
      {!!p.plus && <span class="av-plus">+{p.plus}</span>}
    </span>
  );
}

export function Disc(p: { player: number; initial: string; size?: number }) {
  return (
    <span class={'ba-disc-solo ba-p' + (p.player + 1)} style={p.size ? { width: p.size, height: p.size, fontSize: p.size * 0.44 } : undefined} aria-hidden="true">
      {p.initial}
    </span>
  );
}

export function initialOf(name: string) {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

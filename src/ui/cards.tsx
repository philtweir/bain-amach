// Card faces, built on the design kit's ba- classes.
import type { JSX } from 'preact';
import { PARTICLE_TYPE, answersFor, printedAnswer, senseOf } from '../engine/deck';
import { meaningsOf } from '../engine/game';
import type { Card as CardT, Placed } from '../engine/types';
import type { CritterFace } from '../game/critters';
import { t, type Key } from '../i18n';
import { Critter } from './critters';
import { IconBag } from './icons';
import { SF_PHRASE, SF_WORD } from '../engine/storfhocail';
import { SIDE_ARROW, byMeaning, splitHalves, type Side, type Use } from './meaningUses';

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

/** Long glosses step down so they fit a square card: one long word, or three or more lines. */
export function glossClass(g: string) {
  const longest = Math.max(...g.split(/\s+/).map((w) => w.length));
  return longest >= 9 || g.length > 16 ? ' en-xs' : longest >= 7 ? ' en-sm' : '';
}

export function typeClass(c: CardT): string {
  if (c.k === 'V') return 'ba-verb';
  if (c.k === 'W') return 'ba-wild';
  if (c.k === 'M') return 'ba-meaning';
  if (c.k === 'S') return 'ba-sf';
  return PARTICLE_TYPE[c.t] === 'adverb' ? 'ba-adverb' : 'ba-preposition';
}

export function cardLabel(c: CardT | Placed): string {
  const p = c as Placed;
  let s: string;
  if (c.k === 'V') s = t('a11y.verb', { word: c.t });
  else if (c.k === 'W') s = p.stands ? t('a11y.wildAs', { word: p.stands }) : t('a11y.wild');
  else if (c.k === 'M')
    s = p.used ? t('a11y.meaningUsed', { meaning: p.used.toLowerCase() }) : t('a11y.meaning', { list: meaningsOf(c).map((g) => g.toLowerCase()).join('; ') });
  else if (c.k === 'S') s = t('a11y.sfOnTable', { word: SF_WORD[c.t]?.word ?? '', meaning: (SF_PHRASE[p.phrase ?? '']?.meaning ?? '').toLowerCase() });
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
  /** Meaning cards on the board: the lines ending on it, with the meaning each used and its side. */
  uses?: Use[];
}

/** A square card at hand, river or table size. Meaning cards at hand size use MeaningCard. */
export function Face(p: FaceProps) {
  const c = p.card;
  const placed = c as Placed;
  const size = p.size === 'hand' ? '' : p.size === 'river' ? ' ba-river' : ' ba-table';
  const vert = placed.axis === 'v' && (c.k === 'P' || c.k === 'W') ? ' ba-v' : '';
  const cls0 = 'ba-card ' + typeClass(c) + size + vert + stateClass(p) + (p.extraClass ? ' ' + p.extraClass : '');
  let inner: JSX.Element | JSX.Element[];
  let extra = '';
  let arrows: Side[] = [];
  if (c.k === 'W') inner = placed.stands ? <span class="ba-stands">{placed.stands}</span> : <span class="ba-star" />;
  else if (c.k === 'S') {
    const word = SF_WORD[c.t]?.word ?? '';
    inner = <span class={'ba-word' + wordClass(word)}>{word}</span>;
  } else if (c.k === 'M') {
    const g = placed.used ?? meaningsOf(c)[0] ?? '';
    const ms = p.uses ? byMeaning(p.uses) : [];
    if (ms.length >= 3) {
      // Three or four meanings in use: the zoomed-out tile symbol with the count. Tap to see them.
      extra = ' is-multi';
      inner = <span class="ba-multi tabnum">{ms.length}</span>;
    } else if (ms.length === 2) {
      // Two: split the card, each half against the side its line arrives from, the second reversed.
      extra = ' is-split';
      const halves = splitHalves(ms[0].sides[0], ms[1].sides[0]);
      inner = ms.map((m, i) => (
        <span class={'ba-half' + (i ? ' is-rev' : '')} style={{ clipPath: halves[i].clip }} key={m.g}>
          <span class={'ba-en ba-half-en' + (halves[i].box.w === 50 && halves[i].box.h === 100 ? ' is-narrow' : '')} style={{ left: halves[i].box.left + '%', top: halves[i].box.top + '%', width: halves[i].box.w + '%', height: halves[i].box.h + '%' }}>
            {m.g}
          </span>
        </span>
      ));
    } else {
      inner = <span class={'ba-en' + glossClass(g)}>{g}</span>;
      arrows = ms.length ? ms[0].sides : [];
    }
  } else inner = <span class={'ba-word' + wordClass(c.t)}>{c.t}</span>;
  const Tag = p.onTap ? 'button' : 'div';
  return (
    <Tag
      class={cls0 + extra}
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
      {arrows.map((a) => (
        <i class={'ba-arrive to-' + a} aria-hidden="true" key={a} />
      ))}
      {p.showOwner && p.owner !== undefined && p.owner >= 0 && <i class={'ba-own ba-p' + (p.owner + 1)} />}
    </Tag>
  );
}

/** The wide meaning card in the hand: three meanings, the Irish answer under each (or a dotted rule). */
export function MeaningCard(p: { card: CardT; hidden?: boolean; onTap?: () => void; used?: string; alts?: boolean; uses?: Use[] } & CardState) {
  // On the board: every meaning in use is marked, with an arrow after it for each of its lines,
  // running the way that line reads into the card.
  const inUse = p.uses ? byMeaning(p.uses) : [];
  const sidesOf = (g: string) => inUse.find((m) => m.g === g)?.sides ?? [];
  const ms = meaningsOf(p.card);
  const Tag = p.onTap ? 'button' : 'div';
  const label = t('a11y.meaning', {
    list: ms.map((g) => g.toLowerCase() + (p.hidden ? '' : ', ' + printedAnswer(p.card.t, g))).join('; '),
  });
  return (
    <Tag class={'ba-card ba-meaning' + stateClass(p)} onClick={p.onTap} aria-label={label} aria-pressed={p.onTap ? (p.selected ? 'true' : 'false') : undefined} data-card={p.card.id} type={p.onTap ? 'button' : undefined}>
      {ms.map((g) => (
        <div class={'ba-m' + (p.used === g || sidesOf(g).length ? ' is-used' : '') + (!p.hidden && senseOf(printedAnswer(p.card.t, g), g) ? ' has-sense' : '')} key={g}>
          <span class="ba-en">
            {g}
            {sidesOf(g).length > 0 && (
              <>
                <span class="ba-dir" aria-hidden="true">
                  {' '}
                  {sidesOf(g).map((sd) => SIDE_ARROW[sd]).join('')}
                </span>
                <span class="sr-only">, {sidesOf(g).map((sd) => t(`a11y.side.${sd}` as Key)).join(', ')}</span>
              </>
            )}
          </span>
          {!p.hidden && <SenseCount text={printedAnswer(p.card.t, g)} g={g} />}
          <span class={'ba-ga' + (p.hidden ? ' is-hidden' : '')}>{p.hidden ? '·' : printedAnswer(p.card.t, g)}</span>
          {p.alts && !p.hidden && answersFor(g).filter((a) => a !== printedAnswer(p.card.t, g)).map((a) => (
            <span class="ba-alt" key={a}>
              {t('table.alsoAnswer', { answer: a })}
            </span>
          ))}
        </div>
      ))}
    </Tag>
  );
}

/** "[1/2]": this is one of several meanings the printed compound has in the deck. */
function SenseCount({ text, g }: { text: string; g: string }) {
  const s = senseOf(text, g);
  return s ? (
    <>
      <span class="ba-sense tabnum" aria-hidden="true">
        [{s[0]}/{s[1]}]
      </span>
      <span class="sr-only">{t('a11y.sense', { n: s[0], total: s[1] })}</span>
    </>
  ) : null;
}

export function Avatar(p: { player: number; initial: string; count?: number; turn?: boolean; playing?: boolean; name?: string; stuck?: boolean; plus?: number; big?: boolean; critter?: CritterFace; bag?: boolean }) {
  return (
    <span
      class={'ba-avatar ba-p' + (p.player + 1) + (p.turn ? ' is-turn' : '') + (p.playing ? ' is-playing' : '') + (p.big ? ' av-big' : '')}
      role="img"
      aria-label={p.name ? t('a11y.player', { name: p.name, n: p.count ?? 0 }) + (p.stuck ? ', ' + t('table.stuckTag') : '') + (p.bag ? ', ' + t('sf.carrying') : '') : undefined}
    >
      <span class={'ba-disc' + (p.critter ? ' has-critter' : '')}>{p.critter ? <Critter species={p.critter.species} mood={p.critter.mood} size={44} /> : p.initial}</span>
      {p.name && p.big && <span class="av-name">{p.name}</span>}
      {p.count !== undefined && <span class="ba-cnt">{p.count}</span>}
      {p.stuck && <span class="av-flag">{t('table.stuckTag')}</span>}
      {!!p.plus && <span class="av-plus">+{p.plus}</span>}
      {p.bag && (
        <span class="av-bag" aria-hidden="true">
          <IconBag size={14} />
        </span>
      )}
    </span>
  );
}

export function Disc(p: { player: number; initial: string; size?: number; critter?: CritterFace }) {
  const size = p.size ?? 34;
  return (
    <span class={'ba-disc-solo ba-p' + (p.player + 1) + (p.critter ? ' has-critter' : '')} style={p.size ? { width: p.size, height: p.size, fontSize: p.size * 0.44 } : undefined} aria-hidden="true">
      {p.critter ? <Critter species={p.critter.species} mood={p.critter.mood} size={Math.round((size * 44) / 34)} /> : p.initial}
    </span>
  );
}

/** A board meaning card's label: with two or more meanings in use, each one and where its line is. */
export function meaningLabel(c: CardT, uses: Use[] | undefined): string {
  const ms = uses ? byMeaning(uses) : [];
  if (ms.length < 2) return cardLabel(c);
  const list = ms.map((m) => m.g.toLowerCase() + ' (' + m.sides.map((sd) => t(`a11y.side.${sd}` as Key)).join(', ') + ')').join('; ');
  return t('a11y.meaningUses', { list });
}

export function initialOf(name: string) {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

// Stórfhocail at the table and around it: the Opal tile (wide in the hand, square elsewhere), the bag
// sheet in a game (with its stakes warning), and the stake chip in the status strip.
import { useState } from 'preact/hooks';
import { DECK } from '../engine/deck';
import { SF, SF_PHRASE, SF_WORD, phraseInDeck, phraseText, type SfWord } from '../engine/storfhocail';
import type { GameState } from '../engine/types';
import type { Controller } from '../game/controller';
import { selEmpty } from '../game/controller';
import { t } from '../i18n';
import { sfProgress } from '../storage';
import { stateClass, wordClass, type CardState } from './cards';
import { IconTaken } from './icons';

/** The tile wide, as in the hand: the word and its part of speech, then each phrase over its meaning. */
export function SfWide({ word, hidden, onTap, ...st }: { word: string; hidden?: boolean; onTap?: () => void } & CardState) {
  const w = SF_WORD[word];
  if (!w) return null;
  const Tag = onTap ? 'button' : 'div';
  const list = w.phrases.map((ph) => (hidden ? '' : phraseText(ph) + ', ') + ph.meaning.toLowerCase()).join('; ');
  return (
    <Tag
      class={'ba-card ba-sf ba-sf-wide' + stateClass(st)}
      data-tile={word}
      onClick={onTap}
      aria-label={t('a11y.sfTile', { word: w.word, list })}
      aria-pressed={onTap ? (st.selected ? 'true' : 'false') : undefined}
      type={onTap ? 'button' : undefined}
    >
      <span class="ba-sf-head">
        <span class="ba-word">{w.word}</span>
        <span class="ba-sf-pos">{w.kind === 'adjective' ? t('sf.adj') : w.kind === 'fossil' ? t('sf.fossil') : t('sf.noun')}</span>
      </span>
      {w.phrases.map((ph) => (
        <span class="ba-sf-ph" key={ph.id}>
          <span class={'ba-ga' + (hidden ? ' is-hidden' : '')}>{hidden ? ' ' : phraseText(ph)}</span>
          <span class="ba-en">{ph.meaning}</span>
        </span>
      ))}
      <i class="ba-tw" aria-hidden="true" />
    </Tag>
  );
}

/** The tile square, at any size: the word, or (no word, or too small to read) the four-point star. */
export function SfMini({ word, size = 64, glyph, extra = '', label }: { word?: string; size?: number; glyph?: boolean; extra?: string; label?: string }) {
  const w = word ? SF_WORD[word]?.word : undefined;
  const star = glyph || !w || size < 40;
  return (
    <span
      class={'ba-card ba-sf sf-mini' + (star ? ' is-glyph' : '') + extra}
      style={{ '--s': size + 'px', '--fs': Math.round(size * 0.27) + 'px' } as Record<string, string>}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      {!star && <span class={'ba-word' + wordClass(w!)}>{w}</span>}
      {size >= 56 && <i class="ba-tw" aria-hidden="true" />}
    </span>
  );
}

/** Why a tile can't be used with this deck: the first verb or particle it needs that the deck leaves out. */
export function missingFor(w: SfWord): string | null {
  if (w.phrases.some((ph) => phraseInDeck(ph, DECK))) return null;
  const ph = w.phrases[0];
  const verbs = { ...DECK.verbs.base, ...Object.fromEntries(Object.entries(DECK.verbs.pack3to4 ?? {}).map(([v, n]) => [v, (DECK.verbs.base[v] ?? 0) + n])) };
  if (!(verbs[ph.verb] > 0)) return ph.verb;
  const parts = new Set(DECK.particles.filter((p) => p.copies > 0).map((p) => p.word));
  return ph.pattern.find((tk) => tk !== '~' && !parts.has(tk)) ?? ph.verb;
}

/** Who the stakes warning names: the Hard bot at the table, if there is just one (else -1). */
export function stakeBot(s: GameState): number {
  const hard = s.config.players.map((p, i) => (p.kind === 'bot' && p.level === 'hard' ? i : -1)).filter((i) => i >= 0);
  return hard.length === 1 ? hard[0] : -1;
}

/** The bag in a game: pick one tile into the hand (one at a time, free to put back). The race doesn't pause for it. */
export function SfBagSheet({ c }: { c: Controller }) {
  const [pick, setPick] = useState<string | null>(null);
  const [noWarn, setNoWarn] = useState(false);
  const open = c.sfPicker.value;
  const s = c.gs.value;
  if (!open || !s.sf) return null;
  const v = c.viewer.value;
  const pr = sfProgress.value;
  const held = s.sf.pouch[v]?.[0];
  const laidHere = new Set(s.sf.laid.filter((l) => l.p === v).map((l) => l.word));
  const words = SF.words.filter((w) => pr.owned[w.id] > 0 && !laidHere.has(w.id));
  const usable = (w: SfWord) => !missingFor(w);
  const chosen = pick ?? (held && words.some((w) => w.id === held) ? held : words.find(usable)?.id ?? null);
  const close = () => {
    setPick(null);
    c.sfPicker.value = false;
  };
  const take = () => {
    if (!chosen) return;
    if (noWarn) sfProgress.value = { ...sfProgress.value, noWarn: true };
    if (held && held !== chosen) c.putBack(held);
    if (held !== chosen) c.bringIn(chosen);
    close();
  };
  const bot = stakeBot(s);
  const name = bot >= 0 ? c.name(bot) : null;
  const total = SF.words.length;
  const owned = Object.values(pr.owned).filter((n) => n > 0).length;
  return (
    <div class="sheet-wrap" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div class="ba-scrim scrim-in" aria-hidden="true" />
      <div class="ba-sheet sheet sheet-in sf-bag-sheet" role="dialog" aria-modal="true" aria-label={t('sf.bagTitle')}>
        <div class="grabber" aria-hidden="true" />
        <div class="sheet-head">
          <h2 class="sheet-title">{t('sf.bagTitle')}</h2>
          <span class="muted tabnum">{t('sf.countOf', { n: owned, total })}</span>
        </div>
        <p class="sheet-sub">{t('sf.bagSub')}</p>
        {!words.length && <p class="body muted">{t('sf.bagEmpty')}</p>}
        <div class="sf-rows" role="listbox" aria-label={t('sf.bagTitle')}>
          {words.map((w) => {
            const miss = missingFor(w);
            const sel = chosen === w.id;
            return (
              <button
                class={'sf-row' + (sel ? ' is-selected' : '') + (miss ? ' is-off' : '')}
                key={w.id}
                role="option"
                aria-selected={sel ? 'true' : 'false'}
                aria-disabled={miss ? 'true' : undefined}
                data-word={w.id}
                onClick={() => (miss ? c.toast({ kind: 'soft', icon: 'no', msg: t('sf.needs', { word: miss }) }) : setPick(w.id))}
              >
                <SfMini word={w.id} size={56} extra={miss ? ' is-unusable' : ''} />
                <span class="sf-row-text">
                  {w.phrases.map((ph) => (
                    <span class="sf-row-ph" key={ph.id}>
                      <span class="sf-row-ga">{c.hidden ? w.word : phraseText(ph)}</span>
                      <span class="sf-row-en">{miss ? t('sf.needs', { word: miss }) : ph.meaning.toLowerCase()}</span>
                    </span>
                  ))}
                  {held === w.id && <span class="sf-row-tag">{t('sf.inHand')}</span>}
                </span>
                {sel && <span class="sf-row-tick" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {chosen && !pr.noWarn && (
          <>
            <div class="sf-warn" role="note">
              <IconTaken size={22} />
              <span>{name ? t('sf.warn', { word: SF_WORD[chosen].word, name }) : t('sf.warnAny', { word: SF_WORD[chosen].word })}</span>
            </div>
            <label class="sf-nowarn">
              <input type="checkbox" checked={noWarn} onChange={(e) => setNoWarn((e.target as HTMLInputElement).checked)} />
              <span>{t('sf.noWarn')}</span>
            </label>
          </>
        )}
        <div class="row2">
          <button class="ba-btn ba-btn-secondary" onClick={close}>
            {t('sf.close')}
          </button>
          <button class="ba-btn ba-btn-primary" disabled={!chosen || chosen === held} onClick={take}>
            {chosen ? t('sf.take', { word: SF_WORD[chosen].word }) : t('sf.takeNone')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The tiles on the table this game, each with a dot in the colour of whoever laid it. */
export function StakeChip({ c }: { c: Controller }) {
  const s = c.gs.value;
  const laid = s.sf?.laid ?? [];
  if (!laid.length) return null;
  const label = t('sf.stake', { list: laid.map((l) => t('sf.stakeBy', { word: SF_WORD[l.word]?.word ?? '', name: c.name(l.p) })).join('; ') });
  return (
    <span class="ba-stake" role="img" aria-label={label}>
      {laid.map((l, i) => (
        <span class="stake-one" key={i}>
          <span class="ba-card ba-sf ba-table" aria-hidden="true" />
          <span class={'ba-by ba-p' + ((s.config.players[l.p]?.color ?? 0) + 1)} aria-hidden="true" />
        </span>
      ))}
    </span>
  );
}

/** The tile in the hand, first in the meanings lane. */
export function HandTile({ c }: { c: Controller }) {
  const s = c.gs.value;
  const v = c.viewer.value;
  const word = s.sf?.pouch[v]?.[0];
  if (!word || !c.isHuman(v)) return null;
  const sel = c.sel.value;
  const lit = c.lit.value;
  const active = !c.hidden && !selEmpty(sel);
  const selected = sel.tile === word;
  const isLit = !!lit?.tiles.has(word);
  return (
    <div class="tray-slot">
      <SfWide word={word} hidden={c.hidden} selected={selected} lit={isLit && !selected} dim={active && !selected && !isLit} onTap={() => c.tapTile(word)} />
    </div>
  );
}

/** "tabhair aire do · take care of": a line's Irish and meaning, for a phrase id. */
export const phraseLine = (id: string) => (SF_PHRASE[id] ? phraseText(SF_PHRASE[id]) + ' · ' + SF_PHRASE[id].meaning.toLowerCase() : '');

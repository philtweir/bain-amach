// Stórfhocail at the table: the tile, the pouch at the end of the hand, the bag picker (with its
// warning), and the badge on a bot carrying one.
import { useState } from 'preact/hooks';
import { DECK } from '../engine/deck';
import { holdsTile, tilesBrought } from '../engine/game';
import { SF_SETTINGS, SF_WORD, phraseText, wordInDeck } from '../engine/storfhocail';
import type { Controller } from '../game/controller';
import { selEmpty } from '../game/controller';
import { t } from '../i18n';
import { sfProgress } from '../storage';
import { stateClass, type CardState } from './cards';
import { IconBag } from './icons';

/** A stórfhocal tile in the hand tray: the word and, answers shown, each phrase with its meaning. */
export function SfTile({ word, hidden, onTap, ...st }: { word: string; hidden?: boolean; onTap?: () => void } & CardState) {
  const w = SF_WORD[word];
  if (!w) return null;
  const Tag = onTap ? 'button' : 'div';
  const list = w.phrases.map((ph) => (hidden ? '' : phraseText(ph) + ', ') + ph.meaning.toLowerCase()).join('; ');
  return (
    <Tag
      class={'ba-card ba-sf sf-tile' + (w.phrases.length > 1 ? ' is-multi' : '') + stateClass(st)}
      data-tile={word}
      onClick={onTap}
      aria-label={t('a11y.sfTile', { word: w.word, list })}
      aria-pressed={onTap ? (st.selected ? 'true' : 'false') : undefined}
      type={onTap ? 'button' : undefined}
    >
      <span class="sf-word">{w.word}</span>
      {w.phrases.map((ph) => (
        <span class="sf-ph" key={ph.id}>
          {!hidden && <span class="sf-ga">{phraseText(ph)}</span>}
          <span class="sf-en">{ph.meaning}</span>
        </span>
      ))}
    </Tag>
  );
}

/** The pouch: the bag button and the tiles brought into this game, apart from the hand. */
export function Pouch({ c }: { c: Controller }) {
  const s = c.gs.value;
  const v = c.viewer.value;
  if (!s.sf || !c.isHuman(v)) return null;
  const sel = c.sel.value;
  const lit = c.lit.value;
  const active = !c.hidden && !selEmpty(sel);
  const pouch = s.sf.pouch[v] ?? [];
  return (
    <div class="pouch" role="group" aria-label={t('sf.pouch')}>
      <button class="ba-icon-btn pouch-bag" aria-label={t('sf.openBag')} onClick={() => (c.sfPicker.value = true)}>
        <IconBag size={26} />
      </button>
      {pouch.map((w, i) => {
        const selected = sel.tile === w;
        const isLit = !!lit?.tiles.has(w);
        return <SfTile key={w + i} word={w} hidden={c.hidden} selected={selected} lit={isLit && !selected} dim={active && !selected && !isLit} onTap={() => c.tapTile(w)} />;
      })}
    </div>
  );
}

/** Pick tiles from the bag into the pouch, or put unlaid ones back. The race doesn't pause for it. */
export function SfPicker({ c }: { c: Controller }) {
  const [warn, setWarn] = useState<string | null>(null);
  const open = c.sfPicker.value;
  const s = c.gs.value;
  if (!open || !s.sf) return null;
  const v = c.viewer.value;
  const owned = sfProgress.value.owned;
  const pouch = s.sf.pouch[v] ?? [];
  const laidHere = s.sf.laid.filter((l) => l.p === v).map((l) => l.word);
  const brought = tilesBrought(s, v);
  const left = SF_SETTINGS.playerMaxPerGame - brought;
  const close = () => {
    setWarn(null);
    c.sfPicker.value = false;
  };
  const bring = (w: string) => {
    if (!c.sfWarned) return setWarn(w);
    c.bringIn(w);
  };
  const words = Object.keys(owned)
    .filter((w) => owned[w] > 0 && SF_WORD[w])
    .sort((a, b) => SF_WORD[a].word.localeCompare(SF_WORD[b].word, 'ga'));
  return (
    <div class="sheet-wrap" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div class="ba-scrim scrim-in" aria-hidden="true" />
      <div class="ba-sheet sheet sheet-in sf-picker" role="dialog" aria-modal="true" aria-label={t('sf.bagTitle')}>
        <div class="grabber" aria-hidden="true" />
        {warn ? (
          <>
            <h2 class="sheet-title">{t('sf.warnTitle')}</h2>
            <p class="sheet-sub">{t('sf.warn', { word: SF_WORD[warn].word })}</p>
            <button
              class="ba-btn ba-btn-primary wide"
              onClick={() => {
                c.sfWarned = true;
                c.bringIn(warn);
                setWarn(null);
              }}
            >
              {t('sf.bringIn')}
            </button>
            <button class="ba-btn ba-btn-secondary wide" onClick={() => setWarn(null)}>
              {t('sf.notNow')}
            </button>
          </>
        ) : (
          <>
            <h2 class="sheet-title">{t('sf.bagTitle')}</h2>
            <p class="sheet-sub">{left > 0 ? t('sf.bagSub', { n: left }) : t('sf.bagFull', { n: SF_SETTINGS.playerMaxPerGame })}</p>
            {!words.length && <p class="body muted">{t('sf.bagEmpty')}</p>}
            <div class="sf-pick-list">
              {words.map((w) => {
                const inPouch = pouch.filter((x) => x === w).length;
                const free = owned[w] - inPouch - laidHere.filter((x) => x === w).length;
                const playable = wordInDeck(SF_WORD[w], DECK);
                const can = playable && free > 0 && left > 0;
                return (
                  <div class={'sf-pick' + (playable ? '' : ' is-off')} key={w}>
                    <SfTile word={w} hidden={c.hidden} />
                    <div class="sf-pick-side">
                      <span class="tabnum muted">×{owned[w]}</span>
                      {inPouch > 0 && holdsTile(s, v, w) ? (
                        <button class="ba-btn ba-btn-secondary" onClick={() => c.putBack(w)}>
                          {t('sf.putBack')}
                        </button>
                      ) : null}
                      <button class="ba-btn ba-btn-primary" disabled={!can} onClick={() => bring(w)}>
                        {t('sf.bring')}
                      </button>
                      {!playable && <span class="caption muted">{t('sf.notInDeck')}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <button class="ba-btn ba-btn-secondary wide" onClick={close}>
              {t('sf.done')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

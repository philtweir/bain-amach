// Recap: result, standings, every compound made in play order, up to three missed lines.
import { BASE_COMPOUND_BY_ID as COMPOUND_BY_ID, compoundText } from '../../engine/deck';
import { SF_SETTINGS, SF_WORD, lineText, type Settlement } from '../../engine/storfhocail';
import type { Finished } from '../../app/storfhocail';
import { SfMini } from '../storfhocal';
import type { GameState } from '../../engine/types';
import { t } from '../../i18n';
import { botName, moodOf, speciesOf } from '../../game/critters';
import { Disc, initialOf } from '../cards';
import { IconChevron, IconClose, IconHint } from '../icons';
import { Screen, Scroll } from '../kit';
import { UpdateBanner } from './home';

export function RecapScreen({ state, finished, onAgain, onReplay, onClose, onCompound }: { state: GameState; finished?: Finished; onAgain: () => void; onReplay: () => void; onClose: () => void; onCompound: (id: string) => void }) {
  const s = state;
  const o = s.over!;
  const players = s.config.players;
  const humans = players.map((p, i) => (p.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const solo = humans.length === 1;
  const name = (i: number) => (solo && players[i].kind === 'human' ? t('table.you') : players[i].kind === 'bot' ? botName(players, i) : players[i].name);
  const face = (i: number) => (players[i].kind === 'bot' ? { species: speciesOf(players[i].level), mood: moodOf(s, i, null) } : null);
  const w = o.winners[0];
  let eyebrow: string;
  let title: string;
  if (o.how === 'out') {
    eyebrow = solo && players[w].kind === 'human' ? t('recap.youWentOut') : t('recap.wentOut', { name: name(w) });
    title = solo && players[w].kind === 'human' ? t('recap.youWin') : t('recap.theyWin', { name: name(w) });
  } else {
    eyebrow = t('recap.fewestHead');
    title = o.tie ? t('recap.shared') : solo && players[w].kind === 'human' ? t('recap.youWin') : t('recap.theyWin', { name: name(w) });
  }
  const hintsUsed = humans.some((h) => s.hintsUsed[h]);
  const order = players.map((_, i) => i).sort((a, b) => s.hands[a].length - s.hands[b].length);
  const missed = humans.flatMap((h) => s.missed[h].map((m) => ({ ...m, p: h }))).slice(0, 3);

  const left = (
    <div class="col">
      <div class="eyebrow">{eyebrow}</div>
      <h1 class="display recap-title">{title}</h1>
      <div class="standings">
        {order.map((i) => {
          const n = s.hands[i].length;
          const nl = s.lines.filter((l) => l.p === i).length;
          return (
            <div class="stand-row" key={i}>
              <Disc player={players[i].color} initial={initialOf(name(i))} size={40} critter={face(i)} />
              <span class="sr-name">{name(i)}</span>
              <span class="sr-n tabnum">{n === 1 ? t('table.oneCard') : t('table.cards', { n })}</span>
              <span class="sr-n tabnum">{nl === 1 ? t('recap.oneLine') : t('recap.lines', { n: nl })}</span>
            </div>
          );
        })}
      </div>
      {finished?.unlocked && (
        <div class="panel sf-unlock" role="status">
          <SfMini size={56} glyph />
          <span class="sf-move-text">
            <span class="sf-move-line">{t('sf.unlockTitle')}</span>
            <span class="sf-move-sub">{t('sf.unlockSub', { n: SF_SETTINGS.unlockAfterGames })}</span>
          </span>
        </div>
      )}
      {finished?.settlement && <SfRows s={s} st={finished.settlement} name={name} ownedBefore={finished.ownedBefore} />}
      <div class="recap-actions wide-only">
        <button class="ba-btn ba-btn-primary" onClick={onAgain}>
          {t('recap.again')}
        </button>
        <button class="ba-btn ba-btn-secondary" onClick={onReplay}>
          {t('recap.replay')}
        </button>
      </div>
    </div>
  );

  const right = (
    <div class="col">
      <div class="list-head">
        <h2 class="sec-label">{t('recap.made')}</h2>
        <span class="caption muted">{t('recap.inOrder', { n: s.lines.length })}</span>
      </div>
      {!s.lines.length && <p class="body muted">{t('recap.none')}</p>}
      <div class="list">
        {s.lines.map((l, i) => {
          return (
            <button class="list-row" key={i} onClick={() => onCompound(l.c)}>
              <span class={'ba-dot dot-sm ba-p' + (players[l.p].color + 1)} aria-hidden="true" />
              <span class="lr-text">
                <span class="lr-ga">{lineText(l.c)}</span>
                <span class="lr-en">
                  {l.g.toLowerCase()} · {name(l.p)}
                </span>
              </span>
              <IconChevron size={22} />
            </button>
          );
        })}
      </div>
      {missed.length > 0 && (
        <>
          <h2 class="sec-label">{t('recap.couldHave')}</h2>
          <div class="list">
            {missed.map((m, i) => (
              <div class="list-row missed" key={i}>
                <span class="lr-text">
                  <span class="lr-ga">{compoundText(COMPOUND_BY_ID[m.c])}</span>
                  <span class="lr-en">
                    {m.g.toLowerCase()} ·{' '}
                    {m.river.length ? t('recap.missedRiver', { words: m.river.join(', '), n: m.turnNo }) : m.wild ? t('recap.missedWild', { n: m.turnNo }) : t('recap.missedTurn', { n: m.turnNo })}
                    {!solo ? ' · ' + name(m.p) : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <Screen class="recap">
      <Scroll>
        <div class="pad">
          <UpdateBanner />
          <div class="hdr">
            <button class="ba-icon-btn hdr-back" aria-label={t('recap.close')} onClick={onClose}>
              <IconClose size={26} />
            </button>
            <span class="hdr-title" />
            {hintsUsed && (
              <span class="chip-hints">
                <IconHint size={18} /> {t('recap.hintsUsed')}
              </span>
            )}
          </div>
          <div class="two-col">
            {left}
            {right}
          </div>
          <div class="bottom-space" />
        </div>
      </Scroll>
      <div class="bottom-bar narrow-only">
        <button class="ba-btn ba-btn-secondary" onClick={onReplay}>
          {t('recap.replay')}
        </button>
        <button class="ba-btn ba-btn-primary" onClick={onAgain}>
          {t('recap.again')}
        </button>
      </div>
    </Screen>
  );
}

/** Where each stórfhocal on the table went: into your bag, staying there, to the winning bot, or gone.
 *  ownedBefore: the bag before this game settled, so a tile you already had says so. */
export function SfRows({ s, st, name, ownedBefore }: { s: GameState; st: Settlement; name: (i: number) => string; ownedBefore?: string[] }) {
  const laid = s.sf?.laid ?? [];
  if (!laid.length) return null;
  const human = s.config.players.findIndex((p) => p.kind === 'human');
  const winner = s.over && !s.over.tie ? s.over.winners[0] : -1;
  const had = new Set(ownedBefore ?? []);
  const word = (w: string) => SF_WORD[w]?.word ?? w;
  const rows = laid.map((l) => {
    const w = word(l.word);
    if (l.p === human) {
      if (st.lost.includes(l.word)) return { w: l.word, line: t('sf.took', { name: winner >= 0 ? name(winner) : t('sf.theBot'), word: w }), sub: t('sf.tookSub', { name: winner >= 0 ? name(winner) : t('sf.theBot') }) };
      return { w: l.word, line: t('sf.stays', { word: w }), sub: s.over?.tie ? t('sf.staysTie') : t('sf.staysWon') };
    }
    if (st.gained.includes(l.word)) return { w: l.word, line: had.has(l.word) ? t('sf.already', { word: w }) : t('sf.joins', { word: w }), sub: t('sf.joinsSub', { name: name(l.p) }) };
    return { w: l.word, line: t('sf.laidBy', { word: w, name: name(l.p) }), sub: winner === l.p ? t('sf.goesWith', { name: name(l.p) }) : t('sf.gone') };
  });
  return (
    <section class="sf-rows-block" aria-label={t('sf.title')}>
      <h2 class="sec-label">{t('sf.title')}</h2>
      {rows.map((r, i) => (
        <div class="sf-move" key={r.w + i} style={{ animationDelay: `${i * 160}ms` }}>
          <SfMini word={r.w} size={56} />
          <span class="sf-move-text">
            <span class="sf-move-line">{r.line}</span>
            <span class="sf-move-sub">{r.sub}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

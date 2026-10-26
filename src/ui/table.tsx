// The game table: status strip, river, board, hand tray, toasts, the line-made moment,
// the end card, the pass-and-play cover and the pause sheet.
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { COMPOUND_BY_ID, COMPOUNDS, compoundText } from '../engine/deck';
import { canDraw, lineMoves, meaningsOf } from '../engine/game';
import type { Card } from '../engine/types';
import { hasMeaning, selEmpty, type Controller } from '../game/controller';
import { t } from '../i18n';
import { Critter } from './critters';
import { Avatar, Disc, MeaningCard, cardLabel, glossClass, initialOf, stateClass, typeClass, wordClass } from './cards';
import { Board } from './board';
import { IconClock, IconHint, IconNotQuite, IconPause, IconRefused, IconRiverTurns, IconTaken } from './icons';
import { nav, pushBackHandler } from './nav';
import { press } from './press';

// ---------- status strip ----------

function Status({ c }: { c: Controller }) {
  const s = c.gs.value;
  const viewer = c.viewer.value;
  const playing = c.botPlaying.value;
  const plus = c.plus.value;
  const players = s.config.players.map((p, i) => ({ p, i })).filter(({ i }) => c.passAndPlay || i !== viewer);
  let status: JSX.Element;
  if (c.race) {
    const sec = Math.floor(c.elapsed.value / 1000);
    status = (
      <span class="st-clock" aria-label={t('table.clock')}>
        <IconClock size={22} />
        <span class="tabnum">
          {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}
        </span>
      </span>
    );
  } else {
    const turn = s.turn;
    const label = playing !== null ? t('table.playing', { name: c.name(playing) }) : turn === viewer && !c.passAndPlay ? t('table.yourTurn') : t('table.theirTurn', { name: c.name(turn) });
    status = (
      <span class={'st-turn' + (players.length >= 3 ? ' st-crowded' : '')} aria-live="polite">
        <span class={'st-dot ba-p' + (s.config.players[turn].color + 1)} />
        <span class="st-label">{label}</span>
      </span>
    );
  }
  return (
    <div class="status">
      <div class="st-avatars">
        {players.map(({ p, i }) => (
          <span data-avatar={i} key={i}>
            <Avatar
              player={p.color}
              initial={initialOf(p.kind === 'human' && !c.passAndPlay ? t('table.you') : p.name)}
              count={s.hands[i].length}
              name={c.name(i)}
              turn={!c.race && s.turn === i}
              playing={playing === i}
              stuck={c.race && s.stuck[i]}
              plus={plus[i]}
              big={c.passAndPlay}
              critter={c.critter(i)}
            />
          </span>
        ))}
      </div>
      {status}
      <button class="ba-icon-btn" aria-label={t('table.pause')} onClick={() => c.pause(true)}>
        <IconPause size={24} />
      </button>
    </div>
  );
}

// ---------- river ----------

function River({ c }: { c: Controller }) {
  const s = c.gs.value;
  const lit = c.lit.value;
  const sel = c.sel.value;
  const picks = c.picks.value;
  const taken = c.taken.value;
  const stallAt = c.stallMark.value;
  const [, tick] = useState(0);
  const turning = Date.now() - stallAt < 2000;
  useEffect(() => {
    if (!turning) return;
    const tm = setTimeout(() => tick((n) => n + 1), 2000 - (Date.now() - stallAt));
    return () => clearTimeout(tm);
  }, [stallAt]);
  const selActive = !c.hidden && !selEmpty(sel);
  return (
    <div class="river ba-riverbed" role="group" aria-label="River">
      {s.piles.map((pl, i) => {
        // Hidden mode: a picked card leaves its pile, so the next one shows.
        const used = c.hidden ? picks.filter((p) => 'river' in p && p.river === i).length : 0;
        const n = pl.length - used;
        const top = n > 0 ? pl[n - 1] : null;
        const isTaken = !!taken && taken.river === i && Date.now() - taken.at < 700;
        const isLit = !!lit?.river.has(i);
        const picked = !c.hidden && sel.river.includes(i);
        const st = { lit: isLit, selected: picked, dim: selActive && !isLit && !picked, taken: isTaken };
        const h = press(() => c.tapRiver(i), () => c.tapRiver(i, true));
        return (
          <div class={'ba-pile' + (top ? '' : ' is-empty') + (turning ? ' is-turning' : '')} key={i}>
            <button
              class="ba-stack"
              data-pile={i}
              aria-label={top ? t('a11y.pile', { n: i + 1, word: top.t, left: n }) + (isLit ? ', ' + t('a11y.lit') : '') : t('a11y.pileEmpty', { n: i + 1 })}
              disabled={!top}
              {...h}
            >
              {top && (
                <div key={top.id} class={'ba-card ba-river ' + typeClass(top) + stateClass(st) + ' river-top'} data-card={top.id}>
                  <span class={'ba-word' + wordClass(top.t)}>{top.t}</span>
                </div>
              )}
              {turning && <span class="turn-mark" aria-hidden="true"><IconRiverTurns size={16} /></span>}
            </button>
            <span class="ba-left tabnum">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- tray ----------

function TrayCard({ c, card, st }: { c: Controller; card: Card; st: { lit?: boolean; selected?: boolean; dim?: boolean; shake?: boolean } }) {
  const hidden = c.hidden;
  if (card.k === 'M') {
    const h = press(() => c.tapMeaning(card.id));
    return (
      <div class="tray-slot" {...h}>
        <MeaningCard card={card} hidden={hidden} onTap={() => {}} {...st} />
      </div>
    );
  }
  const h = press(
    () => (card.k === 'W' ? c.tapWild(card.id) : c.tapHandVerb(card.id)),
    card.k === 'V' ? () => c.tapHandVerb(card.id, true) : undefined,
  );
  return (
    <button class={'ba-card ' + typeClass(card) + stateClass(st)} data-card={card.id} aria-label={cardLabel(card)} aria-pressed={st.selected ? 'true' : 'false'} {...h}>
      {card.k === 'W' ? <span class="ba-star" /> : <span class={'ba-word' + wordClass(card.t)}>{card.t}</span>}
    </button>
  );
}

function FaceUp({ c }: { c: Controller }) {
  const s = c.gs.value;
  const f = s.faceUp;
  const sel = c.sel.value;
  // Answers shown: once you pick a meaning card to swap, the face-up card lights if it makes a line now.
  const swapLit = !!f && !c.hidden && sel.meaning !== undefined && c.canAct.value && lineMoves(s, c.viewer.value, { meanings: [f], handSpots: 1 }).length > 0;
  return (
    <div class="faceup">
      <button class={'ba-pile' + (f ? '' : ' is-empty')} onClick={() => c.tapFaceUp()} aria-label={f ? t('a11y.faceUp', { list: meaningsOf(f).map((g) => g.toLowerCase()).join('; '), n: s.mpile.length }) : t('a11y.pileEmpty', { n: 0 })}>
        <div class="ba-stack">
          {f && (
            <div class={'ba-card ba-meaning ba-river' + (swapLit ? ' is-lit' : '')} data-card={f.id}>
              <span class={'ba-en' + glossClass(meaningsOf(f)[0])}>{meaningsOf(f)[0]}</span>
            </div>
          )}
        </div>
      </button>
      <span class="fu-label tabnum">{t('table.faceUp', { n: s.mpile.length })}</span>
      <span class="fu-label fu-deck tabnum">{t('table.deck', { n: s.main.length })}</span>
    </div>
  );
}

function YourLine({ c }: { c: Controller }) {
  const s = c.gs.value;
  const sel = c.sel.value;
  const picks = c.picks.value;
  const hand = s.hands[c.viewer.value];
  const m = sel.meaning !== undefined ? hand.find((x) => x.id === sel.meaning) : sel.onto ? s.board.find((b) => b.x === sel.onto!.x && b.y === sel.onto!.y) : undefined;
  let verb: string | undefined;
  if (sel.verb) verb = 'table' in sel.verb ? s.board.find((b) => b.x === (sel.verb as any).table.x && b.y === (sel.verb as any).table.y)?.t : hand.find((x) => x.id === (sel.verb as any).hand)?.t;
  const tops = s.piles.map((p) => p.length);
  const shake = c.shake.value && c.shake.value.key === 'line' && Date.now() - c.shake.value.at < 400;
  return (
    <div class={'yourline' + (shake ? ' is-shake' : '')} aria-live="polite">
      <span class="yl-label">{t('table.yourLine')}</span>
      {m && <span class="yl-meaning">{meaningsOf(m)[0]}</span>}
      {verb && (
        <span class="ba-card ba-verb yl-card">
          <span class={'ba-word' + wordClass(verb)}>{verb}</span>
        </span>
      )}
      {picks.map((p, i) => {
        if ('river' in p) {
          const card = s.piles[p.river][--tops[p.river]];
          if (!card) return null;
          return (
            <span key={i} class={'ba-card yl-card ' + typeClass(card)} data-card={card.id}>
              <span class={'ba-word' + wordClass(card.t)}>{card.t}</span>
            </span>
          );
        }
        if ('wild' in p)
          return (
            <span key={i} class="ba-card ba-wild yl-card" data-card={p.wild}>
              <span class="ba-star" />
            </span>
          );
        const b = s.board.find((x) => x.x === p.cross.x && x.y === p.cross.y);
        return (
          <span key={i} class={'ba-card yl-card ' + (b ? typeClass(b) : '')}>
            <span class="ba-word">{b?.t}</span>
          </span>
        );
      })}
    </div>
  );
}

function Header({ c }: { c: Controller }) {
  const s = c.gs.value;
  const sel = c.sel.value;
  const viewer = c.viewer.value;
  const hand = s.hands[viewer];
  const canAct = c.canAct.value;
  const spot = c.spot.value;
  const choices = c.choices.value;
  const fs = c.finalStalls();
  const note = c.headerNote.value;
  const stuck = c.race && s.stuck[viewer];
  const locked = c.locked.value;
  const hintsOn = c.config.hints !== 'off';
  let title = c.passAndPlay ? t('table.theirHand', { name: c.name(viewer), n: hand.length }) : t('table.yourHand', { n: hand.length });
  let sub: string | null = note ?? (canAct ? t('table.tapMeaning') : c.race ? null : t('table.waitTurn'));
  const actions: JSX.Element[] = [];
  const cancel = (
    <button class="ba-btn ba-btn-quiet" onClick={() => c.clearSelection()} key="cancel">
      {t('table.cancel')}
    </button>
  );
  const verbOnly = sel.verb && 'hand' in sel.verb && sel.meaning === undefined && !sel.river.length && !sel.wild.length;
  const drawOk = canDraw(s);

  const stuckBtn = (
    <button class="ba-btn ba-btn-stuck" aria-pressed={stuck ? 'true' : 'false'} onClick={() => c.toggleStuck()} key="stuck" disabled={s.over !== null}>
      {t('table.stuck')}
    </button>
  );
  const passBtn = (
    <button class="ba-btn ba-btn-secondary" onClick={() => c.drawAndPass()} disabled={!canAct} key="pass">
      {drawOk ? t('table.drawPass') : t('table.pass')}
    </button>
  );

  if (fs) {
    title = t('table.finalStalls', { n: fs.n, total: fs.total });
    sub = note ?? t('table.finalStallsSub', { total: fs.total });
  }

  if (c.hidden) {
    const ready = hasMeaning(sel) && !!sel.verb && c.picks.value.length > 0;
    const any = hasMeaning(sel) || !!sel.verb || c.picks.value.length > 0;
    if (any && canAct) {
      title = ready ? t('table.ready') : t('table.building');
      sub = ready ? t('table.hiddenSub') : t('table.buildingSub');
      actions.push(
        <button class="ba-btn ba-btn-quiet" onClick={() => c.clearSelection()} key="clear">
          {t('table.clear')}
        </button>,
      );
    }
    if (verbOnly && canAct && c.picks.value.length === 0) {
      actions.length = 0;
      title = t('table.loneQ', { word: hand.find((x) => x.id === (sel.verb as { hand: number }).hand)?.t ?? '' });
      sub = drawOk ? t('table.loneSub') : t('table.loneNone');
      actions.push(cancel);
      actions.push(
        <button class="ba-btn ba-btn-primary" disabled={!drawOk} onClick={() => c.layAlone()} key="lone">
          {t('table.layAlone')} <span class="ba-cost">· {t('table.draw2')}</span>
        </button>,
      );
    } else {
      if (stuck && !any) sub = t('table.stuckOn');
      if (c.race) actions.push(stuckBtn);
      else if (!any) actions.push(passBtn);
      if (any || c.race)
        actions.push(
          locked ? (
            <button class="ba-btn ba-btn-primary is-disabled" disabled key="wait">
              <LockRing c={c} /> {t('table.wait')}
            </button>
          ) : (
            <button class="ba-btn ba-btn-primary" disabled={!ready || !canAct} onClick={() => c.layIt()} key="lay">
              {t('table.layIt')}
            </button>
          ),
        );
    }
  } else if (spot && canAct) {
    title = t('table.chooseSpot');
    sub = spot.lone !== undefined ? t('table.loneSub') : t('table.chooseSpotSub');
    actions.push(cancel);
    if (spot.lone !== undefined)
      actions.push(
        <button class="ba-btn ba-btn-primary" onClick={() => c.confirmSpot()} key="lone">
          {t('table.layAlone')} <span class="ba-cost">· {t('table.draw2')}</span>
        </button>,
      );
  } else if (c.needWild.value && canAct) {
    const nw = c.needWild.value;
    title = t('table.needWildTitle');
    sub = t(nw.n > 1 ? 'table.needWildSub2' : 'table.needWildSub', { compound: nw.compound, n: nw.n });
    actions.push(cancel);
  } else if (choices.length > 1 && canAct) {
    title = t('table.twoWays');
    sub = t('table.twoWaysSub');
    actions.push(cancel);
  } else if (verbOnly && canAct) {
    const word = hand.find((x) => x.id === (sel.verb as { hand: number }).hand)?.t ?? '';
    title = t('table.loneQ', { word });
    sub = drawOk ? t('table.loneSub') : t('table.loneNone');
    actions.push(cancel);
    actions.push(
      <button class="ba-btn ba-btn-primary" disabled={!drawOk} {...press(() => c.layAlone(), () => c.startLone())} key="lone">
        {t('table.layAlone')} <span class="ba-cost">· {t('table.draw2')}</span>
      </button>,
    );
  } else if (hasMeaning(sel) && canAct) {
    title = t('table.pickVerb');
    const makes = [...new Set(c.ways.value.map((w) => w.c))].map((id) => compoundText(COMPOUND_BY_ID[id]) + ' (' + COMPOUND_BY_ID[id].g.toLowerCase() + ')');
    sub = c.hintVerb.value
      ? t('table.hintSub')
      : makes.length && makes.length <= 3
        ? t('table.litMakes', { list: makes.join(', ') })
        : sel.onto
          ? t('table.pickVerbOnto')
          : s.config.rules?.freshLineDraw
            ? t('table.pickVerbFresh')
            : t('table.pickVerbSub');
    if (hintsOn && !c.hintVerb.value && sel.meaning !== undefined)
      actions.push(
        <button class="ba-btn ba-btn-secondary btn-hint" onClick={() => c.hint()} key="hint" aria-label={t('table.hint')}>
          <IconHint size={20} /> {t('table.hint')}
        </button>,
      );
    actions.push(cancel);
  } else if ((sel.verb || sel.river.length || sel.cross || sel.wild.length) && canAct) {
    title = t('table.pickMeaning');
    const word = sel.verb && 'table' in sel.verb ? s.board.find((b) => b.x === (sel.verb as any).table.x && b.y === (sel.verb as any).table.y)?.t : sel.river.length ? s.piles[sel.river[0]].at(-1)?.t : '';
    sub = t('table.pickMeaningSub', { word: word ?? '' });
    actions.push(cancel);
  } else {
    if (stuck) sub = t('table.stuckOn');
    if (c.race) {
      actions.push(stuckBtn);
    } else actions.push(passBtn);
  }

  return (
    <div class="tray-head">
      <div class="th-text">
        <div class="th-title">{title}</div>
        {sub && <div class="th-sub">{sub}</div>}
      </div>
      <div class="th-actions">{actions}</div>
    </div>
  );
}

function LockRing({ c }: { c: Controller }) {
  const left = Math.max(0, c.lockUntil.value - c.now.value);
  return <span class="ba-ring" style={{ '--left': `${(left / 3000) * 100}%` } as JSX.CSSProperties} aria-hidden="true" />;
}

function Choices({ c }: { c: Controller }) {
  const choices = c.choices.value;
  if (choices.length < 2 || !c.canAct.value) return null;
  return (
    <div class="choices">
      {choices.map((cid) => (
        <button class="choice" key={cid} onClick={() => c.chooseCompound(cid)}>
          <span class="ch-ga">{compoundText(COMPOUND_BY_ID[cid])}</span>
          <span class="ch-en">{c.lineDescription(cid)}</span>
        </button>
      ))}
    </div>
  );
}

function Tray({ c }: { c: Controller }) {
  const s = c.gs.value;
  const viewer = c.viewer.value;
  const hand = s.hands[viewer];
  const sel = c.sel.value;
  const lit = c.lit.value;
  const hv = c.hintVerb.value;
  const shake = c.shake.value;
  const picks = c.picks.value;
  const hidden = c.hidden;
  const selActive = !hidden && !selEmpty(sel);
  const meanings = hand.filter((x) => x.k === 'M');
  const others = hand.filter((x) => x.k !== 'M');
  const shaking = (key: string) => !!shake && shake.key === key && Date.now() - shake.at < 400;
  const stOf = (card: Card) => {
    if (card.k === 'M') {
      const selected = sel.meaning === card.id;
      const isLit = !!lit?.meanings.has(card.id);
      return { selected, lit: isLit, dim: selActive && !selected && !isLit, shake: shaking('m:' + card.id) };
    }
    if (card.k === 'V') {
      const selected = !!sel.verb && 'hand' in sel.verb && sel.verb.hand === card.id;
      const isLit = !!lit?.handVerbs.has(card.id) || (!!hv && 'hand' in hv && hv.hand === card.id);
      return { selected, lit: isLit && !selected, dim: selActive && !selected && !isLit, shake: shaking('v:' + card.id) };
    }
    const selected = hidden ? picks.some((p) => 'wild' in p && p.wild === card.id) : sel.wild.includes(card.id);
    const isLit = !!lit?.wild.has(card.id);
    return { selected, lit: isLit && !selected, dim: selActive && !selected && !isLit, shake: shaking('w:' + card.id) };
  };
  const showLine = hidden && (hasMeaning(sel) || !!sel.verb || picks.length > 0);
  return (
    <div class="tray ba-tray">
      <Header c={c} />
      {showLine && <YourLine c={c} />}
      <Choices c={c} />
      <div class="lane lane-m">
        <FaceUp c={c} />
        <div class="lane-scroll">
          {meanings.map((m) => (
            <TrayCard key={m.id} c={c} card={m} st={stOf(m)} />
          ))}
        </div>
      </div>
      <div class="lane lane-v">
        <div class="lane-scroll">
          {others.map((v) => (
            <TrayCard key={v.id} c={c} card={v} st={stOf(v)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HandOver({ c }: { c: Controller }) {
  const s = c.gs.value;
  const p = c.viewer.value;
  const pl = s.config.players[p];
  const prevHuman = c.humans().filter((h) => h !== p);
  const lastTurnHuman = [...s.log].reverse().find((e) => (e.e === 'line' || e.e === 'pass' || e.e === 'lone' || e.e === 'swap' || e.e === 'wrong') && c.isHuman(e.p)) as { p: number } | undefined;
  const prev = lastTurnHuman && lastTurnHuman.p !== p ? c.name(lastTurnHuman.p) : prevHuman.length && s.log.length ? null : null;
  return (
    <div class={'tray ba-tray handover ba-p' + (pl.color + 1)}>
      <Disc player={pl.color} initial={initialOf(pl.name)} size={76} />
      <h2 class="ho-title">{t('hand.passTo', { name: pl.name })}</h2>
      <p class="ho-sub">{prev ? t('hand.lookAway', { prev, name: pl.name }) : t('hand.lookAwayFirst', { name: pl.name })}</p>
      <button class="ba-btn ba-btn-primary ho-btn" onClick={() => c.showHand()}>
        {t('hand.show')}
      </button>
    </div>
  );
}

// ---------- overlays ----------

function Toasts({ c }: { c: Controller }) {
  const list = c.toasts.value;
  return (
    <div class="toasts" aria-live="polite">
      {list.map((x) => {
        if (x.kind === 'made')
          return (
            <div class="ba-toast toast-in" key={x.id}>
              {c.critter(x.player ?? 0) ? (
                <Critter species={c.critter(x.player ?? 0)!.species} mood="pleased" size={34} />
              ) : (
                <span class={'ba-dot ba-p' + ((c.gs.value.config.players[x.player ?? 0]?.color ?? 0) + 1)} />
              )}
              <div>
                <div class="ba-ga">{x.ga}</div>
                <div class="ba-en">{x.en}</div>
              </div>
            </div>
          );
        const Icon = x.icon === 'taken' ? IconTaken : x.icon === 'retry' ? IconNotQuite : x.icon === 'turns' ? IconRiverTurns : IconRefused;
        return (
          <div class={'ba-toast toast-in ' + (x.kind === 'soft' ? 'ba-toast-soft' : x.kind === 'alert' ? 'ba-toast-alert' : 'ba-toast-quiet')} key={x.id}>
            <span class="toast-ico">
              <Icon size={22} />
            </span>
            <div>
              <div class="ba-msg">{x.msg}</div>
              {x.sub && <div class="ba-en">{x.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A meaning card on the table, opened up: all three meanings (and their Irish, if answers are shown). */
function MeaningPeek({ c }: { c: Controller }) {
  const pk = c.peek.value;
  const s = c.gs.value;
  if (!pk) return null;
  const card = s.board.find((b) => b.x === pk.x && b.y === pk.y);
  if (!card || card.k !== 'M') return null;
  const usable = !!s.config.rules?.tableMeanings;
  // Sit on the other half of the board from the card, so it never covers what you tapped.
  const cell = document.querySelector(`[data-cell="${pk.x},${pk.y}"]`)?.getBoundingClientRect();
  const board = document.querySelector('.table-board')?.getBoundingClientRect();
  const low = !!cell && !!board && cell.top + cell.height / 2 < board.top + board.height / 2;
  return (
    <div class={'peek' + (low ? ' is-low' : '')} role="status" onClick={() => (c.peek.value = null)}>
      <div class="peek-label">{usable ? t('table.peekUsable') : t('table.peek')}</div>
      <MeaningCard card={card} hidden={c.hidden} used={card.used} alts />
    </div>
  );
}

/** A meaning card someone else just put down, in full view for a moment: new options on the table. */
function NewMeaning({ c }: { c: Controller }) {
  const sh = c.shown.value;
  const s = c.gs.value;
  if (!sh || c.peek.value || c.made.value) return null;
  const card = s.board.find((b) => b.id === sh.id);
  if (!card) return null;
  const cell = document.querySelector(`[data-cell="${sh.x},${sh.y}"]`)?.getBoundingClientRect();
  const board = document.querySelector('.table-board')?.getBoundingClientRect();
  const low = !!cell && !!board && cell.top + cell.height / 2 < board.top + board.height / 2;
  const by = sh.by >= 0 ? s.config.players[sh.by] : undefined;
  return (
    <div class={'peek is-new' + (low ? ' is-low' : '')} key={sh.id} aria-live="polite">
      <div class="peek-label">
        {by && (c.critter(sh.by) ? <Critter species={c.critter(sh.by)!.species} size={24} /> : <span class={'ba-dot dot-sm ba-p' + (by.color + 1)} aria-hidden="true" />)}
        {t('table.newOnTable', { name: c.name(sh.by) })}
      </div>
      <MeaningCard card={card} hidden={c.hidden} used={card.used} alts />
      <div class="peek-timer" aria-hidden="true" />
    </div>
  );
}

function MadeMoment({ c }: { c: Controller }) {
  const m = c.made.value;
  if (!m) return null;
  return (
    <div class="made-wrap" onPointerDown={() => c.dismissMade()}>
      <div class="ba-made made-pop" role="status">
        {m.isNew && <span class="ba-new">{t('table.new')}</span>}
        <span class="ba-ga">{m.compound}</span>
        <span class="ba-en">{m.meaning}</span>
        {m.isNew && <span class="ba-progress">{t('table.made', { n: m.count, total: COMPOUNDS.length })}</span>}
      </div>
    </div>
  );
}

export function Standings({ c, lines }: { c: Controller; lines?: boolean }) {
  const s = c.gs.value;
  const o = s.over!;
  const order = s.config.players.map((_, i) => i).sort((a, b) => s.hands[a].length - s.hands[b].length);
  return (
    <div class="standings">
      {order.map((i) => {
        const pl = s.config.players[i];
        const n = s.hands[i].length;
        const nl = s.lines.filter((l) => l.p === i).length;
        return (
          <div class="stand-row" key={i}>
            <Disc player={pl.color} initial={initialOf(c.name(i))} size={40} critter={c.critter(i)} />
            <span class="sr-name">{c.name(i)}</span>
            <span class="sr-n tabnum">{n === 1 ? t('table.oneCard') : t('table.cards', { n })}</span>
            {lines && <span class="sr-n tabnum">{nl === 1 ? t('recap.oneLine') : t('recap.lines', { n: nl })}</span>}
            {!lines && o.winners.includes(i) && <span class="win-badge">{t('end.wins')}</span>}
          </div>
        );
      })}
    </div>
  );
}

function EndCard({ c, onRecap }: { c: Controller; onRecap: () => void }) {
  const s = c.gs.value;
  const o = s.over;
  if (!o) return null;
  const w = o.winners[0];
  const humanSolo = !c.passAndPlay && c.isHuman(w);
  let eyebrow: string, title: string, sub: string;
  if (o.how === 'out') {
    eyebrow = t('end.over');
    title = humanSolo ? t('end.youOut') : t('end.theyOut', { name: c.name(w) });
    const others = s.config.players.map((_, i) => i).filter((i) => i !== w);
    sub = humanSolo && others.length === 1 ? t('end.youOutSub', { name: c.name(others[0]), n: s.hands[others[0]].length }) : t('end.theyOutSub', { name: c.name(w) });
  } else {
    eyebrow = t('end.noMore');
    title = o.tie ? t('end.shared') : t('end.fewest');
    sub = t('end.fewestSub', { n: s.stalls });
  }
  return (
    <div class="end-scrim">
      <div class="end-card" role="dialog" aria-modal="true" aria-label={title}>
        <div class="eyebrow">{eyebrow}</div>
        <h2 class="end-title">{title}</h2>
        <p class="end-sub">{sub}</p>
        <Standings c={c} />
        <button class="ba-btn ba-btn-primary wide" onClick={onRecap}>
          {t('end.seeRecap')}
        </button>
        <button class="ba-btn ba-btn-quiet wide" onClick={() => c.lookAtBoard()}>
          {t('end.lookBoard')}
        </button>
      </div>
    </div>
  );
}

function PauseSheet({ c, onRules, onSettings, onRestart, onQuit }: { c: Controller; onRules: () => void; onSettings: () => void; onRestart: () => void; onQuit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const open = c.paused.value;
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) {
      setConfirm(false);
      return;
    }
    return pushBackHandler(() => {
      // Only while the table is the top screen: not while Rules or Settings slide in over it.
      if (nav.top?.id !== 'table') return false;
      c.pause(false);
      return true;
    });
  }, [open]);
  if (!open) return null;
  const cfg = c.config;
  const who = cfg.players
    .map((p, i) => (p.kind === 'bot' ? c.name(i) : ''))
    .filter(Boolean)
    .join(', ');
  const summary = [
    c.passAndPlay ? t('home.passPlay', { who: cfg.players.map((_, i) => c.name(i)).join(', ') }) : t('home.vsBots', { mode: cfg.mode === 'race' ? t('home.race') : t('home.turns'), who }),
    cfg.answers === 'shown' ? t('pause.answersShown') : t('pause.answersHidden'),
    cfg.hints === 'off' ? t('pause.hintsOff') : cfg.hints === 'request' ? t('pause.hintsRequest') : t('pause.hintsAuto'),
  ].join(' · ');
  return (
    <div class="sheet-wrap" onPointerDown={(e) => e.target === e.currentTarget && c.pause(false)}>
      <div class="ba-scrim scrim-in" aria-hidden="true" />
      <div class="ba-sheet sheet sheet-in" ref={sheet} role="dialog" aria-modal="true" aria-label={t('pause.title')}>
        <div class="grabber" aria-hidden="true" />
        <h2 class="sheet-title">{t('pause.title')}</h2>
        <p class="sheet-sub">{summary}</p>
        {confirm ? (
          <>
            <p class="confirm-q">{t('pause.restartQ')}</p>
            <button class="ba-btn ba-btn-primary wide" onClick={onRestart}>
              {t('pause.restartYes')}
            </button>
            <button class="ba-btn ba-btn-secondary wide" onClick={() => setConfirm(false)}>
              {t('pause.keep')}
            </button>
          </>
        ) : (
          <>
            <button class="ba-btn ba-btn-primary wide" onClick={() => c.pause(false)} autoFocus>
              {t('pause.resume')}
            </button>
            <button class="ba-btn ba-btn-secondary wide" onClick={onRules}>
              {t('pause.rules')}
            </button>
            <button class="ba-btn ba-btn-secondary wide" onClick={onSettings}>
              {t('pause.settings')}
            </button>
            <div class="row2">
              <button class="ba-btn ba-btn-secondary" onClick={() => setConfirm(true)}>
                {t('pause.restart')}
              </button>
              <button class="ba-btn ba-btn-secondary" onClick={onQuit}>
                {t('pause.quit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export interface TableProps {
  c: Controller;
  onRecap: () => void;
  onRules: () => void;
  onSettings: () => void;
  onRestart: () => void;
  onQuit: () => void;
  children?: JSX.Element | null;
}

export function TableView(p: TableProps) {
  const c = p.c;
  // Hardware back on the table opens the pause menu, as in a native game; back again resumes.
  useEffect(
    () =>
      pushBackHandler(() => {
        if (nav.top?.id !== 'table' || c.phase.value === 'over' || c.phase.value === 'board') return false;
        if (c.made.value) c.dismissMade();
        // Toggle here rather than relying on the sheet's own handler, which registers a frame
        // after it opens: a quick second back press must still resume.
        c.pause(!c.paused.value);
        return true;
      }),
    [c],
  );
  const phase = c.phase.value;
  const s = c.gs.value;
  const announce = c.announce.value;
  return (
    <div class={'table ba-felt' + (phase === 'over' ? ' is-over' : '') + (c.paused.value ? ' is-paused' : '')} onPointerDownCapture={() => {
        if (c.made.value) c.dismissMade();
        // Any tap clears an opponent's pop-up card and still reaches what's underneath.
        if (c.shown.value) c.dismissShown();
      }}>
      <div class="table-top">
        <Status c={c} />
        <River c={c} />
      </div>
      <div class="table-board">
        <Board c={c} />
        <MeaningPeek c={c} />
        <NewMeaning c={c} />
        <Toasts c={c} />
        <MadeMoment c={c} />
      </div>
      {phase === 'handover' ? <HandOver c={c} /> : phase === 'board' ? (
        <div class="tray ba-tray board-bar">
          <button class="ba-btn ba-btn-primary wide" onClick={p.onRecap}>
            {t('end.seeRecap')}
          </button>
        </div>
      ) : (
        <Tray c={c} />
      )}
      {phase === 'over' && s.over && <EndCard c={c} onRecap={p.onRecap} />}
      <PauseSheet c={c} onRules={p.onRules} onSettings={p.onSettings} onRestart={p.onRestart} onQuit={p.onQuit} />
      {p.children}
      <div class="sr-only" aria-live="assertive">
        {announce}
      </div>
    </div>
  );
}

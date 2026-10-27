// The scripted first game: nine steps against one bot, with a spotlight on the part being taught.
// Steps 1–6 are played; 7–9 point at swapping, wildcards and the other ways to make a line.
// The spotlit zone stays tappable; everything else is blocked until the step is done or skipped.
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { meaningsOf } from '../engine/game';
import { APP_RULES, type GameConfig } from '../engine/types';
import type { Controller } from '../game/controller';
import { t, type Key } from '../i18n';
import { updateSettings } from '../storage';
import { nav } from './nav';

/** Seed 9928 deals DESCRIBE / GIVE UP / STAY AWAY FROM and a wildcard to you, cuir on the table and síos, ar on the
 *  river (app deck with the draft verbs; a deck change moves every deal, so recheck it then). */
export const TUTORIAL_SEED = 9928;

export function tutorialConfig(): GameConfig {
  return {
    seed: TUTORIAL_SEED,
    mode: 'turns',
    answers: 'shown',
    hints: 'request',
    firstPlayer: 0,
    tutorial: true,
    rules: APP_RULES,
    players: [
      { name: t('table.you'), kind: 'human', color: 0 },
      { name: 'B', kind: 'bot', level: 'easy', color: 1 },
    ],
  };
}

const TOTAL = 9;
const DONE = TOTAL + 1;

export function Tutorial({ c }: { c: Controller }) {
  const [step, setStep] = useState(1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const s0 = c.gs.value;
  const describe = s0.hands[0].find((x) => x.k === 'M' && meaningsOf(x).includes('DESCRIBE'));
  const siosPile = s0.piles.findIndex((p) => p.length && p[p.length - 1].t === 'síos');
  const cuir = s0.board.find((b) => b.k === 'V' && b.t === 'cuir');

  useEffect(() => {
    if (step > DONE) {
      c.tutorialHook = null;
      return;
    }
    c.tutorialHook = (ev, data) => {
      if (ev === 'botTurn') return step >= 5;
      if (ev === 'commit') {
        const d = data as { p: number };
        if (step === 3 && d.p === 0) setStep(4);
        else if (step === 5 && d.p === 1) setStep(6);
        else if (step === 6 && d.p === 0) setStep(7);
        return;
      }
      if (ev === 'afterPick' || ev === 'play') return step === 3 || step === 6 || step > TOTAL;
      if (step === 1) return ev === 'tapMeaning' && data === describe?.id;
      if (step === 2) return ev === 'tapRiver' && data === siosPile;
      if (step === 3) return ev === 'tapTable' && !!cuir && (data as { x: number; y: number }).x === cuir.x && (data as { x: number; y: number }).y === cuir.y;
      if (step === 6) return ev === 'pass';
      if (step === 4 || step === 5) return false;
      return true;
    };
    return () => {
      c.tutorialHook = null;
    };
  }, [step]);

  // Advance when the player does the thing.
  const sel = c.sel.value;
  useEffect(() => {
    if (step === 1 && sel.meaning === describe?.id) setStep(2);
    if (step === 2 && sel.river.includes(siosPile)) setStep(3);
  }, [sel, step]);

  const target = (): Element | null => {
    if (step === 1) return document.querySelector(`.tray [data-card="${describe?.id}"]`);
    if (step === 2) return document.querySelector(`[data-pile="${siosPile}"]`)?.closest('.ba-pile') ?? null;
    if (step === 3) return cuir ? document.querySelector(`[data-cell="${cuir.x},${cuir.y}"] .ba-card`) : null;
    if (step === 4) return document.querySelector('.table-board');
    if (step === 5) return document.querySelector('.status');
    if (step === 6) return document.querySelector('.tray-head .th-actions');
    if (step === 7) return document.querySelector('.faceup');
    if (step === 8) {
      const w = c.gs.value.hands[0].find((x) => x.k === 'W');
      return (w && document.querySelector(`.tray [data-card="${w.id}"]`)) || document.querySelector('.tray');
    }
    if (step === 9) {
      // The meaning card the player laid in step 3: the thing a later line can end on.
      const m = c.gs.value.board.find((b) => b.k === 'M' && b.owner === 0) ?? c.gs.value.board.find((b) => b.k === 'M');
      return (m && document.querySelector(`[data-cell="${m.x},${m.y}"] .ba-card`)) || document.querySelector('.table-board');
    }
    return null;
  };
  useEffect(() => {
    if (step === 3 && cuir) c.reveal.value = { cells: [[cuir.x, cuir.y]], seq: Date.now() };
  }, [step]);

  useLayoutEffect(() => {
    let raf = 0;
    // Bring the target into view first (a hand card may be scrolled off the lane).
    const el = target();
    if (el?.closest('.lane-scroll')) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' as ScrollBehavior });
    const measure = () => {
      const el = target();
      const r = el?.getBoundingClientRect() ?? null;
      setRect((old) => (old && r && old.x === r.x && old.y === r.y && old.width === r.width && old.height === r.height ? old : r));
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  const skip = () => {
    c.tutorialHook = null;
    updateSettings({ tutorialDone: true });
    nav.backTo('home');
  };
  const next = () => {
    if (step === 4) {
      setStep(5);
      c.resume();
    } else if (step === 5) return;
    else if (step === DONE) {
      setStep(DONE + 1);
      updateSettings({ tutorialDone: true });
      c.resume();
    } else setStep(step + 1);
  };

  if (step > DONE) return null;
  const done = step === DONE;
  // The tutorial's opponent is player 1: its name now comes from its character (Broc, …).
  const names = { name: c.name(1) };
  const key = (k: string) => (done ? `tut.end.${k}` : `tut.${step}.${k}`) as Key;
  const W = typeof window !== 'undefined' ? window.innerWidth : 390;
  const H = typeof window !== 'undefined' ? window.innerHeight : 844;
  const pad = 8;
  const hole = rect && !done ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null;
  const below = !hole || hole.y + hole.h / 2 < H / 2;
  // A spotlight too big to fit the card beside it (the whole board) gets the card centred over it.
  const cardStyle = hole && hole.h < H * 0.45 ? (below ? { top: Math.min(H - 260, hole.y + hole.h + 14) } : { bottom: Math.max(16, H - hole.y + 14) }) : { top: H / 2 - 120 };
  // Steps where the player acts: the hole is open; info steps block the whole table.
  const acting = step === 1 || step === 2 || step === 3 || step === 6;
  return (
    <div class="tut" role="dialog" aria-live="polite" aria-label={t(key('title'), names)}>
      {hole ? (
        <>
          <div class="tut-block" style={{ left: 0, top: 0, width: W, height: Math.max(0, hole.y) }} />
          <div class="tut-block" style={{ left: 0, top: hole.y + hole.h, width: W, height: Math.max(0, H - hole.y - hole.h) }} />
          <div class="tut-block" style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
          <div class="tut-block" style={{ left: hole.x + hole.w, top: hole.y, width: Math.max(0, W - hole.x - hole.w), height: hole.h }} />
          <div class={'tut-hole' + (acting ? '' : ' is-info')} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
        </>
      ) : (
        <div class="tut-block" style={{ inset: 0 }} />
      )}
      <div class="tut-card" style={cardStyle}>
        {!done && <div class="eyebrow">{t('tut.step', { n: step, total: TOTAL })}</div>}
        <h2 class="tut-title">{t(key('title'), names)}</h2>
        <p class="body">{t(key('body'), names)}</p>
        <div class="tut-actions">
          {!done && (
            <button class="ba-btn ba-btn-quiet" onClick={skip}>
              {t('tut.skip')}
            </button>
          )}
          {step !== 5 && (step === 4 || done || !acting) && (
            <button class="ba-btn ba-btn-primary" onClick={next}>
              {done ? t('tut.done') : t('tut.next')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

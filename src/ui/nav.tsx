// A native-style navigation stack: push/pop slides, a crossfade for resets, the Android back
// button and an interactive edge swipe back. Screens stay mounted only while they are visible.
import { signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { reducedMotion } from './motion';

export type ScreenId = 'language' | 'welcome' | 'home' | 'setup' | 'table' | 'recap' | 'glossary' | 'rules' | 'settings' | 'decks' | 'deckEdit';

export interface Entry {
  id: ScreenId;
  key: number;
  params?: Record<string, unknown>;
}

type Kind = 'push' | 'pop' | 'fade';
interface Transition {
  kind: Kind;
  from: Entry;
  to: Entry;
}

let nextKey = 1;
export const stack = signal<Entry[]>([]);
const transition = signal<Transition | null>(null);

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const DUR = 380;

/** Back handlers, innermost last: sheets and overlays register while open. */
const backHandlers: (() => boolean)[] = [];

export function pushBackHandler(fn: () => boolean): () => void {
  backHandlers.push(fn);
  return () => {
    const i = backHandlers.lastIndexOf(fn);
    if (i >= 0) backHandlers.splice(i, 1);
  };
}

function top(): Entry | undefined {
  return stack.value[stack.value.length - 1];
}

function begin(kind: Kind, next: Entry[]) {
  const from = top();
  stack.value = next;
  const to = top()!;
  if (from && from.key !== to.key) transition.value = { kind: reducedMotion() ? 'fade' : kind, from, to };
  ensureTrap();
}

export const nav = {
  push(id: ScreenId, params?: Record<string, unknown>) {
    if (transition.value) finishNow();
    begin('push', [...stack.value, { id, key: nextKey++, params }]);
  },
  replace(id: ScreenId, params?: Record<string, unknown>) {
    if (transition.value) finishNow();
    begin('fade', [...stack.value.slice(0, -1), { id, key: nextKey++, params }]);
  },
  reset(entries: { id: ScreenId; params?: Record<string, unknown> }[], kind: Kind = 'fade') {
    if (transition.value) finishNow();
    begin(kind, entries.map((e) => ({ ...e, key: nextKey++ })));
  },
  /** UI back: closes the innermost overlay, else pops a screen. Returns false at the root. */
  back(): boolean {
    for (let i = backHandlers.length - 1; i >= 0; i--) if (backHandlers[i]()) return true;
    if (stack.value.length <= 1) return false;
    if (transition.value) finishNow();
    begin('pop', stack.value.slice(0, -1));
    return true;
  },
  /** Pop back to the nearest screen with this id (or reset to it). */
  backTo(id: ScreenId, params?: Record<string, unknown>) {
    const i = stack.value.map((e) => e.id).lastIndexOf(id);
    if (transition.value) finishNow();
    if (i >= 0) begin('pop', [...stack.value.slice(0, i), params ? { ...stack.value[i], params } : stack.value[i]]);
    else begin('pop', [{ id, key: nextKey++, params }]);
  },
  get top() {
    return top();
  },
};

let finishCb: (() => void) | null = null;
function finishNow() {
  finishCb?.();
  finishCb = null;
  transition.value = null;
}

// ---------- the hardware back button / browser history ----------
// One "trap" entry sits on top of the history. Back pops it; we handle back ourselves and put it
// back. At the root with nothing to close we leave it popped, so the next back leaves the app.
let trapped = false;
function ensureTrap() {
  if (typeof history === 'undefined' || trapped) return;
  history.pushState({ ba: 'trap' }, '');
  trapped = true;
}
if (typeof window !== 'undefined') {
  history.replaceState({ ba: 'root' }, '');
  window.addEventListener('popstate', () => {
    trapped = false;
    if (nav.back() || stack.value.length > 1) ensureTrap();
  });
}

// ---------- rendering ----------

function ScreenLayer({ entry, render, layerRef, under }: { entry: Entry; render: (e: Entry) => ComponentChildren; layerRef?: (el: HTMLDivElement | null) => void; under?: boolean }) {
  return (
    <div class={'nav-layer' + (under ? ' is-under' : '')} ref={layerRef} data-screen={entry.id} aria-hidden={under ? 'true' : undefined} inert={under || undefined}>
      {render(entry)}
    </div>
  );
}

export function Navigator({ render, swipeBack }: { render: (e: Entry) => ComponentChildren; swipeBack: (e: Entry) => boolean }) {
  const s = stack.value;
  const tr = transition.value;
  const cur = s[s.length - 1];
  const fromRef = useRef<HTMLDivElement | null>(null);
  const toRef = useRef<HTMLDivElement | null>(null);
  const swipe = useRef<{ x0: number; t0: number; id: number; dx: number; v: number; lastX: number; lastT: number; w: number; active: boolean } | null>(null);
  const underRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const dimRef = useRef<HTMLDivElement | null>(null);
  const swiping = signalSwiping.value;

  useLayoutEffect(() => {
    if (!tr) return;
    const a = fromRef.current,
      b = toRef.current;
    if (!a || !b) {
      transition.value = null;
      return;
    }
    const anims: Animation[] = [];
    const opts: KeyframeAnimationOptions = { duration: DUR, easing: EASE, fill: 'both' };
    const dim = dimRef.current;
    // Only transform and opacity animate, so the slide runs on the compositor (iOS can't composite a
    // filter, and repainting a whole screen every frame is what made it feel sticky).
    if (tr.kind === 'fade') {
      anims.push(b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'both' }));
      anims.push(a.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 220, fill: 'both' }));
    } else if (tr.kind === 'push') {
      anims.push(b.animate([{ transform: 'translate3d(100%,0,0)' }, { transform: 'translate3d(0,0,0)' }], opts));
      anims.push(a.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-28%,0,0)' }], opts));
      if (dim) anims.push(dim.animate([{ opacity: 0 }, { opacity: 1 }], opts));
    } else {
      anims.push(a.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(100%,0,0)' }], opts));
      anims.push(b.animate([{ transform: 'translate3d(-28%,0,0)' }, { transform: 'translate3d(0,0,0)' }], opts));
      if (dim) anims.push(dim.animate([{ opacity: 1 }, { opacity: 0 }], opts));
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      anims.forEach((x) => x.cancel());
      if (transition.value === tr) transition.value = null;
    };
    finishCb = finish;
    void Promise.all(anims.map((x) => x.finished)).then(finish, finish);
    return () => anims.forEach((x) => x.cancel());
  }, [tr]);

  // Interactive swipe back from the left edge.
  const onPointerDown = (e: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (tr || s.length < 2 || e.pointerType === 'mouse' || reducedMotion()) return;
    swipe.current = { x0: e.clientX, t0: e.timeStamp, id: e.pointerId, dx: 0, v: 0, lastX: e.clientX, lastT: e.timeStamp, w: window.innerWidth, active: false };
  };
  const onPointerMove = (e: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    const sw = swipe.current;
    if (!sw || e.pointerId !== sw.id) return;
    const dx = Math.max(0, e.clientX - sw.x0);
    if (!sw.active) {
      if (dx < 8) return;
      sw.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      signalSwiping.value = true;
    }
    const dt = Math.max(1, e.timeStamp - sw.lastT);
    sw.v = (e.clientX - sw.lastX) / dt;
    sw.lastX = e.clientX;
    sw.lastT = e.timeStamp;
    sw.dx = dx;
    const p = Math.min(1, dx / sw.w);
    if (topRef.current) topRef.current.style.transform = `translate3d(${dx}px,0,0)`;
    if (underRef.current) underRef.current.style.transform = `translate3d(${-28 * (1 - p)}%,0,0)`;
    if (dimRef.current) dimRef.current.style.opacity = String(1 - p);
  };
  const onPointerUp = (e: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    const sw = swipe.current;
    swipe.current = null;
    if (!sw || e.pointerId !== sw.id) return;
    if (!sw.active) {
      // A tap on the edge strip: pass it to whatever is underneath.
      const strip = e.currentTarget as HTMLElement;
      strip.style.pointerEvents = 'none';
      const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      strip.style.pointerEvents = '';
      if (e.type === 'pointerup') under?.click();
      return;
    }
    const complete = sw.dx > sw.w * 0.35 || sw.v > 0.45;
    const t = topRef.current,
      u = underRef.current,
      d = dimRef.current;
    const rem = complete ? sw.w - sw.dx : sw.dx;
    const dur = Math.max(120, Math.min(320, rem / Math.max(0.6, Math.abs(sw.v))));
    const opts: KeyframeAnimationOptions = { duration: dur, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' };
    const p0 = sw.dx / sw.w;
    const anims: Animation[] = [];
    if (t) anims.push(t.animate([{ transform: `translate3d(${sw.dx}px,0,0)` }, { transform: complete ? 'translate3d(100%,0,0)' : 'translate3d(0,0,0)' }], opts));
    if (u) anims.push(u.animate([{ transform: `translate3d(${-28 * (1 - p0)}%,0,0)` }, { transform: complete ? 'translate3d(0,0,0)' : 'translate3d(-28%,0,0)' }], opts));
    if (d) anims.push(d.animate([{ opacity: 1 - p0 }, { opacity: complete ? 0 : 1 }], opts));
    void Promise.all(anims.map((a) => a.finished)).then(() => {
      if (complete) {
        stack.value = stack.value.slice(0, -1);
        ensureTrap();
      }
      signalSwiping.value = false;
      requestAnimationFrame(() => {
        anims.forEach((a) => a.cancel());
        for (const el of [t, u]) if (el) el.style.transform = '';
        if (d) d.style.opacity = '';
      });
    });
  };

  if (!cur) return null;
  const layers: JSX.Element[] = [];
  if (tr) {
    const below = tr.kind === 'pop' ? tr.to : tr.from;
    const above = tr.kind === 'pop' ? tr.from : tr.to;
    const belowRef = tr.kind === 'pop' ? toRef : fromRef;
    const aboveRef = tr.kind === 'pop' ? fromRef : toRef;
    layers.push(<ScreenLayer key={below.key} entry={below} render={render} layerRef={(el) => (belowRef.current = el)} under={below.key !== cur.key} />);
    if (tr.kind !== 'fade') layers.push(<div key="dim" class="nav-dim" ref={dimRef} aria-hidden="true" />);
    layers.push(<ScreenLayer key={above.key} entry={above} render={render} layerRef={(el) => (aboveRef.current = el)} under={above.key !== cur.key} />);
  } else {
    if (swiping && s.length > 1) {
      const prev = s[s.length - 2];
      layers.push(<ScreenLayer key={prev.key} entry={prev} render={render} layerRef={(el) => (underRef.current = el)} under />);
      layers.push(<div key="dim" class="nav-dim" ref={dimRef} aria-hidden="true" />);
    }
    layers.push(<ScreenLayer key={cur.key} entry={cur} render={render} layerRef={(el) => (topRef.current = el)} />);
  }
  const edge = !tr && s.length > 1 && swipeBack(cur);
  return (
    <div class="nav-root">
      {layers}
      {edge && <div class="nav-edge" aria-hidden="true" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />}
    </div>
  );
}

const signalSwiping = signal(false);

// The board: an unbounded grid of cards on the felt. Pan, pinch-zoom with momentum, double-tap
// to fit, taps that snap to the nearest valid target, card flights and auto-follow.
// The camera lives outside Preact: gestures write the transform directly in rAF, so a pan or
// pinch never waits on a render.
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { COMPOUND_BY_ID, compoundText } from '../engine/deck';
import { view } from '../engine/game';
import type { Placed } from '../engine/types';
import { selEmpty, type Controller } from '../game/controller';
import { t } from '../i18n';
import { Face, cardLabel, meaningLabel } from './cards';
import { meaningUses } from './meaningUses';
import { IconFit } from './icons';
import { reducedMotion } from './motion';

export const PITCH = 66;
const CARD = 64;
/** A height change smaller than this (the tray's prompt wrapping) never re-fits or moves the board. */
const MINOR_RESIZE = 80;
const Z_MIN = 26 / CARD;
const Z_MAX = 96 / CARD;
const GLYPH_BELOW = 32 / CARD;
/** The opening view keeps words readable even if that leaves a starter verb off screen. */
const OPEN_MIN = 40 / CARD;
const LONG_PRESS = 430;
const SLOP = 8;

interface Cam {
  x: number;
  y: number;
  z: number;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function Board({ c }: { c: Controller }) {
  const s = c.gs.value;
  const vp = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const cam = useRef<Cam>({ x: 0, y: 0, z: 1 });
  const size = useRef({ w: 1, h: 1 });
  const anim = useRef<number>(0);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glyph = useRef(false);
  const ready = useRef(false);
  const touched = useRef(false);

  const lit = c.lit.value;
  const sel = c.sel.value;
  const hintVerb = c.hintVerb.value;
  const spot = c.spot.value;
  const taken = c.taken.value;
  const action = c.action.value;
  const hidden = c.hidden;
  const picks = c.picks.value;

  // ---------- camera ----------
  const applyCam = () => {
    const w = world.current;
    if (!w) return;
    const { x, y, z } = cam.current;
    const { w: vw, h: vh } = size.current;
    w.style.transform = `translate3d(${(vw / 2 - x * z).toFixed(2)}px, ${(vh / 2 - y * z).toFixed(2)}px, 0) scale(${z.toFixed(4)})`;
    const g = z < GLYPH_BELOW;
    if (g !== glyph.current) {
      glyph.current = g;
      vp.current?.classList.toggle('is-glyph', g);
    }
    c.focus = { x: x / PITCH - 0.5, y: y / PITCH - 0.5 };
  };
  const moving = () => {
    world.current?.classList.add('is-moving');
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => world.current?.classList.remove('is-moving'), 160);
  };
  const stopAnim = () => {
    if (anim.current) cancelAnimationFrame(anim.current);
    anim.current = 0;
  };
  const animateTo = (to: Cam, ms = 340) => {
    stopAnim();
    if (reducedMotion()) ms = 0;
    const from = { ...cam.current };
    const t0 = performance.now();
    const step = (now: number) => {
      const k = ms ? Math.min(1, (now - t0) / ms) : 1;
      const e = ease(k);
      cam.current = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z: from.z + (to.z - from.z) * e };
      applyCam();
      moving();
      if (k < 1) anim.current = requestAnimationFrame(step);
      else anim.current = 0;
    };
    anim.current = requestAnimationFrame(step);
  };
  /** Frame a set of cells (world px rect), keeping zoom unless they don't fit. */
  const frame = (cells: [number, number][], opts: { fit?: boolean; ms?: number } = {}) => {
    if (!cells.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of cells) {
      x0 = Math.min(x0, x * PITCH);
      y0 = Math.min(y0, y * PITCH);
      x1 = Math.max(x1, x * PITCH + CARD);
      y1 = Math.max(y1, y * PITCH + CARD);
    }
    const pad = 28;
    const { w: vw, h: vh } = size.current;
    const fitZ = Math.min((vw - pad * 2) / (x1 - x0), (vh - pad * 2) / (y1 - y0));
    let z = cam.current.z;
    if (opts.fit) z = Math.min(1, fitZ);
    else if (fitZ < z) z = fitZ;
    z = Math.max(Z_MIN, Math.min(Z_MAX, z));
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    if (!opts.fit) {
      // Only move as far as needed to bring the cells into view.
      const halfW = (vw / 2 - pad) / z,
        halfH = (vh / 2 - pad) / z;
      let { x, y } = cam.current;
      if (x1 - x0 < halfW * 2) {
        if (x0 < x - halfW) x = x0 + halfW;
        if (x1 > x + halfW) x = x1 - halfW;
      } else x = cx;
      if (y1 - y0 < halfH * 2) {
        if (y0 < y - halfH) y = y0 + halfH;
        if (y1 > y + halfH) y = y1 - halfH;
      } else y = cy;
      animateTo({ x, y, z }, opts.ms);
      return;
    }
    animateTo({ x: cx, y: cy, z }, opts.ms);
  };
  const fitAll = () => {
    touched.current = true;
    frame(c.gs.value.board.map((b) => [b.x, b.y]), { fit: true });
  };

  // Size and the opening view: the area around the latest play at 64px cards.
  useLayoutEffect(() => {
    const el = vp.current!;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const prev = size.current;
      size.current = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
      // The tray grew or shrank by a line or two (a longer prompt): keep the view's top edge where it
      // was and the zoom as it is, so nothing on the table moves. The camera is the view's centre.
      if (ready.current && prev.w === size.current.w && Math.abs(prev.h - size.current.h) < MINOR_RESIZE) {
        cam.current = { ...cam.current, y: cam.current.y + (size.current.h - prev.h) / 2 / cam.current.z };
      }
      // The opening view: 64px cards around the latest play (or the starter verbs). Re-centre on
      // resizes until the player first touches the board.
      else if (!ready.current || !touched.current) {
        ready.current = true;
        const last = [...s.lines].pop();
        const cells = last ? last.cells : s.board.map((b) => [b.x, b.y] as [number, number]);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of cells) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
        const pad = 20;
        const fitZ = Math.min((size.current.w - pad * 2) / ((x1 - x0) * PITCH + CARD), (size.current.h - pad * 2) / ((y1 - y0) * PITCH + CARD));
        cam.current = { x: ((x0 + x1) / 2) * PITCH + CARD / 2, y: ((y0 + y1) / 2) * PITCH + CARD / 2, z: Math.max(OPEN_MIN, Math.min(1, fitZ)) };
      }
      applyCam();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- gestures ----------
  const g = useRef({
    pts: new Map<number, { x: number; y: number }>(),
    mode: 'none' as 'none' | 'tap' | 'pan' | 'pinch',
    start: { x: 0, y: 0 },
    last: { x: 0, y: 0, t: 0 },
    vel: { x: 0, y: 0 },
    pinch0: { d: 1, z: 1, wx: 0, wy: 0 },
    long: null as ReturnType<typeof setTimeout> | null,
    longFired: false,
    mouse: false,
    lastTap: { t: 0, x: 0, y: 0, empty: false },
  });

  const toWorld = (sx: number, sy: number) => {
    const r = vp.current!.getBoundingClientRect();
    const { x, y, z } = cam.current;
    return { x: x + (sx - r.left - size.current.w / 2) / z, y: y + (sy - r.top - size.current.h / 2) / z };
  };

  /** The nearest valid target to a tap: ghost spots, lit cards, then the card under the finger. */
  const hit = (sx: number, sy: number): { kind: 'spot'; i: number } | { kind: 'card'; x: number; y: number } | null => {
    const w = toWorld(sx, sy);
    const z = cam.current.z;
    const radius = Math.max(PITCH * 0.75, 30 / z);
    const near = (cx: number, cy: number) => Math.hypot(w.x - (cx * PITCH + CARD / 2), w.y - (cy * PITCH + CARD / 2));
    const sp = c.spot.value;
    if (sp) {
      let best = -1, bd = Infinity;
      sp.options.forEach((o, i) => {
        const d = near(o.x, o.y);
        if (d < bd) (bd = d), (best = i);
      });
      if (best >= 0 && bd < radius) return { kind: 'spot', i: best };
    }
    const L = c.lit.value;
    const targets: [number, number][] = [];
    if (L) for (const k of L.tableCells) targets.push(k.split(',').map(Number) as [number, number]);
    const hv = c.hintVerb.value;
    if (hv && 'table' in hv) targets.push([hv.table.x, hv.table.y]);
    let best: [number, number] | null = null, bd = Infinity;
    for (const [x, y] of targets) {
      const d = near(x, y);
      if (d < bd) (bd = d), (best = [x, y]);
    }
    if (best && bd < radius) return { kind: 'card', x: best[0], y: best[1] };
    const cx = Math.floor(w.x / PITCH),
      cy = Math.floor(w.y / PITCH);
    const cell = view(c.gs.value).at(cx, cy);
    if (cell && w.x - cx * PITCH <= CARD && w.y - cy * PITCH <= CARD) return { kind: 'card', x: cx, y: cy };
    if (z < GLYPH_BELOW) {
      // zoomed out: the nearest card at all
      let nb: Placed | null = null, nd = Infinity;
      for (const b of c.gs.value.board) {
        const d = near(b.x, b.y);
        if (d < nd) (nd = d), (nb = b);
      }
      if (nb && nd < radius) return { kind: 'card', x: nb.x, y: nb.y };
    }
    return null;
  };

  const onDown = (e: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.board-fit')) return;
    const st = g.current;
    touched.current = true;
    st.mouse = e.pointerType === 'mouse';
    vp.current!.setPointerCapture(e.pointerId);
    st.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopAnim();
    if (st.pts.size === 1) {
      st.mode = 'tap';
      st.start = { x: e.clientX, y: e.clientY };
      st.last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      st.vel = { x: 0, y: 0 };
      st.longFired = false;
      if (st.long) clearTimeout(st.long);
      // Long-press is a touch gesture; a mouse uses right-click (onContextMenu below).
      if (e.pointerType !== 'mouse') st.long = setTimeout(() => {
        if (st.mode !== 'tap') return;
        const h = hit(st.start.x, st.start.y);
        if (h?.kind === 'card') {
          st.longFired = true;
          c.tapTable(h.x, h.y, true);
        }
      }, LONG_PRESS);
    } else if (st.pts.size === 2) {
      if (st.long) clearTimeout(st.long);
      const [a, b] = [...st.pts.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const wm = toWorld(mid.x, mid.y);
      st.mode = 'pinch';
      st.pinch0 = { d: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z: cam.current.z, wx: wm.x, wy: wm.y };
      c.lastUserPan = performance.now();
    }
  };

  const onMove = (e: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    const st = g.current;
    if (!st.pts.has(e.pointerId)) return;
    const prev = st.pts.get(e.pointerId)!;
    st.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (st.mode === 'tap' && Math.hypot(e.clientX - st.start.x, e.clientY - st.start.y) > SLOP) {
      st.mode = 'pan';
      if (st.long) clearTimeout(st.long);
    }
    if (st.mode === 'pan') {
      const { z } = cam.current;
      cam.current.x -= (e.clientX - prev.x) / z;
      cam.current.y -= (e.clientY - prev.y) / z;
      const dt = Math.max(1, e.timeStamp - st.last.t);
      const vx = (e.clientX - st.last.x) / dt,
        vy = (e.clientY - st.last.y) / dt;
      st.vel = { x: st.vel.x * 0.4 + vx * 0.6, y: st.vel.y * 0.4 + vy * 0.6 };
      st.last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      c.lastUserPan = performance.now();
      applyCam();
      moving();
    } else if (st.mode === 'pinch' && st.pts.size >= 2) {
      const [a, b] = [...st.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      let z = st.pinch0.z * (d / st.pinch0.d);
      // rubber band past the limits
      if (z > Z_MAX) z = Z_MAX * Math.pow(z / Z_MAX, 0.3);
      if (z < Z_MIN) z = Z_MIN * Math.pow(z / Z_MIN, 0.3);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const r = vp.current!.getBoundingClientRect();
      cam.current = {
        z,
        x: st.pinch0.wx - (mid.x - r.left - size.current.w / 2) / z,
        y: st.pinch0.wy - (mid.y - r.top - size.current.h / 2) / z,
      };
      c.lastUserPan = performance.now();
      applyCam();
      moving();
    }
  };

  const momentum = (vx: number, vy: number) => {
    if (reducedMotion()) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      const decay = Math.pow(0.995, dt);
      vx *= decay;
      vy *= decay;
      const { z } = cam.current;
      cam.current.x -= (vx * dt) / z;
      cam.current.y -= (vy * dt) / z;
      applyCam();
      moving();
      if (Math.hypot(vx, vy) > 0.02) anim.current = requestAnimationFrame(step);
      else anim.current = 0;
    };
    anim.current = requestAnimationFrame(step);
  };

  const onUp = (e: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    const st = g.current;
    if (!st.pts.has(e.pointerId)) return;
    st.pts.delete(e.pointerId);
    if (st.long) clearTimeout(st.long);
    if (st.mode === 'pinch') {
      if (st.pts.size === 1) {
        // continue as a pan with the remaining finger
        const [p] = [...st.pts.values()];
        st.mode = 'pan';
        st.last = { x: p.x, y: p.y, t: e.timeStamp };
        st.vel = { x: 0, y: 0 };
        return;
      }
      st.mode = 'none';
      const z = Math.max(Z_MIN, Math.min(Z_MAX, cam.current.z));
      if (z !== cam.current.z) animateTo({ ...cam.current, z }, 220);
      return;
    }
    if (st.pts.size) return;
    if (st.mode === 'pan') {
      st.mode = 'none';
      if (e.timeStamp - st.last.t < 80 && Math.hypot(st.vel.x, st.vel.y) > 0.15) momentum(st.vel.x, st.vel.y);
      return;
    }
    if (st.mode === 'tap' && e.type === 'pointerup' && !st.longFired) {
      st.mode = 'none';
      const h = hit(e.clientX, e.clientY);
      const now = e.timeStamp;
      const dbl = now - st.lastTap.t < 320 && Math.hypot(e.clientX - st.lastTap.x, e.clientY - st.lastTap.y) < 36;
      if (!h) {
        if (dbl && st.lastTap.empty) {
          fitAll();
          st.lastTap = { t: 0, x: 0, y: 0, empty: false };
          return;
        }
        st.lastTap = { t: now, x: e.clientX, y: e.clientY, empty: true };
        return;
      }
      st.lastTap = { t: now, x: e.clientX, y: e.clientY, empty: false };
      if (h.kind === 'spot') c.chooseSpot(h.i);
      else c.tapTable(h.x, h.y);
    }
    st.mode = 'none';
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    touched.current = true;
    stopAnim();
    if (e.ctrlKey || e.metaKey) {
      const r = vp.current!.getBoundingClientRect();
      const wm = toWorld(e.clientX, e.clientY);
      const z = Math.max(Z_MIN, Math.min(Z_MAX, cam.current.z * Math.exp(-e.deltaY * 0.01)));
      cam.current = { z, x: wm.x - (e.clientX - r.left - size.current.w / 2) / z, y: wm.y - (e.clientY - r.top - size.current.h / 2) / z };
    } else {
      cam.current.x += e.deltaX / cam.current.z;
      cam.current.y += e.deltaY / cam.current.z;
    }
    c.lastUserPan = performance.now();
    applyCam();
    moving();
  };
  useEffect(() => {
    const el = vp.current!;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Requests to bring cells into view (the tutorial uses this).
  const reveal = c.reveal.value;
  useEffect(() => {
    if (reveal) frame(reveal.cells, { ms: 260 });
  }, [reveal?.seq]);

  // ---------- flights and auto-follow ----------
  useLayoutEffect(() => {
    if (!action || !world.current) return;
    const z = cam.current.z;
    const rm = reducedMotion();
    const els: HTMLElement[] = [];
    action.cells.forEach(([x, y]) => {
      const el = world.current!.querySelector<HTMLElement>(`[data-cell="${x},${y}"]:not(.was-there) > .ba-card`);
      if (el) els.push(el);
    });
    // Follow the play unless the player panned in the last 3 seconds.
    if (action.cells.length && performance.now() - c.lastUserPan > 3000) {
      touched.current = true;
      frame(action.cells, { ms: rm ? 0 : 300 });
    }
    const anims: Animation[] = [];
    els.forEach((el, i) => {
      const id = Number(el.dataset.card);
      const fromRect = action.from.get(id);
      const delay = i * action.stagger;
      if (rm) {
        anims.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay, fill: 'backwards' }));
        return;
      }
      if (fromRect) {
        const to = el.getBoundingClientRect();
        const dx = (fromRect.left + fromRect.width / 2 - (to.left + to.width / 2)) / z;
        const dy = (fromRect.top + fromRect.height / 2 - (to.top + to.height / 2)) / z;
        const sc = Math.max(0.3, Math.min(3, Math.min(fromRect.width, fromRect.height) / Math.max(1, to.width)));
        anims.push(
          el.animate(
            [
              { transform: `translate(${dx}px, ${dy}px) scale(${sc})`, opacity: action.bot ? 0.4 : 1 },
              { transform: 'translate(0,0) scale(1)', opacity: 1 },
            ],
            { duration: 200, delay, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)', fill: 'backwards' },
          ),
        );
      } else {
        anims.push(el.animate([{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 200, delay, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)', fill: 'backwards' }));
      }
    });
    return () => anims.forEach((a) => a.finish());
  }, [action?.seq]);

  // Cards present before the current action keep 'was-there' so only new ones fly.
  const prevIds = useRef(new Set<number>());
  const freshIds = useMemo(() => {
    const out = new Set<number>();
    if (action && action.kind === 'line') {
      const g = view(s);
      for (const [x, y] of action.cells) {
        const card = g.at(x, y);
        if (card) out.add(card.id);
      }
    }
    return out;
  }, [action?.seq, s]);
  useEffect(() => {
    prevIds.current = new Set(s.board.map((b) => b.id));
  });

  // Keep fresh rings for a moment after a play, then let them fade.
  const [freshDone, setFreshDone] = useState(0);
  useEffect(() => {
    if (!action) return;
    const tm = setTimeout(() => setFreshDone(action.seq), 1100 + action.cells.length * action.stagger);
    return () => clearTimeout(tm);
  }, [action?.seq]);
  const showFresh = !!action && freshDone !== action.seq;

  // ---------- render ----------
  const selActive = !hidden && !selEmpty(sel);
  const selVerbKey = sel.verb && 'table' in sel.verb ? sel.verb.table.x + ',' + sel.verb.table.y : null;
  const crossKey = sel.cross ? sel.cross.x + ',' + sel.cross.y : null;
  const ontoKey = sel.onto ? sel.onto.x + ',' + sel.onto.y : null;
  const hintKey = hintVerb && 'table' in hintVerb ? hintVerb.table.x + ',' + hintVerb.table.y : null;
  const hiddenPicked = new Set(picks.flatMap((p) => ('cross' in p ? [p.cross.x + ',' + p.cross.y] : [])));
  const takenKey = taken && taken.cell && Date.now() - taken.at < 700 ? taken.cell : null;
  const lastLine = s.lines[s.lines.length - 1];
  // The lines ending on each meaning card: the meaning each used and the side it arrives from.
  const uses = useMemo(() => meaningUses(s.lines), [s.lines]);

  const cards = s.board.map((b) => {
    const k = b.x + ',' + b.y;
    const isLit = !!lit?.tableCells.has(k) || hintKey === k;
    const selected = selVerbKey === k || crossKey === k || ontoKey === k || (hidden && ((sel.verb && 'table' in sel.verb && sel.verb.table.x === b.x && sel.verb.table.y === b.y) || hiddenPicked.has(k)));
    const dim = selActive && !isLit && !selected;
    const was = prevIds.current.has(b.id) && !freshIds.has(b.id);
    return (
      <div key={b.id} class={'cell' + (was ? ' was-there' : '')} data-cell={k} data-card={b.id} style={{ transform: `translate(${b.x * PITCH}px, ${b.y * PITCH}px)` }}>
        <Face card={b} size="table" lit={isLit} selected={selected} dim={dim} fresh={showFresh && freshIds.has(b.id)} taken={takenKey === k} owner={b.owner} showOwner label={b.k === 'M' ? meaningLabel(b, uses.get(k)) : cardLabel(b)} tabIndex={-1} uses={b.k === 'M' ? uses.get(k) : undefined} />
      </div>
    );
  });

  // Spot choice: dashed ghosts, and the line previewed at the chosen spot.
  let ghosts: JSX.Element[] = [];
  if (spot) {
    const chosen = spot.options[spot.chosen];
    ghosts = spot.options.map((o, i) =>
      i === spot.chosen ? null : <div key={'g' + i} class="ba-ghost" style={{ transform: `translate(${o.x * PITCH}px, ${o.y * PITCH}px)` }} />,
    ).filter(Boolean) as JSX.Element[];
    if (chosen) {
      if (spot.way) {
        const cmp = COMPOUND_BY_ID[spot.way.c];
        const words = [cmp.v, ...cmp.ps];
        const n = words.length + 1;
        for (let i = 0; i < n; i++) {
          const x = chosen.x + chosen.d[0] * i,
            y = chosen.y + chosen.d[1] * i;
          if (view(s).at(x, y)) continue;
          ghosts.push(<div key={'p' + i} class="ba-ghost is-suggested preview" style={{ transform: `translate(${x * PITCH}px, ${y * PITCH}px)` }}>{i < words.length ? <span>{words[i]}</span> : <span class="pv-m">{spot.way.g}</span>}</div>);
        }
      } else {
        const v = s.hands[c.viewer.value].find((h) => h.id === spot.lone);
        ghosts.push(
          <div key="lone" class="ba-ghost is-suggested preview" style={{ transform: `translate(${chosen.x * PITCH}px, ${chosen.y * PITCH}px)` }}>
            <span>{v?.t}</span>
          </div>,
        );
      }
    }
  }

  return (
    <div class="board ba-board" ref={vp} onScroll={(e) => ((e.currentTarget.scrollTop = 0), (e.currentTarget.scrollLeft = 0))} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={(e) => {
        e.preventDefault();
        if (!g.current.mouse) return; // touch long-press is handled by its own timer
        const h = hit(e.clientX, e.clientY);
        if (h?.kind === 'card') c.tapTable(h.x, h.y, true);
      }} role="application" aria-label={t('a11y.board', { n: s.board.length })}>
      <div class="board-world" ref={world}>
        {cards}
        {ghosts}
      </div>
      <button class="ba-icon-btn board-fit" aria-label={t('table.fit')} onClick={fitAll}>
        <IconFit size={20} />
      </button>
      <ul class="sr-only" aria-label={t('a11y.board', { n: s.board.length })}>
        {s.lines.map((l, i) => (
          <li key={i}>
            {compoundText(COMPOUND_BY_ID[l.c])}, {l.g.toLowerCase()}, {c.name(l.p)}
          </li>
        ))}
        {s.board
          .filter((b) => b.k === 'V')
          .map((b) => (
            <li key={'v' + b.id}>
              <button type="button" onClick={() => c.tapTable(b.x, b.y)}>
                {cardLabel(b)}
                {lit?.tableCells.has(b.x + ',' + b.y) ? ', ' + t('a11y.lit') : ''}
              </button>
            </li>
          ))}
        {lastLine && <li>{t('table.lays', { name: c.name(lastLine.p), compound: compoundText(COMPOUND_BY_ID[lastLine.c]), meaning: lastLine.g.toLowerCase() })}</li>}
      </ul>
    </div>
  );
}

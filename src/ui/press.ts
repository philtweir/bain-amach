// Tap and long-press on one element without the browser's long-press menu or a double fire.
// Press state is kept per element, so a re-render mid-press doesn't lose it.
import type { JSX } from 'preact';

const LONG = 430;
const SLOP = 10;

interface PressState {
  timer: ReturnType<typeof setTimeout> | null;
  fired: boolean;
  x0: number;
  y0: number;
}
const states = new WeakMap<EventTarget, PressState>();
const get = (el: EventTarget) => {
  let s = states.get(el);
  if (!s) states.set(el, (s = { timer: null, fired: false, x0: 0, y0: 0 }));
  return s;
};

export function press(onTap: () => void, onLong?: () => void) {
  const clear = (s: PressState) => {
    if (s.timer) clearTimeout(s.timer);
    s.timer = null;
  };
  return {
    onPointerDown: (e: JSX.TargetedPointerEvent<HTMLElement>) => {
      const s = get(e.currentTarget);
      s.fired = false;
      s.x0 = e.clientX;
      s.y0 = e.clientY;
      clear(s);
      if (onLong)
        s.timer = setTimeout(() => {
          s.fired = true;
          s.timer = null;
          onLong();
        }, LONG);
    },
    onPointerMove: (e: JSX.TargetedPointerEvent<HTMLElement>) => {
      const s = get(e.currentTarget);
      if (s.timer && Math.hypot(e.clientX - s.x0, e.clientY - s.y0) > SLOP) clear(s);
    },
    onPointerUp: (e: JSX.TargetedPointerEvent<HTMLElement>) => clear(get(e.currentTarget)),
    onPointerCancel: (e: JSX.TargetedPointerEvent<HTMLElement>) => clear(get(e.currentTarget)),
    onContextMenu: (e: Event) => e.preventDefault(),
    onClick: (e: JSX.TargetedMouseEvent<HTMLElement>) => {
      const s = get(e.currentTarget);
      clear(s);
      if (s.fired) {
        s.fired = false;
        return;
      }
      onTap();
    },
  };
}

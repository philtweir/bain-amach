import { render } from 'preact';
import '../handoff/design-kit/design-system/fonts.css';
import '../handoff/design-kit/design-system/tokens.css';
import '../handoff/design-kit/design-system/components.css';
import './styles/app.css';
import './ui/motion';
import { App, initialStack } from './app/App';
import { setUpdater } from './app/session';
import { game } from './app/session';

// Block the browser's own pinch-zoom and long-press menus; the board has its own zoom.
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => {
  const el = e.target as HTMLElement;
  if (!el.closest('input, textarea')) e.preventDefault();
});
// iOS: two-finger zoom on anything but the board, and double-tap zoom, come through as touchmove/dblclick.
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1 && !(e.target as HTMLElement).closest('.board')) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
// iOS only applies :active press states when a touchstart listener exists.
document.addEventListener('touchstart', () => {}, { passive: true });

initialStack();
render(<App />, document.getElementById('app')!);

// Remove the boot splash once the first frame of the app is on screen.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    const boot = document.getElementById('boot');
    if (!boot) return;
    boot.style.transition = 'opacity 180ms ease-out';
    boot.style.opacity = '0';
    setTimeout(() => boot.remove(), 200);
  }),
);

// Service worker: precache everything; a new version waits until the player restarts from
// Home or Recap, never mid-game.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      onNeedRefresh() {
        setUpdater(() => {
          game.value?.save();
          void update(true);
        });
      },
    });
  });
}

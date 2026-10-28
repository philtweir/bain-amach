// Line icons from the design kit (24px grid, round caps, currentColor).
import type { JSX } from 'preact';

type P = { size?: number; class?: string };
const svg = (d: JSX.Element, sw = 2.4) => ({ size = 24, class: c }: P) => (
  <svg class={c} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={sw} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const IconBack = svg(<path d="M15 5l-7 7 7 7" />);
export const IconChevron = svg(<path d="M9 6l6 6-6 6" />);
export const IconClose = svg(<path d="M6 6l12 12M18 6L6 18" />);
export const IconFit = svg(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />);
export const IconHint = svg(<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" />);
export const IconNotQuite = svg(<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5" />);
export const IconPause = svg(<path d="M9 5v14M15 5v14" />, 2.6);
export const IconClock = svg(
  <>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l3 2M9 2h6" />
  </>,
);
export const IconRefused = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M6 18 18 6" />
  </>,
);
export const IconRiverTurns = svg(<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />, 3);
export const IconRules = svg(<path d="M2.5 5.5h7a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 0-2.5-2.5h-7zM21.5 5.5h-7A2.5 2.5 0 0 0 12 8v11a2.5 2.5 0 0 1 2.5-2.5h7z" />, 2.2);
export const IconSettings = svg(
  <>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2.2" />
    <circle cx="8" cy="17" r="2.2" />
  </>,
  2.2,
);
export const IconShare = svg(<path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7" />);
export const IconTaken = svg(
  <>
    <path d="M12 7v6M12 17h.01" />
    <circle cx="12" cy="12" r="9" />
  </>,
);
export const IconPlus = svg(<path d="M12 5v14M5 12h14" />, 2.6);
export const IconBag = svg(<path d="M5.5 8.5h13l-1.2 11.5H6.7zM9 8.5V7a3 3 0 0 1 6 0v1.5" />);

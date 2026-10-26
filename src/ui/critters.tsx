// Bot faces, drawn as card tiles come alive: a rounded tile with 4px of thickness, flat fills, and a
// die-cut paper edge round the whole silhouette. Eyes are one construction for all three species
// (white disc, ink pupil, highlight); expressions move pupils, lids and mouth, never the shape.
// The paper edge is the .critter-edge rule in app.css.
// Stand-ins drawn from the design screenshots: swap for the design's own assets here when they arrive.
import type { JSX } from 'preact';
import type { Mood, Species } from '../game/critters';

const INK = '#1d2321';
const EYE = '#ffffff';

type Shapes = { sil: JSX.Element; face: JSX.Element };

/** A pupil offset by mood: where the eye looks. */
const LOOK: Record<Mood, [number, number]> = { neutral: [0, 0], thinking: [-1.2, -1.6], pleased: [0, 0], stuck: [1.4, 0.4], beaten: [0, 1.4] };

/** One eye: white disc, pupil, highlight, with lids for pleased (closed, smiling) and beaten (heavy). */
function Eye({ x, y, r, mood, look, arc = INK, lid }: { x: number; y: number; r: number; mood: Mood; look?: [number, number]; arc?: string; lid: string }) {
  if (mood === 'pleased')
    return <path d={`M${x - r} ${y + r * 0.35} Q${x} ${y - r * 1.1} ${x + r} ${y + r * 0.35}`} fill="none" stroke={arc} stroke-width={r * 0.55} stroke-linecap="round" />;
  const [dx, dy] = look ?? LOOK[mood];
  const pr = r * 0.58;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={EYE} />
      <circle cx={x + dx * (r / 3.4)} cy={y + dy * (r / 3.4)} r={pr} fill={INK} />
      <circle cx={x + dx * (r / 3.4) + pr * 0.35} cy={y + dy * (r / 3.4) - pr * 0.4} r={pr * 0.32} fill={EYE} />
      {mood === 'beaten' && <path d={`M${x - r - 0.6} ${y - r - 0.6} H${x + r + 0.6} V${y - r * 0.05} Q${x} ${y + r * 0.25} ${x - r - 0.6} ${y - r * 0.05} Z`} fill={lid} />}
    </g>
  );
}

/** Mouths, centred at (x, y), w wide. */
function Mouth({ x, y, w, mood, colour = INK }: { x: number; y: number; w: number; mood: Mood; colour?: string }) {
  const h = w / 2;
  const sw = Math.max(1.4, w * 0.2);
  const common = { fill: 'none', stroke: colour, 'stroke-width': sw, 'stroke-linecap': 'round' as const };
  switch (mood) {
    case 'pleased':
      return (
        <g>
          <path d={`M${x - h} ${y - 0.6} Q${x} ${y + w * 0.75} ${x + h} ${y - 0.6} Z`} fill={INK} />
          <path d={`M${x - h * 0.45} ${y + w * 0.28} Q${x} ${y + w * 0.55} ${x + h * 0.45} ${y + w * 0.28}`} fill="#d9534f" />
        </g>
      );
    case 'thinking':
      return <path d={`M${x - h * 0.7} ${y + 0.4} L${x + h * 0.7} ${y - 0.4}`} {...common} />;
    case 'stuck':
      return <path d={`M${x - h} ${y} q${h / 2} -${w * 0.22} ${h} 0 t${h} 0`} {...common} />;
    case 'beaten':
      return <path d={`M${x - h * 0.8} ${y + w * 0.2} Q${x} ${y - w * 0.3} ${x + h * 0.8} ${y + w * 0.2}`} {...common} />;
    default:
      return <path d={`M${x - h * 0.8} ${y - w * 0.1} Q${x} ${y + w * 0.35} ${x + h * 0.8} ${y - w * 0.1}`} {...common} />;
  }
}

/** The card tile every face is built on: thickness underneath, then the face. */
const tile = (fill: string, under: string) => (
  <>
    <rect x="9" y="16" width="46" height="44" rx="10" fill={under} />
    <rect x="9" y="12" width="46" height="44" rx="10" fill={fill} />
  </>
);

function broc(mood: Mood): Shapes {
  return {
    sil: (
      <>
        <circle cx="14" cy="15" r="5.5" fill="#cbc4b4" />
        <circle cx="50" cy="15" r="5.5" fill="#cbc4b4" />
        {tile('#f3efe5', '#cfc7b6')}
      </>
    ),
    face: (
      <g>
        <path d="M17.5 12.5 H27 L30.4 41 Q28.6 44.2 25.6 41.4 L18.8 30 Q17.3 27.6 17.4 24 Z" fill={INK} />
        <path d="M46.5 12.5 H37 L33.6 41 Q35.4 44.2 38.4 41.4 L45.2 30 Q46.7 27.6 46.6 24 Z" fill={INK} />
        <Eye x={24} y={29} r={3.3} mood={mood} arc={EYE} lid={INK} />
        <Eye x={40} y={29} r={3.3} mood={mood} arc={EYE} lid={INK} />
        <ellipse cx="32" cy="45" rx="3.8" ry="2.7" fill={INK} />
        <Mouth x={32} y={50.5} w={6} mood={mood} />
      </g>
    ),
  };
}

function corr(mood: Mood): Shapes {
  return {
    sil: (
      <>
        <path d="M14 15 Q6 13 1.5 14.5 M15 18.5 Q8 18 3 20.5" fill="none" stroke={INK} stroke-width="2.6" stroke-linecap="round" />
        <path d="M53 31 L63 34.5 L53 38 Z" fill="#e7a43c" stroke="#e7a43c" stroke-width="1.5" stroke-linejoin="round" />
        {tile('#a4adb2', '#7f898e')}
      </>
    ),
    face: (
      <g>
        <path d="M30 12 H45 Q55 12 55 22 V46 Q55 56 45 56 H38 Q30 46 30.5 34 Q31 22 30 12 Z" fill="#f4f5f2" />
        <path d="M9 22 V20 Q9 12 19 12 H45 Q55 12 55 20 V21 Q44 17.5 32 19 Q20 20.5 9 22 Z" fill={INK} />
        <path d="M38 44 V51 M41.5 45 V52" stroke="#8e979c" stroke-width="1.6" stroke-linecap="round" />
        <Eye x={43} y={28} r={3.4} mood={mood} look={mood === 'stuck' ? [-1.6, 0] : undefined} lid="#f4f5f2" />
        {mood === 'pleased' && <path d="M52.5 40.5 Q50 42.5 47.5 41" fill="none" stroke={INK} stroke-width="1.4" stroke-linecap="round" />}
        {mood === 'beaten' && <path d="M53 39.5 Q51 39 49 40.5" fill="none" stroke={INK} stroke-width="1.4" stroke-linecap="round" />}
        {mood === 'stuck' && <path d="M53 40 q-1.2 -1 -2.4 0 t-2.4 0" fill="none" stroke={INK} stroke-width="1.4" stroke-linecap="round" />}
      </g>
    ),
  };
}

function giorria(mood: Mood): Shapes {
  const ear = (x: number) => (
    <>
      <rect x={x} y="1" width="10" height="20" rx="5" fill="#c98a52" />
      <rect x={x + 2.5} y="5" width="5" height="13" rx="2.5" fill="#eaa79c" />
      <path d={`M${x} 6 V6 Q${x} 1 ${x + 5} 1 Q${x + 10} 1 ${x + 10} 6 Z`} fill="#2b2421" />
    </>
  );
  return {
    sil: (
      <>
        {ear(16)}
        {ear(38)}
        {tile('#c98a52', '#a26a3a')}
      </>
    ),
    face: (
      <g>
        <Eye x={24} y={30} r={5} mood={mood} lid="#c98a52" />
        <Eye x={40} y={30} r={5} mood={mood} lid="#c98a52" />
        <path d="M22 50 Q22 41 32 41 Q42 41 42 50 Q42 55 32 55 Q22 55 22 50 Z" fill="#f3d6ad" />
        <path d="M29.6 42.6 H34.4 L32 45.4 Z" fill="#7a3f2a" />
        <Mouth x={32} y={50} w={7} mood={mood} colour="#3a2a22" />
      </g>
    ),
  };
}

const DRAW: Record<Species, (m: Mood) => Shapes> = { broc, corr, giorria };

/** A bot's face. Decorative: the avatar or row it sits in carries the accessible name. */
export function Critter({ species, mood = 'neutral', size = 44 }: { species: Species; mood?: Mood; size?: number }) {
  const { sil, face } = DRAW[species](mood);
  return (
    <svg class={'critter critter-' + mood} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g class="critter-edge">{sil}</g>
      {sil}
      {face}
    </svg>
  );
}

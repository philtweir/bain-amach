// Bot faces from the design's characters sheet: one SVG per species and mood in ./faces, pulled out
// by tools/faces/extract.py. They ride in the bundle as data URIs (about 30 KB in all), so they are
// there offline and never pop in. Decorative: the avatar or row carries the accessible name.
import type { Mood, Species } from '../game/critters';

const RAW = import.meta.glob<string>('./faces/*.svg', { eager: true, query: '?raw', import: 'default' });
const URLS: Record<string, string> = {};
for (const [path, svg] of Object.entries(RAW)) URLS[path.slice(8, -4)] = 'data:image/svg+xml,' + encodeURIComponent(svg);

export const faceUrl = (species: Species, mood: Mood = 'neutral') => URLS[`${species}-${mood}`];

export function Critter({ species, mood = 'neutral', size = 44 }: { species: Species; mood?: Mood; size?: number }) {
  return <img class={'critter critter-' + mood} src={faceUrl(species, mood)} width={size} height={size} alt="" draggable={false} decoding="sync" />;
}

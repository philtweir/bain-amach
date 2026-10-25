// mulberry32, as in the reference engine. The state is a single uint32 so it serialises with the game.

export function next(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** A stateful generator over a seed, for setup (shuffles). */
export function rng(seed: number): { (): number; state(): number } {
  let a = seed >>> 0;
  const f = () => {
    const [v, s] = next(a);
    a = s;
    return v;
  };
  f.state = () => a;
  return f;
}

export function shuffle<T>(arr: T[], r: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

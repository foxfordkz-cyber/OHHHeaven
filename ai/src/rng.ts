// Deterministic hashing and pseudo-random numbers. No Math.random anywhere in this package.

/** 32-bit FNV-1a over a string. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 64-bit-ish hex digest from two independent FNV passes; used as a cache key. */
export function digest(s: string): string {
  const a = hash32(s).toString(16).padStart(8, '0');
  const b = hash32(`${s.length}:${s}:salt`).toString(16).padStart(8, '0');
  return a + b;
}

/** mulberry32: small, fast, deterministic PRNG returning floats in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable PRNG for a named stream: same (seed, ...keys) → same sequence. */
export function stream(seed: number, ...keys: (string | number)[]): () => number {
  return rng(hash32(`${seed}|${keys.join('|')}`));
}

/** Standard normal from two uniforms (Box–Muller). */
export function normal(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Deterministic in-place Fisher–Yates shuffle. */
export function shuffle<T>(xs: T[], r: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

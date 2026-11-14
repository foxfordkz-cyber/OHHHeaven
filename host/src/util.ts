// Мелкие чистые утилиты хоста. Без Date и Math.random: случайность только через сид.

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
export const round2 = (x: number): number => Math.round(x * 100) / 100;
export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** Сидируемый генератор (mulberry32). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Детерминированный хэш чисел и строк в 32 бита. */
export function hash32(...parts: (number | string)[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= 0x9e3779b9;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Число 0..1, детерминированное по частям. */
export const rand01 = (...parts: (number | string)[]): number => mulberry32(hash32(...parts))();

export const formatMoney = (x: number): string => {
  const sign = x < 0 ? '-' : '';
  const v = Math.round(Math.abs(x));
  return `${sign}$${v.toLocaleString('en-US')}`;
};

/** Глубокая копия JSON-данных мира. */
export const cloneJson = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Расстояние в метрах между двумя точками (формула гаверсинусов). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

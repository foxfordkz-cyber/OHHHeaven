// QR-код без зависимостей: байтовый режим, уровень коррекции M, версии 1–10 (до 213 байт — адрес входа по коду
// помещается с запасом). Алгоритм — ISO/IEC 18004: Рида — Соломона над GF(256), восемь масок, выбор по штрафу.

const EC_M: { ec: number; blocks: [number, number][] }[] = [
  // [число блоков, байт данных в блоке] по версиям 1–10, уровень M
  { ec: 10, blocks: [[1, 16]] },
  { ec: 16, blocks: [[1, 28]] },
  { ec: 26, blocks: [[1, 44]] },
  { ec: 18, blocks: [[2, 32]] },
  { ec: 24, blocks: [[2, 43]] },
  { ec: 16, blocks: [[4, 27]] },
  { ec: 18, blocks: [[4, 31]] },
  { ec: 22, blocks: [[2, 38], [2, 39]] },
  { ec: 22, blocks: [[3, 36], [2, 37]] },
  { ec: 26, blocks: [[4, 43], [1, 44]] },
];
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// ───────────── GF(256), многочлен 0x11D ─────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
}
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);

function generator(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]!; next[j + 1] ^= mul(g[j]!, EXP[i]!); }
    g = next;
  }
  return g;
}

function ecBytes(data: number[], n: number): number[] {
  const g = generator(n);
  const r = [...data, ...new Array<number>(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const c = r[i]!;
    if (c === 0) continue;
    for (let j = 0; j < g.length; j++) r[i + j] ^= mul(g[j]!, c);
  }
  return r.slice(data.length);
}

// ───────────── данные ─────────────
const dataCapacity = (v: number) => EC_M[v - 1]!.blocks.reduce((a, [n, k]) => a + n * k, 0);

function codewords(bytes: Uint8Array, v: number): number[] {
  const cap = dataCapacity(v);
  const bits: number[] = [];
  const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);
  // блоки, коррекция, чередование
  const { ec, blocks } = EC_M[v - 1]!;
  const split: number[][] = [];
  let at = 0;
  for (const [n, k] of blocks) for (let i = 0; i < n; i++) { split.push(data.slice(at, at + k)); at += k; }
  const ecs = split.map((b) => ecBytes(b, ec));
  const out: number[] = [];
  const longest = Math.max(...split.map((b) => b.length));
  for (let i = 0; i < longest; i++) for (const b of split) if (i < b.length) out.push(b[i]!);
  for (let i = 0; i < ec; i++) for (const e of ecs) out.push(e[i]!);
  return out;
}

// ───────────── матрица ─────────────
type Grid = { size: number; dark: boolean[][]; fixed: boolean[][] };

function blank(v: number): Grid {
  const size = 17 + 4 * v;
  return { size, dark: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)), fixed: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)) };
}

const set = (g: Grid, x: number, y: number, d: boolean) => { g.dark[y]![x] = d; g.fixed[y]![x] = true; };

function functionPatterns(g: Grid, v: number): void {
  const s = g.size;
  for (let i = 0; i < s; i++) { set(g, 6, i, i % 2 === 0); set(g, i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [s - 4, 3], [3, s - 4]] as const) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx; const y = cy + dy;
      if (x < 0 || y < 0 || x >= s || y >= s) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(g, x, y, d !== 2 && d !== 4);
    }
  }
  const pos = ALIGN[v - 1]!;
  const last = pos.length - 1;
  for (let i = 0; i <= last; i++) for (let j = 0; j <= last; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(g, pos[i]! + dx, pos[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  formatBits(g, 0);
  if (v >= 7) {
    let rem = v;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (v << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const d = ((bits >>> i) & 1) === 1;
      const a = s - 11 + (i % 3); const b = Math.floor(i / 3);
      set(g, a, b, d); set(g, b, a, d);
    }
  }
}

/** Формат: уровень M (биты 00) и маска; две копии и тёмный модуль. */
function formatBits(g: Grid, mask: number): void {
  const data = (0 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  const s = g.size;
  for (let i = 0; i <= 5; i++) set(g, 8, i, bit(i));
  set(g, 8, 7, bit(6)); set(g, 8, 8, bit(7)); set(g, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(g, 14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(g, s - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(g, 8, s - 15 + i, bit(i));
  set(g, 8, s - 8, true);
}

function place(g: Grid, words: number[]): void {
  const s = g.size;
  let i = 0;
  for (let right = s - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < s; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? s - 1 - vert : vert;
        if (g.fixed[y]![x] || i >= words.length * 8) continue;
        g.dark[y]![x] = ((words[i >>> 3]! >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(g: Grid, m: number): Grid {
  const f = MASKS[m]!;
  const dark = g.dark.map((row, y) => row.map((d, x) => (g.fixed[y]![x] ? d : d !== f(x, y))));
  const out: Grid = { size: g.size, dark, fixed: g.fixed.map((r) => [...r]) };
  formatBits(out, m);
  return out;
}

function penalty(g: Grid): number {
  const s = g.size;
  const at = (x: number, y: number) => g.dark[y]![x]!;
  let p = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < s; a++) {
      let run = 1;
      const line: boolean[] = [];
      for (let b = 0; b < s; b++) line.push(pass === 0 ? at(b, a) : at(a, b));
      for (let b = 1; b <= s; b++) {
        if (b < s && line[b] === line[b - 1]) { run++; continue; }
        if (run >= 5) p += 3 + (run - 5);
        run = 1;
      }
      const str = line.map((d) => (d ? '1' : '0')).join('');
      for (const pat of ['10111010000', '00001011101']) for (let k = str.indexOf(pat); k >= 0; k = str.indexOf(pat, k + 1)) p += 40;
    }
  }
  for (let y = 0; y < s - 1; y++) for (let x = 0; x < s - 1; x++) {
    const d = at(x, y);
    if (d === at(x + 1, y) && d === at(x, y + 1) && d === at(x + 1, y + 1)) p += 3;
  }
  let dark = 0;
  for (const row of g.dark) for (const d of row) if (d) dark++;
  const total = s * s;
  p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return p;
}

export interface QrMatrix { version: number; mask: number; size: number; modules: boolean[][] }

/** Матрица QR для текста (UTF-8). `mask` и `version` — только для проверки по эталону. */
export function qrMatrix(text: string, opts: { version?: number; mask?: number } = {}): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const v = opts.version ?? EC_M.findIndex((_, i) => dataCapacity(i + 1) * 8 >= 4 + (i + 1 < 10 ? 8 : 16) + bytes.length * 8) + 1;
  if (v < 1 || v > EC_M.length) throw new Error(`QR: text is too long (${bytes.length} bytes, max ${dataCapacity(10) - 3})`);
  const g = blank(v);
  functionPatterns(g, v);
  place(g, codewords(bytes, v));
  let best: { m: number; grid: Grid; score: number } | null = null;
  for (let m = 0; m < 8; m++) {
    if (opts.mask !== undefined && m !== opts.mask) continue;
    const grid = applyMask(g, m);
    const score = penalty(grid);
    if (!best || score < best.score) best = { m, grid, score };
  }
  return { version: v, mask: best!.m, size: g.size, modules: best!.grid.dark };
}

/** SVG с полями в четыре модуля; тёмные модули одним путём — масштабируется без размытия. */
export function qrSvg(text: string, px = 8): string {
  const q = qrMatrix(text);
  const quiet = 4;
  const n = q.size + quiet * 2;
  let d = '';
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y]![x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * px}" height="${n * px}" shape-rendering="crispEdges"><title>${text.replace(/[&<>]/g, '')}</title><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

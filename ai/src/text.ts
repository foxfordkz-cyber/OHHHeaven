// Small text helpers for matching questions to rule cards and for checking AI answers against the data.

const STOP = new Set(['a', 'an', 'the', 'i', 'my', 'me', 'we', 'our', 'you', 'your', 'is', 'are', 'am', 'be', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'it', 'do', 'does', 'can', 'should', 'would', 'what', 'how', 'if', 'this', 'that', 'with', 'about', 'there', 'happens', 'happen', 'will', 'get', 'need', 'any', 'have', 'has']);

export function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('es') && /(sh|ch|x|ss)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  return w;
}

export function tokens(s: string): string[] {
  return (s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').match(/[a-z0-9]+/g) ?? [])
    .filter(w => !STOP.has(w)).map(stem);
}

/** Related words, so "Should I hire a third barista?" finds staff and wage cards. */
const RELATED: Record<string, string[]> = {
  hire: ['staff', 'employee', 'worker', 'wage', 'payroll', 'barista', 'barber', 'shift'],
  barista: ['staff', 'wage', 'hire', 'tipped'],
  barber: ['staff', 'wage', 'hire', 'license'],
  staff: ['wage', 'payroll', 'hire', 'employee'],
  cash: ['payroll', 'wage', 'tax', 'books'],
  supplier: ['wholesale', 'vendor', 'roaster', 'supply', 'distributor'],
  vendor: ['supplier', 'wholesale'],
  bean: ['coffee', 'roaster', 'supplier'],
  milk: ['dairy', 'supplier'],
  permit: ['license', 'inspection', 'dohmh', 'agency'],
  license: ['permit', 'agency'],
  inspection: ['inspector', 'grade', 'health', 'permit'],
  grade: ['inspection', 'health'],
  tax: ['sales', 'payroll', 'irs'],
  rent: ['lease', 'landlord', 'space'],
  price: ['pricing', 'charge', 'margin'],
  clean: ['cleaning', 'sanitary', 'inspection'],
};

export function expand(ts: string[]): Set<string> {
  const out = new Set(ts);
  for (const t of ts) for (const r of RELATED[t] ?? []) out.add(stem(r));
  return out;
}

export function overlap(query: Set<string>, text: string): number {
  let n = 0;
  for (const t of new Set(tokens(text))) if (query.has(t)) n++;
  return n;
}

export function wordCount(s: string): number {
  return (s.trim().match(/\S+/g) ?? []).length;
}

/** Numbers as written in text: "$1,300" → 1300, "36%" → 36, "$7.8k" → 7800. */
export function numbersIn(s: string): number[] {
  const out: number[] = [];
  for (const m of s.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|K|thousand)?/g)) {
    let v = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(v)) continue;
    if (m[2]) v *= 1000;
    out.push(v);
  }
  return out;
}

/** True when every number in `text` is close to a number in `facts` (3%), or a small count like a month. */
export function grounded(text: string, facts: number[]): boolean {
  const pool = facts.filter(Number.isFinite).flatMap(f => [f, Math.round(f), Math.abs(f) < 1 ? f * 100 : f]);
  return numbersIn(text).every(n => (Number.isInteger(n) && n >= 0 && n <= 12) ||
    pool.some(f => Math.abs(n - f) <= Math.max(0.03 * Math.abs(f), 0.5) || Math.abs(n - Math.abs(f)) <= Math.max(0.03 * Math.abs(f), 0.5)));
}

export const plainEnglish = (s: string): boolean => /^[\x20-\x7E’–—]+$/.test(s);

/** "$6.50" under $100 with cents, "$1,300" above. */
export function money(n: number): string {
  const abs = Math.abs(n);
  const cents = abs < 100 && Math.round(abs * 100) % 100 !== 0;
  const body = cents ? abs.toFixed(2) : Math.round(abs).toLocaleString('en-US');
  return `${n < 0 && Math.round(abs * 100) !== 0 ? '-' : ''}$${body}`;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function limitWords(s: string, max: number): string {
  const ws = s.trim().split(/\s+/);
  if (ws.length <= max) return s.trim();
  const cut = ws.slice(0, max).join(' ');
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return lastStop > 40 ? cut.slice(0, lastStop + 1) : `${cut.replace(/[,;:]$/, '')}.`;
}

import { cafe, existsSync, readJson, resolve } from './harness';
import type { Spec } from './harness';

export interface Profile extends Spec { id: string; source: string; confidence: string; note: string }
const path = 'packs/parts/cafe/D20-formats.json';
type ObjectValue = Record<string, unknown>;
function object(v: unknown): ObjectValue { return v && typeof v === 'object' && !Array.isArray(v) ? v as ObjectValue : {}; }
function number(v: unknown, key: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`D20 profile ${key} must be a finite number`);
  return v;
}
function normalize(value: unknown, key: string): Profile {
  const p = object(value), orders = object(p.orders);
  const kit = p.kitId ?? p.kit;
  if (kit !== 'lean' && kit !== 'standard' && kit !== 'premium') throw new Error(`D20 profile ${key}: expected kitId/kit`);
  const staff = object(p.staff ?? orders.staff), levers = object(p.levers ?? orders.levers);
  if (!Object.keys(staff).length) throw new Error(`D20 profile ${key}: missing staff`);
  for (const [id, n] of Object.entries(staff)) {
    number(n, `${key}.staff.${id}`);
    if (!cafe.staff.some(r => r.id === id) || (n as number) < 0 || !Number.isInteger(n)) throw new Error(`D20 profile ${key}: invalid staff ${id}`);
  }
  for (const [id, option] of Object.entries(levers)) {
    if (typeof option !== 'string' || !cafe.levers.find(l => l.id === id)?.options.some(o => o.id === option)) {
      throw new Error(`D20 profile ${key}: ${id}=${String(option)} is unavailable in ${cafe.id}; integrate A1 data first`);
    }
  }
  return {
    id: typeof p.id === 'string' ? p.id : key, label: String(p.name ?? p.label ?? p.id ?? key), kit,
    size: number(p.size ?? p.seats, `${key}.size`), price: number(p.price ?? orders.price, `${key}.price`),
    staff: staff as Record<string, number>, levers: levers as Record<string, string>,
    source: path, confidence: String(p.confidence ?? 'estimate'), note: String(p.note ?? 'A1 profile; original source metadata retained in the D20 file.'),
  };
}
export function loadProfiles(): { profiles: Profile[]; source: string; provisional: boolean } {
  if (existsSync(resolve(path))) {
    const doc = readJson<{ extra?: { profiles?: unknown } }>(path);
    const raw = doc.extra?.profiles;
    const entries: [string, unknown][] = Array.isArray(raw) ? raw.map((p, i) => [String(i), p]) : Object.entries(object(raw));
    // Metadata siblings are allowed in an object form; incomplete profile objects are not silently dropped.
    const profiles = entries.filter(([k]) => !['source', 'confidence', 'note'].includes(k)).map(([k, v]) => normalize(v, k));
    if (profiles.length !== 3 || new Set(profiles.map(p => p.id)).size !== 3) throw new Error('D20 must supply three distinct extra.profiles');
    return { profiles, source: path, provisional: false };
  }
  const provenance = {
    source: 'packs/cafe.json (kits, unit.refPrice, staff, levers)', confidence: 'estimate',
    note: 'Provisional audit policy, not observed NYC financial data. Seats come from kit sizes; staffing is a chosen decision. Specialty price is refPrice + $1, an explicit grid point from the prior audit. No coefficients are added to the engine.',
  };
  return { source: 'sim/audit/profiles.ts (until A1 publishes D20)', provisional: true, profiles: [
    { ...provenance, id: 'takeaway', label: 'Takeaway', kit: 'lean', size: cafe.kits.find(k => k.id === 'lean')!.size,
      price: cafe.unit.refPrice, staff: { barista: 3, shift_lead: 0 }, levers: {} },
    { ...provenance, id: 'neighborhood', label: 'Neighborhood seating', kit: 'premium', size: cafe.kits.find(k => k.id === 'premium')!.size,
      price: cafe.unit.refPrice, staff: { barista: 3, shift_lead: 1 }, levers: {} },
    { ...provenance, id: 'specialty', label: 'Specialty', kit: 'premium', size: cafe.kits.find(k => k.id === 'standard')!.size,
      price: cafe.unit.refPrice + 1, staff: { barista: 3, shift_lead: 1 }, levers: { sourcing: 'specialty', cleaning: 'deep', staff_pay: 'above' } },
  ] };
}

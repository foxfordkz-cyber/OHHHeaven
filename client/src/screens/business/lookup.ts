// Read-only lookups into the niche pack and _common: names, laws, who can catch what.
import type { CommonPack, FoundBy, Pack, PackOfficial, PackRuleCard, PackShortcut, PackViolation, ViolationTrail } from '../../../../shared/src/types';
import { usd } from './format';

export interface Packs { pack: Pack | null; common: CommonPack | null }

export const allShortcuts = ({ pack, common }: Packs): PackShortcut[] => [...(pack?.shortcuts ?? []), ...(common?.shortcuts ?? [])];
export const allViolations = ({ pack, common }: Packs): PackViolation[] => [...(pack?.violations ?? []), ...(common?.violations ?? [])];
export const allOfficials = ({ pack, common }: Packs): PackOfficial[] => [...(pack?.officials ?? []), ...(common?.officials ?? [])];
export const allRuleCards = ({ pack, common }: Packs): PackRuleCard[] => [...(pack?.ruleCards ?? []), ...(common?.ruleCards ?? [])];

export const violationById = (p: Packs, id: string) => allViolations(p).find((v) => v.id === id) ?? null;
export const ruleCardById = (p: Packs, id: string) => allRuleCards(p).find((c) => c.id === id) ?? null;
export const officialById = (p: Packs, id: string) => allOfficials(p).find((o) => o.id === id) ?? null;

/** Lever options that break a rule: option id → violation id, for every lever. */
export function leverViolations(pack: Pack | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const l of pack?.levers ?? []) for (const o of l.options) if (o.causes) m.set(`${l.id}:${o.id}`, o.causes);
  return m;
}

const FOUND_BY: Record<FoundBy, string> = {
  inspection: 'a routine inspection',
  audit: 'a tax audit',
  complaint: "a neighbor's complaint",
  sting: 'an undercover check',
};

/** "Health inspector (NYC DOHMH) — a routine inspection or a neighbor's complaint" */
export function whoCatches(p: Packs, v: PackViolation): string {
  const o = officialById(p, v.official);
  const who = o ? `${o.name} (${o.agency})` : v.official.replace(/_/g, ' ');
  const how = v.foundBy.map((f) => FOUND_BY[f]).join(' or ');
  return how ? `${who} — after ${how}` : who;
}

/** The fine rule in words, straight from the pack: "$300 + $100 per month, up to $2,000". */
export function fineRule(v: PackViolation): string {
  const parts: string[] = [];
  if (v.fine.base) parts.push(usd(v.fine.base));
  if (v.fine.perMonth) parts.push(`${usd(v.fine.perMonth)} per month`);
  if (v.fine.pctOfSaved) parts.push(`${Math.round(v.fine.pctOfSaved * 100)}% of what you saved`);
  let s = parts.join(' + ') || 'No fine';
  if (v.fine.max) s += `, up to ${usd(v.fine.max)}`;
  return s;
}

const BASIS: Record<PackShortcut['saves']['basis'], (a: number) => string> = {
  fixed: (a) => `${usd(a)}/mo`,
  pct_payroll: (a) => `${Math.round(a * 100)}% of payroll`,
  pct_revenue: (a) => `${Math.round(a * 100)}% of sales`,
  pct_rent: (a) => `${Math.round(a * 100)}% of rent`,
  per_staff: (a) => `${usd(a)} per worker a month`,
};

/** What a shortcut saves by the pack's rule, when no dollar figure from what_if is at hand. */
export const savesRule = (s: PackShortcut): string => BASIS[s.saves.basis](s.saves.amount);

export const trailFor = (trails: ViolationTrail[], violationId: string) => trails.find((t) => t.violationId === violationId) ?? null;

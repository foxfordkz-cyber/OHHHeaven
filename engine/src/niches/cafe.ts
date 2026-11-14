// Cafe niche hooks: glues the parts in ./cafe/ into the hooks the economy calls. Owner of this file: the lead.
// A hook exists only if at least one part implements it, so an empty part changes nothing in the game.
import type { NicheHooks } from './index';
import type { CafeDay, CafePart } from './cafe/contract';
import { part as segments } from './cafe/segments';
import { part as service } from './cafe/service';
import { part as staffing } from './cafe/staffing';
import { part as regulars } from './cafe/regulars';

export const parts: readonly CafePart[] = [segments, service, staffing, regulars];

export function composeHooks(ps: readonly CafePart[]): NicheHooks {
  const hooks: NicheHooks = {};
  const having = <K extends keyof CafePart>(k: K): CafePart[] => ps.filter((p) => typeof p[k] === 'function');

  const demand = having('demandMult');
  if (demand.length) {
    hooks.demandMult = (b, date, pack, env) => {
      const d: CafeDay = { b, pack, date, place: env?.place, day: env?.day ?? 0 };
      return demand.reduce((m, p) => m * Math.max(0, p.demandMult!(d)), 1);
    };
  }
  const capacity = having('capacityDay');
  if (capacity.length) {
    hooks.capacityDay = (b, pack, env) => {
      if (!env) return null;   // without the day's context the parts cannot answer: the engine keeps its own limits
      const d: CafeDay = { b, pack, date: env.date, place: env.place, day: env.day, demand: env.demand };
      let cap: number | null = null;
      for (const p of capacity) {
        const c = p.capacityDay!(d);
        if (typeof c === 'number' && Number.isFinite(c)) cap = cap === null ? c : Math.min(cap, c);
      }
      return cap;
    };
  }
  const quality = having('qualityDelta');
  if (quality.length) {
    hooks.qualityDelta = (b, pack, env) => {
      const d: CafeDay = { b, pack, date: env.date, place: env.place, day: env.day, demand: env.demand };
      return quality.reduce((s, p) => s + p.qualityDelta!(d), 0);
    };
  }
  const lines = having('extraLines');
  if (lines.length) hooks.extraLines = (b, pack, month) => lines.flatMap((p) => p.extraLines!(b, pack, month));
  const kpis = having('kpis');
  if (kpis.length) hooks.kpis = (b, pack) => kpis.flatMap((p) => p.kpis!(b, pack));
  const notes = having('notes');
  if (notes.length) hooks.notes = (b, r, pack) => notes.flatMap((p) => p.notes!(b, r, pack));
  return hooks;
}

export const hooks: NicheHooks = composeHooks(parts);

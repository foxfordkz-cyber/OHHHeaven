import type { BusinessState, Money, NicheId, Pack, PackSetupItem, Place, PnlLine, WorldState } from '@ohh/shared';
import type { EngineCtx } from '../index';

export const round2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Fields the economy keeps on a business until the contract gets them (agents/02.md, requests to the lead). */
export interface EconMtd {
  revenue: Money; cogs: Money; salesTax: Money; taxesPaid: Money;
  capacityUnits: number; utilSum: number; utilDays: number;
  daysAlive: number; daysOpen: number; managerDays: number;
  rentMultSum: number; utilitiesMultSum: number;
  staffDays: Record<string, number>;   // role id → worker-days this month (open days only)
}
export interface EconExtra {
  marketing: Money;      // decaying stock of ad spend
  training: Money;       // decaying stock of training spend
  lossCarry: Money;      // tax loss carried forward
  cashStart: Money;      // cash at the start of the current month
  mtd: EconMtd;
  taxYtd?: Record<string, Money>;   // tax id → amount accrued this season (for taxes with a wage base per worker)
  maxStaff?: number;                // most workers employed at once this season (wage bases are per person)
}
export type EBusiness = BusinessState & { extra?: Record<string, unknown> & { econ?: EconExtra } };

export const emptyMtd = (): EconMtd => ({
  revenue: 0, cogs: 0, salesTax: 0, taxesPaid: 0, capacityUnits: 0, utilSum: 0, utilDays: 0,
  daysAlive: 0, daysOpen: 0, managerDays: 0, rentMultSum: 0, utilitiesMultSum: 0, staffDays: {},
});

export function econOf(b: BusinessState): EconExtra {
  const e = (b as EBusiness).extra?.econ;
  return e ?? { marketing: 0, training: 0, lossCarry: 0, cashStart: b.cash, mtd: emptyMtd() };
}

export function withEcon(b: BusinessState, econ: EconExtra): EBusiness {
  const prev = (b as EBusiness).extra ?? {};
  return { ...b, extra: { ...prev, econ } };
}

export function packOf(ctx: EngineCtx, niche: NicheId): Pack | undefined {
  return ctx.packs.niches[niche];
}

export function placeOf(ctx: EngineCtx, placeId: string): Place | undefined {
  return ctx.places.find((p) => p.id === placeId);
}

export function itemDef(pack: Pack, id: string): PackSetupItem | undefined {
  return pack.setup.find((s) => s.id === id);
}

/** Size limit of a place for a niche: the usable floor divided by the area one unit of size needs. */
export function maxSizeFor(pack: Pack, place: Place, usableShare: number): number {
  return Math.min(pack.sizing.max, Math.floor((place.sqft * usableShare) / pack.sizing.sqftPerUnit));
}

/** Monthly rent of a place, from the map data. */
export function placeRentMonth(place: Place): Money {
  return round2((place.sqft * place.rentPerSqftYear) / 12);
}

export function staffCount(staff: Record<string, number>): number {
  return Object.values(staff).reduce((a, n) => a + (n > 0 ? n : 0), 0);
}

/** Adds money to a month-to-date line with a fixed id, or appends a new line. Never mutates the input. */
export function addLine(lines: readonly PnlLine[], line: PnlLine): PnlLine[] {
  const amount = round2(line.amount);
  const i = lines.findIndex((l) => l.id === line.id);
  if (i < 0) return [...lines, { ...line, amount }];
  const out = lines.slice();
  out[i] = { ...lines[i], amount: round2(lines[i].amount + amount) };
  return out;
}

export function replaceBusiness(w: WorldState, b: BusinessState): WorldState {
  return { ...w, businesses: w.businesses.map((x) => (x.id === b.id ? b : x)) };
}

export function activeBusinessOf(w: WorldState, playerId: string): BusinessState | undefined {
  for (let i = w.businesses.length - 1; i >= 0; i--) {
    const b = w.businesses[i];
    if (b.managerPlayerId === playerId && b.status !== 'bankrupt') return b;
  }
  return undefined;
}

export function fmtMoney(x: number): string {
  const s = Math.round(Math.abs(x)).toLocaleString('en-US');
  return (x < 0 ? '-$' : '$') + s;
}

// Texts for tap-to-explain. Prefers agent 04's engine/src/analytics/glossary.ts when it exists (any export that is a
// map of strings or of { what, why }), and falls back to glossary.stub.ts. The glob keeps the build green without it.
import { GLOSSARY_STUB, type GlossaryEntry } from './glossary.stub';

const found = import.meta.glob('../../../../engine/src/analytics/glossary.ts', { eager: true }) as Record<string, Record<string, unknown>>;

function engineGlossary(): Record<string, unknown> {
  for (const mod of Object.values(found)) {
    for (const value of [mod.GLOSSARY, mod.glossary, mod.default, ...Object.values(mod)]) {
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    }
  }
  return {};
}

const ENGINE = engineGlossary();

/** Screen keys that are named after a different Analytics field in agent 04's glossary. */
const ENGINE_KEY: Record<string, string> = {
  runway: 'cashRunwayMonths', payback: 'paybackMonths', breakEven: 'breakEvenUnitsMonth', lostSales: 'lostSalesUnits', taxes: 'taxDueNext',
};

export function glossary(key: string): GlossaryEntry {
  return pickEntry(ENGINE, key);
}

/** One entry: agent 04's text when it has one (string, { what } or { label, tip }), our short title and "why" around it. */
export function pickEntry(engine: Record<string, unknown>, key: string): GlossaryEntry {
  const stub = GLOSSARY_STUB[key] ?? { title: key, what: '', why: '' };
  const e = engine[ENGINE_KEY[key] ?? key];
  if (typeof e === 'string') return { ...stub, what: e };
  if (e && typeof e === 'object') {
    const o = e as Partial<Record<'title' | 'label' | 'what' | 'text' | 'tip' | 'why', string>>;
    return { title: stub.title !== key ? stub.title : o.title ?? o.label ?? key, what: o.what ?? o.tip ?? o.text ?? stub.what, why: o.why ?? stub.why };
  }
  return stub;
}

export type { GlossaryEntry };

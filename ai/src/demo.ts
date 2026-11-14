// Demo: a year of NYC weather and city events, plus one advisor answer, idea match and debrief.
// Run from the repo root: npx tsx ai/src/demo.ts [seed]
// Without ANTHROPIC_API_KEY (or with AI_PROVIDER=mock) everything comes from the deck and templates.
// With a key, the first AI_DEMO_WEEKS weeks (default 4) ask the model for events; the rest use the deck.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiConfig, aiLog, askAdvisor, deckEvent, forecast, interpretIdea, planEvents, writeDebrief } from './index';
import { dateOf, type CommonPack, type EngineCtx, type GameEvent, type NicheId, type Pack, type Place } from './shared';
import * as fx from './__stubs__/fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

/** Real packs and places when agents 09 and 14–16 have delivered them, fixtures otherwise. */
function loadCity(): { ctx: EngineCtx; source: string } {
  const packsDir = join(root, 'packs');
  const placesFile = join(root, 'data', 'places.json');
  const niches: Partial<Record<NicheId, Pack>> = {};
  let common: CommonPack | null = null;
  if (existsSync(packsDir)) {
    for (const f of readdirSync(packsDir).filter(x => x.endsWith('.json'))) {
      try {
        const p = JSON.parse(readFileSync(join(packsDir, f), 'utf8'));
        if (p.id === '_common') common = p; else if (p.id) niches[p.id as NicheId] = p;
      } catch { /* a broken pack is skipped */ }
    }
  }
  let places: Place[] = [];
  if (existsSync(placesFile)) {
    try { places = JSON.parse(readFileSync(placesFile, 'utf8')); } catch { places = []; }
  }
  const real = Object.keys(niches).length > 0 && common;
  return {
    ctx: { packs: real ? { common: common!, niches } : fx.packSet, places: places.length ? places : fx.places },
    source: `${real ? 'packs/*.json' : 'fixture packs'}, ${places.length ? 'data/places.json' : 'fixture places'}`,
  };
}

const fmt = (e: GameEvent) => {
  const eff = e.effects.length ? e.effects.map(x => `${x.target}×${x.mult}${x.niches ? `(${x.niches.join('/')})` : ''}${x.tiers ? `[${x.tiers.join('/')}]` : ''}`).join(', ') : 'info only';
  return `${dateOf(e.announcedDay).label.padEnd(12)} → ${dateOf(e.startDay).label.padEnd(12)} ${String(e.endDay - e.startDay + 1).padStart(2)}d  ${e.origin.padEnd(4)} [${e.kind}] ${e.title}${e.block ? ` @ ${e.block}` : ''} — ${eff}`;
};

async function main() {
  const seed = Number(process.argv[2]) || 2026;
  const cfg = aiConfig();
  const { ctx, source } = loadCity();
  const aiWeeks = cfg.provider === 'anthropic' ? Math.max(0, Number(process.env.AI_DEMO_WEEKS ?? 4)) : 0;
  console.log(`First Year — AI service demo. seed ${seed}, provider ${cfg.provider}${cfg.provider === 'anthropic' ? ` (${cfg.model})` : ' (no network)'}, data: ${source}\n`);

  console.log('WEATHER — Central Park normals 1991-2020, one game year');
  console.log('month  avg high  wet days  snow  storms  heat');
  const year = forecast(seed, 1, 360);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let m = 0; m < 12; m++) {
    const days = year.slice(m * 30, m * 30 + 30);
    const n = (c: string) => days.filter(d => d.condition === c).length;
    const avg = days.reduce((s, d) => s + d.tempF, 0) / days.length;
    console.log(`${MONTHS[m]}    ${avg.toFixed(0).padStart(4)}°F  ${String(n('rain') + n('snow') + n('storm')).padStart(7)}  ${String(n('snow')).padStart(4)}  ${String(n('storm')).padStart(6)}  ${String(n('heat')).padStart(4)}`);
  }
  console.log(`\nJan 1-7: ${forecast(seed, 1, 7).map(w => w.label).join(' | ')}`);
  console.log(`Jul 1-7: ${forecast(seed, 181, 7).map(w => w.label).join(' | ')}\n`);

  console.log(`EVENTS — ${aiWeeks ? `model plans the first ${aiWeeks} weeks, then the deck` : 'deck only (no key)'}`);
  const w = fx.makeWorld(seed, 1);
  const niches = Object.keys(ctx.packs.niches) as NicheId[];
  const blocks = [...new Set(ctx.places.map(p => p.block))].sort();
  for (let day = 1; day <= 360; day++) {
    w.day = day;
    w.weather = forecast(seed, day, 8);
    if ((day - 1) % 7 === 0 && Math.floor((day - 1) / 7) < aiWeeks) {
      const planned = await planEvents({ date: dateOf(day), weather: w.weather, recent: w.events, niches, blocks });
      for (const e of planned) w.events.push(e);
    }
    const e = deckEvent(w, ctx);
    if (e) w.events.push(e);
  }
  for (const e of w.events) console.log(fmt(e));
  const ai = w.events.filter(e => e.origin === 'ai').length;
  console.log(`\n${w.events.length} events: ${ai} from the model, ${w.events.length - ai} from the deck\n`);

  const pack = ctx.packs.niches.cafe ?? fx.cafePack;
  const common = ctx.packs.common ?? fx.commonPack;
  const business = { ...fx.business, niche: pack.id };
  for (const question of ['Should I hire a third barista?', 'What happens if I pay cash wages?', 'Where do I find a coffee supplier?']) {
    const a = await askAdvisor({ question, business, analytics: fx.analytics, pack, common });
    console.log(`ADVISOR (${a.origin}) Q: ${question}\n  ${a.answer}${a.sources.length ? `\n  sources: ${a.sources.map(s => s.url).join(', ')}` : ''}`);
  }
  const idea = await interpretIdea({ text: 'a small vegan coffee place near a subway', packs: ctx.packs });
  console.log(`\nIDEA (${idea.origin}) "a small vegan coffee place near a subway" → ${idea.niche}, "${idea.businessName}", ${idea.tier}, ${idea.kitId}\n  ${idea.notes.join('\n  ')}`);
  const debrief = await writeDebrief({ business, analytics: fx.analytics, plan: fx.plan, rank: 2 });
  console.log(`\nDEBRIEF (${debrief.origin}) ${debrief.headline}\n  lost: ${debrief.lostMoneyOn.map(l => `${l.title} $${l.amount}`).join('; ')}\n  did well: ${debrief.didWell.join(' ')}\n  next time: ${debrief.nextTime.join(' ')}`);

  const log = aiLog();
  const by = log.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.outcome]: (acc[e.outcome] ?? 0) + 1 }), {});
  console.log(`\nAI calls: ${log.length} ${JSON.stringify(by)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

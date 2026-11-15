// Проверка раздела 10 файла docs/GAME.md по HTTP: два владельца в демо-городе.
// Запуск: сервер (`npm run dev -w @ohh/server`), затем `npx tsx server/scripts/play.ts [http://localhost:8787]`.
import type { ClientView, Deal, OpenRecommendation, OwnerView, PackSet, Place, CityView } from '@ohh/shared';

const BASE = (process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const DAY_MS = Number(process.env.PLAY_DAY_MS ?? 150);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const money = (x: number) => `${x < 0 ? '-' : ''}$${Math.round(Math.abs(x)).toLocaleString('en-US')}`;

interface Ack<T = unknown> { ok: boolean; error?: string; data?: T }
async function api<T>(method: 'GET' | 'POST', path: string, body?: unknown, token?: string): Promise<{ status: number; body: T }> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${BASE}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 429 && attempt < 5) { await sleep(1000); continue; }
    return { status: r.status, body: (await r.json()) as T };
  }
}

const checks: { name: string; ok: boolean; note: string }[] = [];
const CRITICAL = new Set(['two free cafe spaces on the map', 'both owners join from their phones', 'each opens a cafe with the recommended kit', 'the city runs and month 1 closes for both', 'Alice reports Bob to the city']);
function summary(): never {
  const passed = checks.filter((c) => c.ok).length;
  console.log(`\nSection 10 check: ${passed}/${checks.length} passed`);
  process.exit(passed === checks.length && checks.length >= 12 ? 0 : 1);
}
function check(name: string, ok: boolean, note = ''): void {
  checks.push({ name, ok, note });
  console.log(`${ok ? '✓' : '✗'} ${name}${note ? ` — ${note}` : ''}`);
  if (!ok && CRITICAL.has(name)) { console.log('  stopping: later steps depend on this one'); summary(); }
}
/** Сколько ждать n игровых дней при текущей скорости часов, с запасом. */
const days = (n: number) => n * DAY_MS * 1.5 + 5_000;

async function waitFor<T>(what: string, fn: () => Promise<T | null | undefined | false>, timeoutMs = days(40)): Promise<T | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(Math.max(300, DAY_MS));
  }
  console.log(`  … timed out waiting for ${what}`);
  return null;
}

async function main(): Promise<void> {
  const health = await api<{ ok: boolean; stubs: Record<string, boolean> }>('GET', '/api/health').catch(() => null);
  if (!health?.body.ok) { console.error(`Server is not answering at ${BASE}. Start it: npm run dev -w @ohh/server`); process.exit(2); }
  const stubs = Object.entries(health.body.stubs ?? {}).filter(([, v]) => v).map(([k]) => k);
  console.log(`Server ${BASE}; running on stubs: ${stubs.length ? stubs.join(', ') : 'none'}`);

  const created = await api<Ack<{ id: string }>>('POST', '/api/worlds', { name: 'Play check' });
  const W = created.body.ok ? created.body.data!.id : 'demo';
  await api('POST', `/api/worlds/${W}/clock`, { dayMs: DAY_MS, paused: false });
  console.log(`World ${W}, ${DAY_MS} ms per game day`);

  const packs = (await api<PackSet>('GET', '/api/packs')).body;
  const places = (await api<Place[]>('GET', '/api/places')).body;
  const city = (await api<CityView>('GET', `/api/worlds/${W}/view`)).body;
  const used = new Set(city.businesses.map((b) => b.placeId));
  const free = places.filter((p) => p.suitableFor.includes('cafe') && !used.has(p.id));
  const dist = (a: Place, b: Place) => Math.hypot((a.lat - b.lat) * 111_000, (a.lng - b.lng) * 84_000);
  const nearBarber = (p: Place) => city.businesses.find((b) => b.niche === 'barbershop' && b.status === 'open' && dist(p, places.find((x) => x.id === b.placeId)!) <= 380);
  const placeA = free.find((p) => nearBarber(p)) ?? free[0];
  const placeB = free.filter((p) => p.id !== placeA.id).sort((x, y) => dist(x, placeA) - dist(y, placeA))[0];
  check('two free cafe spaces on the map', !!placeA && !!placeB, `${placeA?.address} and ${placeB?.address}`);

  const join = async (name: string) => (await api<Ack<{ playerId: string; token: string }>>('POST', `/api/worlds/${W}/join`, { name, kind: 'owner' })).body;
  const alice = await join('Alice');
  const bob = await join('Bob');
  check('both owners join from their phones', alice.ok && bob.ok, alice.ok && bob.ok ? '' : `${alice.error ?? ''} ${bob.error ?? ''}`.trim());
  const A = alice.data!.token, B = bob.data!.token;
  const view = async (t: string) => (await api<ClientView>('GET', `/api/worlds/${W}/view`, undefined, t)).body as OwnerView;
  const act = async (t: string, a: unknown) => (await api<Ack>('POST', `/api/worlds/${W}/action`, a, t)).body;

  const open = async (t: string, place: Place, name: string) => {
    const rec = ((await api<Ack<OpenRecommendation[]>>('POST', `/api/worlds/${W}/query`, { type: 'recommend_opening', niche: 'cafe', placeId: place.id }, t)).body.data ?? [])[0];
    if (!rec) return { ok: false, error: 'no recommendation' } as Ack;
    const r = await act(t, { type: 'open_business', niche: 'cafe', placeId: place.id, name, kitId: rec.kitId, size: rec.size, items: rec.items });
    if (r.ok) await act(t, { type: 'set_orders', orders: rec.orders });
    return { ...r, data: rec } as Ack<OpenRecommendation>;
  };
  const oa = await open(A, placeA, 'Alice Coffee');
  const ob = await open(B, placeB, 'Bob Beans');
  check('each opens a cafe with the recommended kit', oa.ok && ob.ok, `${(oa.data as OpenRecommendation | undefined)?.kitId} kit, ${(oa.data as OpenRecommendation | undefined)?.size} seats; permit wait ${(oa.data as OpenRecommendation | undefined)?.daysToOpen} days`);
  const bobLaunch = await act(B, { type: 'launch' });
  check('Bob opens his doors before the permit is ready (a shortcut)', bobLaunch.ok);

  const aliceReady = await waitFor('Alice permit', async () => { const v = await view(A); return v.business?.permits.every((p) => p.readyDay <= v.world.day) ? v : null; });
  const aliceLaunch = aliceReady ? await act(A, { type: 'launch' }) : { ok: false };
  check('Alice waits for her permit and opens on time', !!aliceLaunch.ok, aliceReady ? `day ${aliceReady.world.day}` : '');

  const closed = await waitFor('month close', async () => { const [va, vb] = [await view(A), await view(B)]; return (va.business?.history.length ?? 0) >= 1 && (vb.business?.history.length ?? 0) >= 1 ? [va, vb] as const : null; });
  if (closed) {
    const [va, vb] = closed;
    const ra = va.business!.history[0], rb = vb.business!.history[0];
    check('the city runs and month 1 closes for both', true, `Alice ${money(ra.revenue)} sales / ${money(ra.profit)}; Bob ${money(rb.revenue)} sales / ${money(rb.profit)}`);
  } else check('the city runs and month 1 closes for both', false);

  const vb0 = await view(B);
  const bobBiz = vb0.business!;
  const report = packs.niches.cafe!.reports.find((r) => r.checks.some((c) => /permit/.test(c))) ?? packs.niches.cafe!.reports[0];
  const rep = await act(A, { type: 'report', targetBusinessId: bobBiz.id, reportId: report.id });
  check('Alice reports Bob to the city', rep.ok, rep.ok ? report.name : `${report.name}: ${rep.error}`);

  const notice = await waitFor('notice', async () => { const v = await view(B); return (v.notices ?? []).find((n) => n.status === 'notice') ?? null; });
  check('an inspection comes and Bob gets a fine notice', !!notice, notice ? `${money(notice.fine)} for ${notice.found.map((f) => f.violationId).join(', ')}` : '');
  if (notice) await act(B, { type: 'answer_notice', caseId: notice.caseId, response: 'pay' });
  const paid = await waitFor('fine paid', async () => { const v = await view(B); const n = (v.notices ?? []).find((x) => x.caseId === notice?.caseId); return n && n.outcome === 'fined' ? n : null; }, days(6));
  check('Bob pays the fine', !!paid, paid ? money(paid.fine) : '');

  const reopened = await waitFor('Bob reopens after the closure', async () => { const v = await view(B); return v.business?.status === 'open' ? v : null; }, days(10));
  if (reopened && (paid?.closureDays ?? 0) > 0) console.log(`  Bob was closed by the city for ${paid?.closureDays} days, open again on day ${reopened.world.day}`);
  const cross = await act(A, { type: 'propose_deal', toBusinessId: bobBiz.id, terms: { type: 'cross_promo', months: 2 } });
  let dealNote = '';
  let dealId: string | undefined;
  if (cross.ok) {
    dealId = (await view(A)).deals.find((d) => d.toBusinessId === bobBiz.id && d.status === 'proposed')?.id;
    dealNote = 'cross-promo';
  } else {
    const jp = await act(A, { type: 'propose_deal', toBusinessId: bobBiz.id, terms: { type: 'joint_purchase', months: 2 } });
    dealId = jp.ok ? (await view(A)).deals.find((d) => d.toBusinessId === bobBiz.id && d.status === 'proposed')?.id : undefined;
    dealNote = `cross-promo refused ("${cross.error}"), joint purchase instead`;
  }
  const accepted = dealId ? await act(B, { type: 'answer_deal', dealId, accept: true }) : { ok: false };
  check('Alice and Bob sign a deal', !!accepted.ok, dealNote);
  const barber = nearBarber(placeA);
  if (barber) {
    const pr = await act(A, { type: 'propose_deal', toBusinessId: barber.id, terms: { type: 'cross_promo', months: 2 } });
    const active = pr.ok ? await waitFor('cross-promo answer', async () => { const v = await view(A); return (v.deals ?? []).find((d: Deal) => d.toBusinessId === barber.id && d.status === 'active') ?? null; }, days(4)) : null;
    check('Alice signs a cross-promo with the barbershop next door', !!active, `${barber.name}${pr.ok ? '' : `: ${pr.error}`}`);
  } else check('Alice signs a cross-promo with the barbershop next door', false, 'no barbershop within 400 m');

  const [fa, fb] = [await view(A), await view(B)];
  const an = (v: OwnerView) => v.analytics ? `sales ${money(v.analytics.revenue)}/mo, profit ${money(v.analytics.profit)}/mo, break-even ${v.analytics.breakEvenUnitsMonth ?? '—'} orders, payback ${v.analytics.paybackMonths ?? '—'} months` : 'none';
  check('both see their analytics', !!fa.analytics && !!fb.analytics, `Alice: ${an(fa)}; Bob: ${an(fb)}`);

  if (W === 'demo') await api('POST', `/api/worlds/${W}/clock`, { dayMs: 2000 });
  const passed = checks.filter((c) => c.ok).length;
  console.log(`\nSection 10 check: ${passed}/${checks.length} passed on day ${fa.world.day} of world ${W}${stubs.length ? ` (stubs: ${stubs.join(', ')})` : ''}`);
  process.exit(passed === checks.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

import { distanceM, footfallParams } from '../../shared/src/index';
import type { AnchorKind, Place } from '../../shared/src/types';
import { cafe, canFit, CENT, main, metadata, places, round, RULES, save, simulate } from './harness';
import { loadProfiles } from './profiles';

main(() => {
  const source = loadProfiles();
  const { profiles } = source;
  const eligible = places.filter(p => canFit(p, profiles));
  const distance = (p: Place, kind: AnchorKind) => Math.min(Infinity, ...(p.anchors ?? []).filter(a => a.kind === kind).map(a => a.distM));
  const chosen = new Set<string>();
  const pick = (filter: (p: Place) => boolean, compare: (a: Place, b: Place) => number): Place => {
    const p = eligible.filter(p => !chosen.has(p.id) && filter(p)).sort((a, b) => compare(a, b) || a.id.localeCompare(b.id))[0];
    if (!p) throw new Error('No real affordable door fits all three profiles for a required area type; update data/selection, not the engine coefficients');
    chosen.add(p.id); return p;
  };
  // Selection uses place features only, never simulated returns. Keep categories honest: these are proxies.
  const locations = [
    { type: 'office', label: 'Office / commuter proxy',
      note: 'Nearest subway among affordable doors, without a college anchor. There are no measured office-worker shares in this dataset.',
      place: pick(p => !Number.isFinite(distance(p, 'college')) && Number.isFinite(distance(p, 'subway')), (a, b) => distance(a, 'subway') - distance(b, 'subway')) },
    { type: 'residential', label: 'Residential proxy',
      note: 'Lowest modelled footfall among affordable doors without college or museum anchors; not a measured resident share.',
      place: pick(p => !Number.isFinite(distance(p, 'college')) && !Number.isFinite(distance(p, 'museum')), (a, b) => a.pedestriansPerDay! - b.pedestriansPerDay!) },
    { type: 'tourist', label: 'Visitor / museum proxy',
      note: 'A museum within 150 m; choose highest modelled footfall among fitting doors, not a measured tourist share.',
      place: pick(p => distance(p, 'museum') <= 150, (a, b) => b.pedestriansPerDay! - a.pedestriansPerDay!) },
    { type: 'campus', label: 'Campus proxy',
      note: 'Nearest college anchor among remaining fitting doors; no measured student share.',
      place: pick(p => distance(p, 'college') <= 400, (a, b) => distance(a, 'college') - distance(b, 'college')) },
  ];
  const results = locations.map(location => {
    const rows = profiles.map(profile => ({ profile: profile.id,
      ...simulate([{ ...profile, place: location.place }]).summaries[0] }));
    // Survival precedes profit; otherwise going bankrupt early can appear better than paying the year's bills.
    const sorted = [...rows].sort((a, b) => Number(b.status !== 'bankrupt') - Number(a.status !== 'bankrupt') || b.profit - a.profit || a.profile.localeCompare(b.profile));
    const best = sorted[0];
    const winners = rows.filter(r => (r.status === 'bankrupt') === (best.status === 'bankrupt') && Math.abs(r.profit - best.profit) < CENT).map(r => r.profile);
    const profile = profiles.find(p => p.id === best.profile)!;
    const radius = footfallParams(cafe)?.radiusM;
    if (!radius) throw new Error('Missing local competition radius');
    const neighbor = places.filter(p => p.id !== location.place.id && canFit(p, [profile], true) && distanceM(location.place, p) < radius)
      .sort((a, b) => distanceM(location.place, a) - distanceM(location.place, b) || a.id.localeCompare(b.id))[0];
    if (!neighbor) return { ...location, rows, winners, copy: { pass: false, error: 'No affordable neighboring door within the competition radius' } };
    // Separate operating competition from renovation insolvency: the public resident initializer gives both
    // scenarios the same mature original and puts an established copy on the nearest feasible real door.
    const solo = simulate([{ ...profile, place: location.place }], 90, undefined, true).summaries[0];
    const copyRun = simulate([{ ...profile, label: 'Original', place: location.place }, { ...profile, label: 'Copy', place: neighbor }], 90, undefined, true);
    const [original, copy] = copyRun.summaries;
    // Compare matched full calendar months while both shops in the copying world are open.
    const startDay = Math.max(original.openedDay ?? Infinity, copy.openedDay ?? Infinity);
    const endDay = Math.min(original.bankruptDay ?? Infinity, copy.bankruptDay ?? Infinity, solo.bankruptDay ?? Infinity, 90);
    const months = original.months.filter(m => (m.month - 1) * RULES.DAYS_PER_MONTH + 1 >= startDay && m.month * RULES.DAYS_PER_MONTH <= endDay)
      .map(m => m.month);
    const baselineProfit = round(solo.months.filter(m => months.includes(m.month)).reduce((s, m) => s + m.profit, 0));
    const copiedProfit = round(original.months.filter(m => months.includes(m.month)).reduce((s, m) => s + m.profit, 0));
    return { ...location, rows, winners, copy: {
      pass: months.length > 0 && copiedProfit < baselineProfit - CENT,
      note: 'Separate 90-day operating competition probe: both shops are established via the public openEstablished API. The baseline original is identically established. Each pays the engine resident setup cost; no manual capital injection. Compare matching full calendar months through the first bankruptcy close. Month 1 contains 29 ticks in both worlds.',
      neighbor, distanceM: round(distanceM(location.place, neighbor)), months, baselineProfit, copiedProfit,
      daySamples: copyRun.w.businesses.map(b => ({ business: b.name, days: b.days.slice(-3) })),
      solo, original, copy,
    } };
  });
  const universalWinners = profiles.filter(p => results.every(r => r.winners.includes(p.id))).map(p => p.id);
  const noSurvivor = results.filter(r => r.rows.every(row => row.status === 'bankrupt')).map(r => r.type);
  const failures = [
    ...universalWinners.map(p => `One profile wins or ties everywhere: ${p}`),
    ...results.filter(r => !r.copy.pass).map(r => `Copy does not demonstrably reduce original profit: ${r.type}`),
    ...noSurvivor.map(type => `No profile survives the year: ${type}`),
  ];
  console.table(results.flatMap(r => r.rows.map(row => ({ area: r.type, door: r.place.id, profile: row.profile,
    winner: r.winners.includes(row.profile), status: row.status, profit: row.profit, cash: row.cash, netWorth: row.netWorth, served: row.served }))));
  console.table(results.map(r => ({ area: r.type, originalDoor: r.place.id, copyDoor: r.copy.neighbor?.id ?? '-',
    baselineProfit: 'baselineProfit' in r.copy ? r.copy.baselineProfit : null, withCopy: 'copiedProfit' in r.copy ? r.copy.copiedProfit : null,
    pass: r.copy.pass })));
  for (const failure of failures) console.log(`FAIL ${failure}`);
  if (!failures.length) console.log('PASS: location changes the winning profile, and copies reduce the original profit.');
  save('results.json', { metadata: metadata({ profileSource: source.source, provisional: source.provisional,
    selectionSource: 'data/places.json; anchor distances and modelled footfall; classification is an audit estimate',
    ranking: 'Surviving profiles first, then cumulative reported profit over the year; ties within one cent count as shared winners.' }),
    profiles, universalWinners, failures, pass: failures.length === 0, results });
  process.exitCode = failures.length ? 1 : 0;
});

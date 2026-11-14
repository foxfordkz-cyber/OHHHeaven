// NYC weather without network: a deterministic daily series built from Central Park climate normals.
// Same (seed, day) always gives the same weather, whatever window it is asked in.
import climate from './data/nyc-climate.json';
import { RULES, type DayWeather, type WeatherCondition } from './shared';
import { normal, shuffle, stream } from './rng';

const DAYS = RULES.DAYS_PER_MONTH; // game months have 30 days
const MONTHS = 12;

export const FOOT_TRAFFIC_MULT: Record<WeatherCondition, number> = climate.footTrafficMult.values as Record<WeatherCondition, number>;

interface MonthPlan { conditions: WeatherCondition[]; anomaly: number[]; heatTemps: number[] }

/** Scales a normal for a real calendar month to a 30-day game month. */
function perGameMonth(values: number[], m: number): number {
  return (values[m] * DAYS) / climate.daysInMonth[m];
}

/** Rounds x up with probability equal to its fraction, so the long-run average equals x. */
function probRound(x: number, r: () => number): number {
  const base = Math.floor(x);
  return base + (r() < x - base ? 1 : 0);
}

const planCache = new Map<string, MonthPlan>();

function monthPlan(seed: number, year: number, m: number): MonthPlan {
  const key = `${seed}:${year}:${m}`;
  const cached = planCache.get(key);
  if (cached) return cached;
  const r = stream(seed, 'weather', year, m);

  const wet = Math.min(DAYS, probRound(perGameMonth(climate.precipDays.values, m), r));
  const storm = Math.min(wet, probRound(perGameMonth(climate.stormDays.values, m), r));
  // Winter storms are snowstorms: they use part of the month's snow budget.
  const winter = m === 11 || m <= 2;
  const snowNorm = perGameMonth(climate.snowDays.values, m) - (winter ? storm : 0);
  const snow = Math.min(wet - storm, probRound(Math.max(0, snowNorm), r));
  const rain = wet - storm - snow;
  const dry = DAYS - wet;
  const heat = Math.min(dry, probRound(perGameMonth(climate.hotDays.values, m), r));
  const cloudy = probRound((dry - heat) * climate.cloudyShareOfDryDays.value, r);
  const clear = dry - heat - cloudy;

  // Heat comes in waves: put hot days in one run, the rest of the month is shuffled.
  const conditions: WeatherCondition[] = new Array(DAYS);
  const heatStart = heat > 0 ? Math.floor(r() * (DAYS - heat + 1)) : -1;
  const rest: WeatherCondition[] = [
    ...Array<WeatherCondition>(storm).fill('storm'),
    ...Array<WeatherCondition>(snow).fill('snow'),
    ...Array<WeatherCondition>(rain).fill('rain'),
    ...Array<WeatherCondition>(cloudy).fill('cloudy'),
    ...Array<WeatherCondition>(clear).fill('clear'),
  ];
  shuffle(rest, r);
  let k = 0;
  for (let d = 0; d < DAYS; d++) {
    conditions[d] = heatStart >= 0 && d >= heatStart && d < heatStart + heat ? 'heat' : rest[k++];
  }

  // Temperature anomaly: AR(1) so warm and cold spells last a few days (NYC daily sd of highs is several °F; estimate 5 °F).
  const anomaly: number[] = [];
  let a = normal(r) * 4;
  for (let d = 0; d < DAYS; d++) {
    a = 0.65 * a + normal(r) * 3.8;
    anomaly.push(a);
  }
  const heatTemps = Array.from({ length: DAYS }, () => 90 + Math.floor(r() * 7));

  const plan = { conditions, anomaly, heatTemps };
  if (planCache.size > 512) planCache.clear();
  planCache.set(key, plan);
  return plan;
}

/** Normal daily high for a game day, interpolated between month midpoints (cyclic). */
export function normalHighF(day: number): number {
  const d = Math.max(1, Math.floor(day));
  const m = Math.floor((d - 1) / DAYS) % MONTHS;
  const pos = m + ((d - 1) % DAYS + 0.5) / DAYS - 0.5; // month index of this day relative to month midpoints
  const lo = Math.floor(pos);
  const t = pos - lo;
  const v = climate.tmaxF.values;
  const a = v[((lo % MONTHS) + MONTHS) % MONTHS];
  const b = v[(((lo + 1) % MONTHS) + MONTHS) % MONTHS];
  return a + (b - a) * t;
}

const LABEL: Record<WeatherCondition, string> = {
  clear: 'Sunny', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow', heat: 'Heat', storm: 'Storm',
};

function stormLabel(m: number, tempF: number): string {
  if (tempF <= 34) return 'Snowstorm';
  if (m >= 4 && m <= 8) return 'Thunderstorms';
  return "Nor'easter";
}

/** Weather of one game day. */
export function weatherOn(seed: number, day: number): DayWeather {
  const d = Math.max(1, Math.floor(day));
  const year = Math.floor((d - 1) / (DAYS * MONTHS));
  const m = Math.floor((d - 1) / DAYS) % MONTHS;
  const i = (d - 1) % DAYS;
  const plan = monthPlan(seed, year, m);
  const condition = plan.conditions[i];

  let t = normalHighF(d) + plan.anomaly[i];
  if (condition === 'rain') t -= 3;
  if (condition === 'cloudy') t -= 1;
  if (condition === 'clear') t += 1;
  if (condition === 'snow') t = Math.min(t, 34 - Math.abs(plan.anomaly[i]) * 0.3);
  if (condition === 'storm' && (m === 11 || m <= 2)) t = Math.min(t, 33);
  if (condition === 'heat') t = Math.min(100, Math.max(t, plan.heatTemps[i]));
  if (condition !== 'heat') t = Math.min(t, 89); // only heat days reach 90 °F
  const tempF = Math.round(t);

  const name = condition === 'storm' ? stormLabel(m, tempF) : condition === 'rain' && tempF <= 33 ? 'Sleet' : LABEL[condition];
  return { day: d, tempF, condition, footTrafficMult: FOOT_TRAFFIC_MULT[condition], label: `${name}, ${tempF}°F` };
}

/** CONTRACT §8: weather for `days` game days starting at `fromDay`. Pure, no network. */
export function forecast(seed: number, fromDay: number, days: number): DayWeather[] {
  const n = Math.max(0, Math.floor(days));
  const start = Math.max(1, Math.floor(fromDay));
  return Array.from({ length: n }, (_, k) => weatherOn(seed, start + k));
}

// Example data for /dev/map and /dev/city. Business names are made up; places are data/places.json.
import placesJson from '../../../data/places.json';
import realJson from '../../../data/real-businesses.json';
import type { BlockFundStatus, DayWeather, GameEvent, NicheId, Place, PublicBusiness } from '@ohh/shared/types';
import type { RealBusinessLabel } from './geo';

export const places = placesJson as Place[];
export const realBusinesses = realJson as RealBusinessLabel[];

const NAMES: Record<NicheId, string[]> = {
  cafe: ['Night Owl Coffee', 'Bean Republic', 'Tompkins Roast', 'Cup & Ledger', 'Alphabet Espresso', 'Second Shot', 'Little Grind', 'Daybreak Café', 'First Pour', 'Steam Room', 'Corner Crema', 'Slow Drip', 'Avenue Brew', 'Ninth Street Cup', 'Latte Lab', 'Copper Kettle'],
  barbershop: ['Fade Factory', 'Sharp & Co', 'Ave B Barbers', 'Clean Cut Club', 'Razor Row', 'Blade Runner Barbers', 'The Chair', 'Fresh Lines', 'Union Cuts', 'Lower East Fade', 'Hot Towel', 'Kings of Seventh'],
  bodega: ['24/7 Deli & Grocery', 'Avenue C Market', 'Sunrise Bodega'],
  guesthouse: ['Ninth Street Rooms', 'Tompkins Guesthouse'],
  rentals: ['Fifth Street Flats', 'Eleventh Walk-up', 'Twelfth Street Homes'],
};
const OWNERS = ['Maya R.', 'Jordan P.', 'Sam K.', 'Ana L.', 'Dev S.', 'Chris W.', 'Lena M.', 'Omar H.', 'Priya N.', 'Theo B.'];

function pickPlaces(niche: NicheId, count: number, offset: number): Place[] {
  const fit = places.filter((p) => p.suitableFor.includes(niche));
  const out: Place[] = [];
  for (let i = 0; out.length < count && i < fit.length * 3; i++) {
    const p = fit[(offset + i * 7) % fit.length];
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

function build(): PublicBusiness[] {
  const used = new Set<string>();
  const list: PublicBusiness[] = [];
  const plan: [NicheId, number, number][] = [['cafe', 16, 0], ['barbershop', 12, 3], ['bodega', 3, 5], ['guesthouse', 2, 0], ['rentals', 3, 1]];
  for (const [niche, count, offset] of plan) {
    const spots = pickPlaces(niche, count * 2, offset).filter((p) => !used.has(p.id)).slice(0, count);
    spots.forEach((p, i) => {
      used.add(p.id);
      const isAi = i % 3 !== 0;
      list.push({
        id: `b-${niche}-${i + 1}`, name: NAMES[niche][i % NAMES[niche].length],
        ownerName: isAi ? 'AI resident' : OWNERS[(i + offset) % OWNERS.length], isAi, niche, placeId: p.id,
        status: 'open', price: niche === 'cafe' ? 5.5 + (i % 4) * 0.25 : niche === 'barbershop' ? 38 + (i % 5) * 4 : 0,
        reputation: Math.round((0.55 + ((i * 37) % 40) / 100) * 100) / 100, rankInNiche: i + 1,
        trust: { kept: (i * 3) % 5, broken: i % 7 === 6 ? 1 : 0 }, partners: [],
      });
    });
  }
  const set = (id: string, patch: Partial<PublicBusiness>) => { const b = list.find((x) => x.id === id); if (b) Object.assign(b, patch); };
  set('b-cafe-14', { status: 'closed' });
  set('b-cafe-16', { status: 'bankrupt' });
  set('b-barbershop-12', { status: 'bankrupt' });
  set('b-cafe-15', { status: 'setup' });
  const pair = (a: string, b: string) => { list.find((x) => x.id === a)?.partners.push(b); list.find((x) => x.id === b)?.partners.push(a); };
  pair('b-cafe-1', 'b-barbershop-1');
  pair('b-cafe-2', 'b-cafe-5');
  pair('b-cafe-4', 'b-barbershop-4');
  pair('b-barbershop-2', 'b-bodega-1');
  return list;
}

export const businesses: PublicBusiness[] = build();
export const myBusinessId = 'b-cafe-4';
export const day = 43;

export const weather: DayWeather[] = [
  { day: 43, tempF: 41, condition: 'rain', footTrafficMult: 0.82, label: 'Cold rain' },
  { day: 44, tempF: 38, condition: 'cloudy', footTrafficMult: 0.95, label: 'Overcast' },
  { day: 45, tempF: 33, condition: 'snow', footTrafficMult: 0.7, label: 'Snow showers' },
  { day: 46, tempF: 36, condition: 'clear', footTrafficMult: 1, label: 'Clear and cold' },
  { day: 47, tempF: 40, condition: 'clear', footTrafficMult: 1.02, label: 'Sunny' },
  { day: 48, tempF: 44, condition: 'cloudy', footTrafficMult: 0.97, label: 'Clouds' },
  { day: 49, tempF: 47, condition: 'clear', footTrafficMult: 1.05, label: 'Mild' },
  { day: 50, tempF: 45, condition: 'rain', footTrafficMult: 0.85, label: 'Showers' },
];

export const events: GameEvent[] = [
  {
    id: 'evt-street-work', kind: 'traffic', title: 'St Marks Pl closed for street work',
    text: 'Con Ed street work closes St Marks Pl between 2nd and 3rd Ave to traffic; fewer people walk the block.',
    announcedDay: 40, startDay: 42, endDay: 45, origin: 'deck', block: 'St Marks Pl, 2nd–3rd Ave',
    effects: [{ target: 'footTraffic', mult: 0.7 }],
  },
  {
    id: 'evt-coffee', kind: 'supply', title: 'Coffee bean prices up 12%',
    text: 'Wholesale arabica prices rose this month; every café pays more per cup.',
    announcedDay: 41, startDay: 44, endDay: 60, origin: 'ai',
    effects: [{ target: 'cogs', mult: 1.12, niches: ['cafe'] }],
  },
];

export const blockFunds: BlockFundStatus[] = [
  { block: 'Ave A, E 7th–E 10th St', month: 2, contributors: 4, eligible: 6, active: true, feeMonth: 300 },
  { block: 'E 9th St, 1st–2nd Ave', month: 2, contributors: 1, eligible: 4, active: false, feeMonth: 300 },
];

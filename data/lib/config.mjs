// Source tables for data/fetch-places.mjs. Every number here has a source or is marked estimate.

/** Subway stations around the East Village. Coordinates: MTA GTFS stops. Annual ridership: the
 *  network run recomputes it from data.ny.gov wujg-7c2s (2024); the values below are a fallback,
 *  pre-pandemic order of magnitude, marked estimate. */
export const STATIONS = [
  { id: 'union-sq', name: '14 St–Union Sq', lat: 40.735236, lng: -73.990341, rides: 32_000_000, confidence: 'estimate' },
  { id: '3-av', name: '3 Av (L)', lat: 40.732849, lng: -73.986122, rides: 4_500_000, confidence: 'estimate' },
  { id: '1-av', name: '1 Av (L)', lat: 40.730953, lng: -73.981628, rides: 8_000_000, confidence: 'estimate' },
  { id: 'astor-pl', name: 'Astor Pl (6)', lat: 40.730054, lng: -73.99107, rides: 5_400_000, confidence: 'estimate' },
  { id: '8-st-nyu', name: '8 St–NYU (R/W)', lat: 40.730328, lng: -73.992629, rides: 4_700_000, confidence: 'estimate' },
  { id: 'bleecker', name: 'Bleecker St / Broadway–Lafayette', lat: 40.725606, lng: -73.995432, rides: 12_000_000, confidence: 'estimate' },
  { id: '2-av', name: '2 Av (F)', lat: 40.723402, lng: -73.989938, rides: 5_300_000, confidence: 'estimate' },
  { id: 'delancey', name: 'Delancey St–Essex St', lat: 40.718611, lng: -73.988114, rides: 7_300_000, confidence: 'estimate' },
];

/** footTraffic = 0.1 + 0.9 × S / S_max, S = Σ sqrt(rides_i / rides_max) × exp(−d_i / FOOT_DECAY_M). */
export const FOOT_DECAY_M = 400;

/** Asking rent, $ per sq ft per year, for a ~1,000 sq ft ground-floor space. Anchors are real listings
 *  (2024–2026); corridor values are estimates built on them. */
export const CORRIDOR_RENT = {
  'St Marks Pl': { rent: 115, why: 'anchor: 4 St Marks Pl, $21,500/mo per 2,500 sq ft level ≈ $103/sq ft (Meridian Capital listing); smaller spaces price higher' },
  '1st Ave': { rent: 125, why: 'anchor: 199 1st Ave, $12,500/mo for 1,000 sq ft ≈ $150/sq ft (LoopNet, 2025)' },
  '2nd Ave': { rent: 120, why: 'estimate: same tier as 1st Ave; no priced 2nd Ave listing found' },
  'Ave A': { rent: 115, why: 'anchor: 199 Ave A asked $260/sq ft (2024, small space, outlier); 111 E 7th St from $120/sq ft nearby' },
  'Ave A · Tompkins': { rent: 125, why: 'estimate: Tompkins Square Park frontage premium over Ave A' },
  'Ave B': { rent: 80, why: 'estimate: between Ave A and Ave C; Ave B listings are rate-on-request' },
  'Ave C': { rent: 60, why: 'anchor: 40 Ave C, $11,000/mo for 2,400 sq ft ≈ $55/sq ft (EV Grieve, Aug 2026)' },
  'side · west': { rent: 100, why: 'anchor: 111 E 7th St from $120/sq ft; 201 E 10th St $7,500/mo for 400 sq ft ≈ $225/sq ft (tiny space)' },
  'side · east': { rent: 90, why: 'estimate: side streets between 1st Ave and Ave A, a step below the avenues' },
  'E 4th St': { rent: 85, why: 'estimate: theater block, fewer storefronts' },
  building: { rent: 55, why: 'estimate: whole walk-up building lease for guesthouse or rentals, per sq ft of building area' },
};

/** Tier by rent: prime ≥ 110, mid 75–110, cheap < 75 ($/sq ft/yr). */
export const TIER_LIMITS = { prime: 110, mid: 75 };

export const SOURCES = {
  storefronts: { id: '92iy-9c3n', title: 'Storefronts Reported Vacant or Not (Local Law 157 of 2019), NYC Department of Finance', url: 'https://data.cityofnewyork.us/d/92iy-9c3n' },
  restaurants: { id: '43nn-pn8j', title: 'DOHMH New York City Restaurant Inspection Results', url: 'https://data.cityofnewyork.us/d/43nn-pn8j' },
  businesses: { id: 'w7w3-xahh', title: 'Legally Operating Businesses (DCWP)', url: 'https://data.cityofnewyork.us/d/w7w3-xahh' },
  pluto: { id: '64uk-42ks', title: 'Primary Land Use Tax Lot Output (PLUTO), NYC Department of City Planning', url: 'https://data.cityofnewyork.us/d/64uk-42ks' },
  ridership: { id: 'wujg-7c2s', title: 'MTA Subway Hourly Ridership: 2020–2024 (data.ny.gov)', url: 'https://data.ny.gov/d/wujg-7c2s' },
};

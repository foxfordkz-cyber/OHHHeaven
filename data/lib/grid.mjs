// Manhattan street grid model for the East Village (no dependencies).
// Calibrated on MTA GTFS station points (1 Av L, 3 Av L, 2 Av F) and Tompkins Square Park.
// s = street number (0 = E Houston St, 14 = E 14th St), a = avenue index (-2 = 3rd Ave/Bowery, -1 = 2nd Ave,
// 0 = 1st Ave, 1 = Ave A, 2 = Ave B, 3 = Ave C, 4 = Ave D). Error is about 20–40 m.

export const ORIGIN = { lat: 40.731168, lng: -73.982316 }; // 1st Ave & E 14th St
export const STREET_M = 77.5;   // centerline spacing between numbered streets
export const AVENUE_M = 217;    // centerline spacing between avenues
const BEARING_DEG = 29;         // avenues run 29° east of true north
const M_PER_DEG_LAT = 111_040;
const M_PER_DEG_LNG = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

const rad = (BEARING_DEG * Math.PI) / 180;
const U = { n: Math.cos(rad), e: Math.sin(rad) };      // north along an avenue
const V = { n: -Math.sin(rad), e: Math.cos(rad) };     // east along a street

/** Grid coordinates (+ optional offsets in meters along U and V) → lat/lng. */
export function toLatLng(s, a, offU = 0, offV = 0) {
  const du = (s - 14) * STREET_M + offU;
  const dv = a * AVENUE_M + offV;
  const north = du * U.n + dv * V.n;
  const east = du * U.e + dv * V.e;
  return {
    lat: round6(ORIGIN.lat + north / M_PER_DEG_LAT),
    lng: round6(ORIGIN.lng + east / M_PER_DEG_LNG),
  };
}

/** lat/lng → grid coordinates { s, a }. */
export function toGrid(lat, lng) {
  const north = (lat - ORIGIN.lat) * M_PER_DEG_LAT;
  const east = (lng - ORIGIN.lng) * M_PER_DEG_LNG;
  const du = north * U.n + east * U.e;
  const dv = north * V.n + east * V.e;
  return { s: 14 + du / STREET_M, a: dv / AVENUE_M };
}

/** Distance in meters between two lat/lng points (equirectangular, fine at city scale). */
export function distanceM(p, q) {
  const dn = (p.lat - q.lat) * M_PER_DEG_LAT;
  const de = (p.lng - q.lng) * M_PER_DEG_LNG;
  return Math.hypot(dn, de);
}

/** East Village bounds in grid space: E Houston St – E 14th St, Bowery/3rd Ave – Ave D. */
export const DISTRICT = { sMin: -0.4, sMax: 14.3, aMin: -2.35, aMax: 4.4 };

export function insideDistrict(lat, lng) {
  const { s, a } = toGrid(lat, lng);
  return s >= DISTRICT.sMin && s <= DISTRICT.sMax && a >= DISTRICT.aMin && a <= DISTRICT.aMax;
}

/** District outline as [lng, lat] ring (for maps and checks). */
export function districtRing() {
  const { sMin, sMax, aMin, aMax } = DISTRICT;
  const c = [toLatLng(sMin, aMin), toLatLng(sMax, aMin), toLatLng(sMax, aMax), toLatLng(sMin, aMax)];
  return [...c, c[0]].map((p) => [p.lng, p.lat]);
}

export const AVENUES = { '3rd Ave': -2, Bowery: -2.1, '2nd Ave': -1, '1st Ave': 0, 'Ave A': 1, 'Ave B': 2, 'Ave C': 3, 'Ave D': 4 };

export function avenueName(a) {
  const names = { '-2': '3rd Ave', '-1': '2nd Ave', 0: '1st Ave', 1: 'Ave A', 2: 'Ave B', 3: 'Ave C', 4: 'Ave D' };
  return names[String(Math.round(a))] ?? 'Ave D';
}

export function streetName(s, a = 0) {
  const n = Math.round(s);
  if (n <= 0) return 'E Houston St';
  if (n === 8 && a < 1.05) return 'St Marks Pl';
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `E ${n}${suffix} St`;
}

function round6(x) { return Math.round(x * 1e6) / 1e6; }

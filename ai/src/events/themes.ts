// Whitelist of event themes. The deck uses them, and the AI may only pick from them (CONTRACT §8: effects only
// from EffectTarget with mult 0.7–1.3). Each theme narrows targets, ranges, months and scope.
import type { EffectTarget, GameEvent, WeatherCondition } from '../shared';

export const MULT_MIN = 0.7;
export const MULT_MAX = 1.3;
export const MAX_EVENT_DAYS = 30;
export const MAX_START_AHEAD_DAYS = 28;   // "the next few weeks"

export interface Theme {
  id: string;
  kind: GameEvent['kind'];
  label: string;                          // what the model reads
  months: number[];                       // allowed game months (1–12) for any day of the event
  targets: Partial<Record<EffectTarget, [number, number]>>;
  scopes: ('city' | 'block')[];
  maxDays: number;
  weather?: WeatherCondition[];           // at least one forecast day in the window must match, when the window is forecast
}

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const WINTER = [12, 1, 2, 3];
const SUMMER = [6, 7, 8];
const WARM = [5, 6, 7, 8, 9];

export const THEMES: Theme[] = [
  { id: 'snowstorm', kind: 'weather', label: 'Heavy snow or a winter storm', months: WINTER, targets: { staffAvailability: [0.7, 0.95], deliveryShare: [1, 1.3], footTraffic: [0.75, 1], utilities: [1, 1.15] }, scopes: ['city'], maxDays: 3, weather: ['snow', 'storm'] },
  { id: 'cold_snap', kind: 'weather', label: 'A run of freezing days', months: [11, 12, 1, 2, 3], targets: { footTraffic: [0.85, 1], demand: [0.9, 1.1], utilities: [1, 1.15] }, scopes: ['city'], maxDays: 5 },
  { id: 'heat_wave', kind: 'weather', label: 'Heat wave or heat advisory', months: WARM, targets: { utilities: [1, 1.2], footTraffic: [0.85, 1], staffAvailability: [0.85, 1], demand: [0.9, 1.1] }, scopes: ['city'], maxDays: 5, weather: ['heat'] },
  { id: 'heavy_rain', kind: 'weather', label: 'All-day heavy rain', months: ALL, targets: { deliveryShare: [1, 1.25], footTraffic: [0.85, 1] }, scopes: ['city'], maxDays: 2, weather: ['rain', 'storm'] },
  { id: 'thunderstorms', kind: 'weather', label: 'Severe thunderstorms', months: [5, 6, 7, 8, 9], targets: { staffAvailability: [0.8, 1], deliveryShare: [1, 1.2], footTraffic: [0.8, 1] }, scopes: ['city'], maxDays: 2, weather: ['storm', 'rain'] },
  { id: 'nice_weather', kind: 'weather', label: 'Warm sunny days that bring people outside', months: [3, 4, 5, 6, 9, 10], targets: { footTraffic: [1, 1.15] }, scopes: ['city'], maxDays: 3, weather: ['clear'] },
  { id: 'noreaster', kind: 'weather', label: "A nor'easter with wind and rain", months: [1, 2, 3, 4, 10, 11, 12], targets: { staffAvailability: [0.8, 1], utilities: [1, 1.1], footTraffic: [0.85, 1] }, scopes: ['city'], maxDays: 3, weather: ['storm', 'rain', 'snow'] },
  { id: 'subway_closure', kind: 'traffic', label: 'Planned subway suspension near one street', months: ALL, targets: { footTraffic: [0.75, 0.95] }, scopes: ['block'], maxDays: 4 },
  { id: 'street_works', kind: 'traffic', label: 'Street or utility work closing part of one street', months: [3, 4, 5, 6, 7, 8, 9, 10, 11], targets: { footTraffic: [0.8, 0.98], deliveryShare: [0.8, 1] }, scopes: ['block'], maxDays: 10 },
  { id: 'gridlock', kind: 'traffic', label: 'Citywide gridlock days (big conferences, holidays)', months: ALL, targets: { deliveryShare: [0.8, 1], staffAvailability: [0.9, 1], footTraffic: [0.95, 1.1] }, scopes: ['city'], maxDays: 14 },
  { id: 'delivery_costs', kind: 'traffic', label: 'Tolls or road costs passed on by suppliers', months: ALL, targets: { cogs: [1, 1.05] }, scopes: ['city'], maxDays: 30 },
  { id: 'car_free_street', kind: 'traffic', label: 'A street closed to cars for people (Open Streets, Summer Streets)', months: [4, 5, 6, 7, 8, 9, 10], targets: { footTraffic: [1, 1.2] }, scopes: ['block'], maxDays: 3 },
  { id: 'big_event', kind: 'city', label: 'A big public event: marathon, fireworks, tournament', months: ALL, targets: { footTraffic: [0.95, 1.15], deliveryShare: [0.75, 1], staffAvailability: [0.85, 1] }, scopes: ['city'], maxDays: 21 },
  { id: 'parade', kind: 'city', label: 'A parade with street closures', months: ALL, targets: { footTraffic: [1, 1.15], deliveryShare: [0.8, 1] }, scopes: ['city', 'block'], maxDays: 1 },
  { id: 'coffee_prices', kind: 'supply', label: 'Coffee bean prices move', months: ALL, targets: { cogs: [0.92, 1.12] }, scopes: ['city'], maxDays: 30 },
  { id: 'dairy_prices', kind: 'supply', label: 'Milk and dairy prices move', months: ALL, targets: { cogs: [0.95, 1.08] }, scopes: ['city'], maxDays: 30 },
  { id: 'food_prices', kind: 'supply', label: 'Food ingredient prices move (eggs, sugar, flour)', months: ALL, targets: { cogs: [0.95, 1.06] }, scopes: ['city'], maxDays: 30 },
  { id: 'energy_prices', kind: 'supply', label: 'Electricity or gas bills move', months: ALL, targets: { utilities: [0.9, 1.15] }, scopes: ['city'], maxDays: 30 },
  { id: 'fuel_prices', kind: 'supply', label: 'Diesel and delivery fuel surcharges', months: ALL, targets: { cogs: [0.98, 1.04] }, scopes: ['city'], maxDays: 30 },
  { id: 'tourism', kind: 'city', label: 'More visitors in town', months: [4, 5, 6, 7, 8, 9, 10, 11, 12], targets: { footTraffic: [1, 1.12], demand: [1, 1.08] }, scopes: ['city'], maxDays: 30 },
  { id: 'dining_promo', kind: 'city', label: 'A citywide dining promotion', months: [1, 2, 7, 8], targets: { footTraffic: [1, 1.08], demand: [1, 1.06] }, scopes: ['city'], maxDays: 24 },
  { id: 'holiday_season', kind: 'city', label: 'Holiday markets and holiday shopping', months: [10, 11, 12, 1], targets: { footTraffic: [1, 1.12], demand: [1, 1.1] }, scopes: ['city'], maxDays: 30 },
  { id: 'school_calendar', kind: 'city', label: 'School start or school break', months: [1, 2, 4, 6, 9, 12], targets: { staffAvailability: [0.9, 1.05], footTraffic: [0.95, 1.05] }, scopes: ['city'], maxDays: 10 },
  { id: 'street_fair', kind: 'city', label: 'A permitted street fair on one street', months: [4, 5, 6, 7, 8, 9, 10], targets: { footTraffic: [1, 1.25] }, scopes: ['block'], maxDays: 2 },
  { id: 'outdoor_dining', kind: 'city', label: 'Outdoor dining season', months: [4, 5, 6, 7, 8, 9, 10], targets: { demand: [1, 1.06] }, scopes: ['city'], maxDays: 14 },
  { id: 'labor_rules', kind: 'regulation', label: 'Wage or labor rule news (information only)', months: ALL, targets: {}, scopes: ['city'], maxDays: 7 },
  { id: 'health_rules', kind: 'regulation', label: 'Health inspection news (information only)', months: ALL, targets: {}, scopes: ['city'], maxDays: 7 },
  { id: 'sanitation_rules', kind: 'regulation', label: 'Sanitation rule news (information only)', months: ALL, targets: {}, scopes: ['city'], maxDays: 7 },
  { id: 'sick_season', kind: 'staff', label: 'Seasonal colds and flu among staff', months: [11, 12, 1, 2, 3], targets: { staffAvailability: [0.85, 1] }, scopes: ['city'], maxDays: 14 },
];

export const THEME_BY_ID = new Map(THEMES.map(t => [t.id, t]));

/** Words that never appear in a game event (PROTOCOL §12, report 44 black list). */
export const BANNED = /\b(dead|death|deaths|die[sd]?|dying|kill(ed|s|ing)?|fatal(ity|ities)?|injur(y|ies|ed)|victims?|casualt(y|ies)|wars?|warfare|military|army|attacks?|terror\w*|shoot(ing|er)s?|gun(fire|man)?|bomb(s|ing)?|explosions?|disasters?|catastroph\w*|hurricanes?|tornado(es)?|earthquakes?|tsunamis?|floods?|flooding|wildfires?|blaze|pandemic|epidemic|outbreak|riots?|protests?|elections?|hostages?|murder\w*|crimes?|arrest\w*|hospitali[sz]\w*|evacuat\w*|emergency rooms?)\b/i;

/** Season words that make an event implausible outside their months. */
export const SEASON_WORDS: { re: RegExp; months: number[] }[] = [
  { re: /\b(snow\w*|blizzards?|sleet|ice storms?|icy|freez\w*|frost\w*|frigid|arctic|winter storms?|nor'?easters? with snow)\b/i, months: [11, 12, 1, 2, 3, 4] },
  { re: /\b(heat ?waves?|heat advisor\w*|scorch\w*|swelter\w*|hottest|cooling centers?)\b/i, months: [5, 6, 7, 8, 9] },
  { re: /\b(holiday markets?|christmas|winter village|tree lighting)\b/i, months: [10, 11, 12, 1] },
  { re: /\b(summer streets|beach|pool season|iced coffee season)\b/i, months: [5, 6, 7, 8, 9] },
];

export const monthOfDay = (day: number): number => Math.floor((Math.max(1, day) - 1) / 30) % 12 + 1;

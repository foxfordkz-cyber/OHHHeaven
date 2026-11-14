import { describe, expect, it } from 'vitest';
import climate from '../src/data/nyc-climate.json';
import { FOOT_TRAFFIC_MULT, forecast, normalHighF, weatherOn } from '../src/weather';

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const monthOf = (day: number) => Math.floor((day - 1) / 30);

describe('forecast', () => {
  it('is deterministic for the same seed', () => {
    expect(forecast(42, 1, 360)).toEqual(forecast(42, 1, 360));
  });

  it('gives the same day the same weather in any window', () => {
    const year = forecast(9, 1, 360);
    expect(forecast(9, 200, 7)).toEqual(year.slice(199, 206));
    expect(weatherOn(9, 33)).toEqual(year[32]);
  });

  it('differs between seeds', () => {
    expect(forecast(1, 1, 60)).not.toEqual(forecast(2, 1, 60));
  });

  it('returns exactly the requested days and handles bad input', () => {
    expect(forecast(1, 5, 7).map(w => w.day)).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(forecast(1, 1, 0)).toEqual([]);
    expect(forecast(1, -3, 2).map(w => w.day)).toEqual([1, 2]);
    expect(forecast(1, 358, 7).map(w => w.day)).toEqual([358, 359, 360, 361, 362, 363, 364]);
  });

  it('keeps wet days per month close to the climate normal', () => {
    for (let m = 0; m < 12; m++) {
      const norm = (climate.precipDays.values[m] * 30) / climate.daysInMonth[m];
      let wet = 0;
      for (const s of SEEDS) {
        wet += forecast(s, m * 30 + 1, 30).filter(w => w.condition === 'rain' || w.condition === 'snow' || w.condition === 'storm').length;
      }
      expect(Math.abs(wet / SEEDS.length - norm)).toBeLessThan(1);
    }
  });

  it('keeps monthly highs near the normal', () => {
    for (let m = 0; m < 12; m++) {
      let sum = 0;
      for (const s of SEEDS) sum += forecast(s, m * 30 + 1, 30).reduce((a, w) => a + w.tempF, 0);
      expect(Math.abs(sum / SEEDS.length / 30 - climate.tmaxF.values[m])).toBeLessThan(2.5);
    }
  });

  it('makes January cold and snowy and July hot and stormy', () => {
    let janSnow = 0, julSnow = 0, julHeat = 0, julStorm = 0;
    for (const s of SEEDS) {
      const year = forecast(s, 1, 360);
      const jan = year.filter(w => monthOf(w.day) === 0);
      const jul = year.filter(w => monthOf(w.day) === 6);
      janSnow += jan.filter(w => w.condition === 'snow' || w.label.startsWith('Snowstorm')).length;
      julSnow += jul.filter(w => w.condition === 'snow' || w.label.startsWith('Snow')).length;
      julHeat += jul.filter(w => w.condition === 'heat').length;
      julStorm += jul.filter(w => w.label.startsWith('Thunderstorms')).length;
      expect(jan.reduce((a, w) => a + w.tempF, 0) / jan.length).toBeLessThan(46);
      expect(jul.reduce((a, w) => a + w.tempF, 0) / jul.length).toBeGreaterThan(78);
    }
    expect(janSnow / SEEDS.length).toBeGreaterThan(2.5);
    expect(julSnow).toBe(0);
    expect(julHeat / SEEDS.length).toBeGreaterThan(4);
    expect(julStorm / SEEDS.length).toBeGreaterThan(0.8);
  });

  it('never snows from May to October and heat only comes from May to September', () => {
    for (const s of SEEDS) {
      for (const w of forecast(s, 1, 360)) {
        const m = monthOf(w.day);
        if (m >= 4 && m <= 9) expect(w.condition === 'snow' || w.label.startsWith('Snow')).toBe(false);
        if (w.condition === 'heat') expect(m >= 4 && m <= 8).toBe(true);
        if (w.condition === 'snow') expect(w.tempF).toBeLessThanOrEqual(36);
      }
    }
  });

  it('uses the foot traffic multipliers from the climate file', () => {
    expect(FOOT_TRAFFIC_MULT).toEqual({ clear: 1, cloudy: 1, rain: 0.9, snow: 0.85, heat: 0.95, storm: 0.7 });
    for (const w of forecast(3, 1, 360)) expect(w.footTrafficMult).toBe(FOOT_TRAFFIC_MULT[w.condition]);
  });

  it('labels every day in English with the temperature', () => {
    for (const w of forecast(5, 1, 360)) expect(w.label).toMatch(/^(Sunny|Cloudy|Rain|Sleet|Snow|Heat|Snowstorm|Thunderstorms|Nor'easter), -?\d+°F$/);
  });

  it('interpolates the normal high between months', () => {
    expect(normalHighF(15)).toBeGreaterThan(38);
    expect(normalHighF(15)).toBeLessThan(41);
    expect(normalHighF(195)).toBeGreaterThan(84);
  });
});

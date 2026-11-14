import { describe, expect, it } from 'vitest';
import { forecast, interpretIdea } from './index';

describe('ai', () => {
  it('forecast returns the requested number of days', () => {
    const f = forecast(1, 10, 7);
    expect(f).toHaveLength(7);
    expect(f[0].day).toBe(10);
  });
  it('interpretIdea never throws and returns a niche', async () => {
    const m = await interpretIdea({ text: 'I want a coffee shop', packs: { common: {} as never, niches: {} } });
    expect(m.niche).toBe('cafe');
  });
});

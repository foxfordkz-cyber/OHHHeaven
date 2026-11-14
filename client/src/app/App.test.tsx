import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';

describe('client', () => {
  it('renders the OK page', () => {
    expect(renderToStaticMarkup(<App />)).toContain('OK');
  });
});

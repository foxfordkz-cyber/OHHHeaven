import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from './App';

afterEach(cleanup);

describe('app shell', () => {
  it('renders the design system page without a server', async () => {
    window.history.pushState({}, '', '/dev/ui');
    render(<App />);
    expect(await screen.findByText('Design system')).toBeTruthy();
  });
});

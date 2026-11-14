import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ClientView, OwnerView } from '@ohh/shared/types';
import { DevStore } from '../../app/dev';
import { cityView, fixtureIdea, ownerView } from '../../app/fixtures';
import { Home, visibleBusinesses, waitingCount } from './Home';

afterEach(cleanup);

function StartProbe() {
  const loc = useLocation();
  return <div data-testid="start">{JSON.stringify(loc.state)}</div>;
}

function renderHome(view: ClientView) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <DevStore view={view} answers={{ idea: fixtureIdea }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/start" element={<StartProbe />} />
        </Routes>
      </DevStore>
    </MemoryRouter>,
  );
}

describe('home page', () => {
  it('pitches the game, shows the bank and all five niches', () => {
    renderHome(cityView);
    expect(screen.getByText('Test your business idea in real New York.')).toBeTruthy();
    expect(screen.getByText('Real rent, real permits, real taxes. None of your savings at risk.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See my plan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Work for the city — free/ })).toBeTruthy();
    expect(screen.getByText('$230')).toBeTruthy();
    for (const n of ['Coffee shop', 'Barbershop', 'Corner store', 'Guesthouse', 'Apartment rentals']) expect(screen.getByText(n)).toBeTruthy();
    expect(screen.getAllByText('Opening soon')).toHaveLength(3);
    // the coffee-shop leader is on the map and in the niche's top 3
    expect(screen.getAllByText('Halfmoon Coffee').length).toBeGreaterThanOrEqual(2);
  });

  it('sends the idea and opens /start with the match', async () => {
    renderHome(cityView);
    fireEvent.change(screen.getByLabelText('What would you open?'), { target: { value: 'coffee near the subway' } });
    fireEvent.click(screen.getByRole('button', { name: 'See my plan' }));
    const probe = await screen.findByTestId('start');
    expect(JSON.parse(probe.textContent!)).toMatchObject({ idea: 'coffee near the subway', match: { niche: 'cafe' } });
  });

  it('greets a returning owner with "While you were away" instead of the pitch', () => {
    renderHome(ownerView);
    expect(screen.getByText('While you were away')).toBeTruthy();
    expect(screen.getByText('+$3,240')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Open my business/ })).toBeTruthy();
    expect(screen.queryByText('Test your business idea in real New York.')).toBeNull();
  });
});

describe('home helpers', () => {
  it('shows the owner their own business among the neighbors', () => {
    const list = visibleBusinesses(ownerView);
    expect(list[0]).toMatchObject({ id: 'b01', name: "Maya's Morning Cup", ownerName: 'Maya Chen' });
    expect(list).toHaveLength(ownerView.neighbors.length + 1);
  });

  it('counts what waits for an answer: fines and incoming offers', () => {
    const v: OwnerView = {
      ...ownerView,
      notices: [{ caseId: 'c1', role: 'inspector', found: [], fine: 500, closureDays: 0, answerByDay: 76, status: 'notice' }],
      deals: [...ownerView.deals, { id: 'd2', fromBusinessId: 'b03', toBusinessId: 'b01', terms: { type: 'joint_purchase', months: 2 }, status: 'proposed', proposedDay: 74, expiresDay: 77 }],
    };
    expect(waitingCount(v)).toBe(2);
  });
});

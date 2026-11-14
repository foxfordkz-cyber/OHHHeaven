import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Action, ClientView } from '@ohh/shared/types';
import { DevStore } from '../../app/dev';
import { fixtureIdea, fixtureOpenRecommendations, fixtureRoadmapTodo, ownerViewNew, ownerViewSetup } from '../../app/fixtures';
import { Start } from './Start';

const ANSWERS = { idea: fixtureIdea, roadmap: fixtureRoadmapTodo, recommend_opening: fixtureOpenRecommendations };
const KIT_DRAFT = { step: 'kit' as const, niche: 'cafe' as const, placeId: 'p12', name: 'Jordan’s Coffee', idea: 'coffee', match: fixtureIdea };
const standard = fixtureOpenRecommendations[0];

function renderKit(onAct: (a: Action, v: ClientView) => ClientView | void) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <DevStore view={ownerViewNew} answers={ANSWERS} onAct={onAct}>
        <Start initial={KIT_DRAFT} />
      </DevStore>
    </MemoryRouter>,
  );
}

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe('opening setup screen', () => {
  it('shows the recommended setup expanded: total, cash left, days to open, why', async () => {
    renderKit(() => undefined);
    expect(await screen.findByText('Recommended: Standard')).toBeTruthy();
    expect(screen.getByTestId('kit-total').textContent).toBe('$92,100');
    expect(screen.getByText('$27,900')).toBeTruthy();
    expect(screen.getByText('Permits and licenses')).toBeTruthy();
    expect(screen.getByText(standard.why[0])).toBeTruthy();
  });

  it('opens with the recommended setup in one tap', async () => {
    const onAct = vi.fn((_a: Action, _v: ClientView) => ownerViewSetup);
    renderKit(onAct);
    fireEvent.click(await screen.findByRole('button', { name: 'Open with recommended setup' }));
    await waitFor(() => expect(onAct).toHaveBeenCalled());
    expect(onAct.mock.calls[0][0]).toEqual({ type: 'open_business', niche: 'cafe', placeId: 'p12', name: 'Jordan’s Coffee', kitId: 'standard', size: 24, items: standard.items });
    expect(await screen.findByText('Waiting for permits')).toBeTruthy();
  });

  it('recalculates the total when the size or optional items change', async () => {
    renderKit(() => undefined);
    fireEvent.click(await screen.findByRole('button', { name: 'Customize' }));
    expect(screen.getByTestId('custom-total').textContent).toBe('$92,100');
    fireEvent.click(screen.getByRole('button', { name: 'Increase seat' }));
    expect(screen.getByTestId('custom-total').textContent).toBe('$92,280');
    fireEvent.click(screen.getByRole('switch', { name: /Table and chair, per seat/ }));
    expect(screen.getByTestId('custom-total').textContent).toBe('$87,780');
  });

  it('switches to another kit inside Customize', async () => {
    renderKit(() => undefined);
    fireEvent.click(await screen.findByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lean' }));
    expect(screen.getByTestId('custom-total').textContent).toBe(`$${fixtureOpenRecommendations[1].total.toLocaleString('en-US')}`);
  });

  it('keeps required items locked and explains the rule behind the lock', async () => {
    renderKit(() => undefined);
    fireEvent.click(await screen.findByRole('button', { name: 'Customize' }));
    expect(screen.queryByRole('switch', { name: /Food Service Establishment Permit/ })).toBeNull();
    const locks = screen.getAllByRole('button', { name: 'Required: Food Service Establishment Permit' });
    fireEvent.click(locks[locks.length - 1]);
    expect(await screen.findByText('NYC Health Code § 81.05')).toBeTruthy();
  });
});

// The first decision shows its consequence before it is taken: what the room earns (docs/qa/HOOK.md, BUGS.md #1).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { OpenRecommendation } from '@ohh/shared/types';
import { DevStore } from '../../app/dev';
import { fixtureIdea, fixtureOpenRecommendations, ownerViewNew } from '../../app/fixtures';
import { Start } from './Start';

const withLine = (line: string): OpenRecommendation[] => fixtureOpenRecommendations.map((r, i) => (i === 0 ? { ...r, why: [...r.why, line] } : r));
const PLACE_DRAFT = { step: 'place' as const, niche: 'cafe' as const, placeId: 'p12', name: 'Jordan’s Coffee', idea: 'coffee', match: fixtureIdea };

function renderPlace(recs: OpenRecommendation[]) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <DevStore view={ownerViewNew} answers={{ idea: fixtureIdea, recommend_opening: recs }}>
        <Start initial={PLACE_DRAFT} />
      </DevStore>
    </MemoryRouter>,
  );
}

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe('place step: what the room earns', () => {
  it('a room that pays: the engine line in profit colour', async () => {
    renderPlace(withLine('Once the regulars know you: $5,977/month. First year, with the wait and a slow start: $21,040'));
    const p = await screen.findByTestId('place-outlook');
    expect(p.textContent).toContain('$5,977/month');
    // the number is tied to the setup it assumes: the next step lets the player change it
    expect(p.textContent).toMatch(/With 24 seats, 3 baristas and 1 shift lead: once the regulars know you/i);
    expect(p.className).toContain('profit');
  });

  it('a room that loses even when known: said in loss colour, before the lease is signed', async () => {
    renderPlace(withLine('Even with a full regular crowd this loses $475/month — this address needs a leaner setup or a lower rent'));
    const p = await screen.findByTestId('place-outlook');
    expect(p.textContent).toContain('loses $475/month');
    expect(p.className).toContain('loss');
  });
});

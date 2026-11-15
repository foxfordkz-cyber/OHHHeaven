// /dev/brief — every state of the brief on example data, no server.
import { useState } from 'react';
import type { Ack, Action } from '@ohh/shared/types';
import { SegmentedControl } from '../../ui';
import { fixturePlaces } from '../../app/fixtures';
import { BriefScreen } from './BriefScreen';
import { NEAR_RADIUS_FALLBACK_M, nearbyIds } from './model';
import { BRIEF_FIXTURES, briefFixture, type BriefFixture } from './fixtures';

export function DevBrief() {
  const [name, setName] = useState<BriefFixture>('away');
  const act = async (_a: Action): Promise<Ack> => ({ ok: true });
  const view = briefFixture(name);
  const near = nearbyIds(view, fixturePlaces, NEAR_RADIUS_FALLBACK_M);
  return (
    <div className="stack">
      <div style={{ padding: '8px 16px 0' }}>
        <SegmentedControl label="State" options={BRIEF_FIXTURES.map((f) => ({ value: f, label: f }))} value={name} onChange={setName} />
      </div>
      <BriefScreen key={name} deps={{ view, memoryKey: `dev:${name}`, act, navigate: () => undefined, near }} />
    </div>
  );
}

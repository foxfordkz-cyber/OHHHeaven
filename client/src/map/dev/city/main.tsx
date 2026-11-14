// /dev/city/ — the city screen on fixtures. Add ?server=http://localhost:3000&world=demo to poll a real server.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CityScreen, CityScreenRoute } from '../../../screens/city/CityScreen';
import { cityView } from '../../../screens/city/fixtures';
import { places } from '../../fixtures';
import type { ClockCommand } from '../../../screens/city/useCityView';
import { RULES, dateOf } from '@ohh/shared/rules';

const params = new URLSearchParams(location.search);

function FixtureCity() {
  const [view, setView] = useState(cityView);
  const [at, setAt] = useState(() => Date.now());
  // dev only: advance the fixture day on the demo clock, as the server would
  useEffect(() => {
    if (view.world.config.paused) return;
    const id = window.setTimeout(() => {
      setView((v) => ({ ...v, world: { ...v.world, day: v.world.day + 1, date: dateOf(v.world.day + 1), version: v.world.version + 1, msToNextDay: v.world.config.dayMs } }));
      setAt(Date.now());
    }, Math.max(200, view.world.msToNextDay - (Date.now() - at)));
    return () => window.clearTimeout(id);
  }, [view, at]);
  const onClock = (cmd: ClockCommand) => {
    setView((v) => ({
      ...v,
      world: {
        ...v.world,
        config: {
          ...v.world.config,
          paused: cmd.paused ?? v.world.config.paused,
          dayMs: cmd.speed ? RULES.DAY_MS_DEMO / cmd.speed : v.world.config.dayMs,
        },
      },
    }));
    setAt(Date.now());
  };
  return <CityScreen view={view} places={places} worldId="demo" joinUrl={`${location.origin}/start?world=demo`} receivedAt={at} onClock={onClock} />;
}

const server = params.get('server');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {server ? <CityScreenRoute worldId={params.get('world') ?? 'demo'} baseUrl={server} places={places} /> : <FixtureCity />}
  </StrictMode>,
);

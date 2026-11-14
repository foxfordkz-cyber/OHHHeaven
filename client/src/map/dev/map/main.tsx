import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CityMap } from '../../CityMap';
import * as fx from '../../fixtures';
import type { NicheId, Pack, PackSet, WeatherCondition, CommonPack } from '@ohh/shared/types';
import cafeJson from '../../../../../packs/cafe.json';
import barberJson from '../../../../../packs/barbershop.json';
import commonJson from '../../../../../packs/_common.json';

// the real packs: the place card shows the same numbers the engine charges
const packs = { common: commonJson as unknown as CommonPack, niches: { cafe: cafeJson as unknown as Pack, barbershop: barberJson as unknown as Pack } } as PackSet;
// ?h=220 puts the map in a short frame, like the Place step of the opening path

const params = new URLSearchParams(location.search);
const frameH = params.get('h') ? Number(params.get('h')) : null;

function DevMap() {
  const [mode, setMode] = useState<'pick' | 'live'>((params.get('mode') as 'pick' | 'live') ?? 'live');
  const [niche, setNiche] = useState<NicheId>((params.get('niche') as NicheId) ?? 'cafe');
  const [cond, setCond] = useState<WeatherCondition>((params.get('weather') as WeatherCondition) ?? 'rain');
  const [picked, setPicked] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const weather = [{ ...fx.weather[0], condition: cond }];
  return (
    <div style={frameH ? { position: 'relative', height: frameH, margin: 16 } : { position: 'fixed', inset: 0 }}>
      <CityMap
        places={fx.places} businesses={fx.businesses} myBusinessId={fx.myBusinessId}
        packs={packs} weather={weather} events={fx.events} day={fx.day} blockFunds={fx.blockFunds} realBusinesses={fx.realBusinesses}
        mode={mode} niche={niche} initialPlaceId={params.get('place') ?? undefined} offline={params.has('offline')} intro={!params.has('nointro')}
        onPick={(id) => setPicked(id)} onOpenBusiness={(id) => setOpened(id)}
      />
      <div className="dev-panel" style={panel}>
        <select value={mode} onChange={(e) => setMode(e.target.value as 'pick' | 'live')} aria-label="Mode"><option value="live">live</option><option value="pick">pick</option></select>
        <select value={niche} onChange={(e) => setNiche(e.target.value as NicheId)} aria-label="Niche">{['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'].map((n) => <option key={n}>{n}</option>)}</select>
        <select value={cond} onChange={(e) => setCond(e.target.value as WeatherCondition)} aria-label="Weather">{['clear', 'cloudy', 'rain', 'snow', 'heat', 'storm'].map((n) => <option key={n}>{n}</option>)}</select>
        {picked && <span>picked {picked}</span>}
        {opened && <span>opened {opened}</span>}
      </div>
    </div>
  );
}

const panel: React.CSSProperties = { position: 'absolute', zIndex: 10, right: 10, bottom: 34, display: 'flex', gap: 6, alignItems: 'center', font: '12px system-ui', color: '#cfd6ff', background: 'rgba(10,15,31,.8)', padding: 6, borderRadius: 10 };

createRoot(document.getElementById('root')!).render(<StrictMode><DevMap /></StrictMode>);

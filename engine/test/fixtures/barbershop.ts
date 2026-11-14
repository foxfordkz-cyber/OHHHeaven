// Minimal second niche for tests (competition stays inside a niche). Not real data.
import type { Pack } from '@ohh/shared';
import { cafePack } from './cafe';

export const barbershopPack: Pack = {
  ...cafePack,
  id: 'barbershop', name: 'Barbershop', tagline: 'Fades and beard trims',
  unit: { name: 'haircut', refPrice: 35, priceMin: 15, priceMax: 80, cogsPerUnit: 2, confidence: 'estimate' },
  market: { unitsPerSlotMonth: 700, priceElasticity: -1.2, weights: { price: 0.3, quality: 0.3, reputation: 0.3, location: 0.1 }, confidence: 'estimate' },
  capacity: { unitsPerStaffMonth: 300, minStaff: 1, maxStaff: 6, hardCapUnits: null },
  sizing: { unitName: 'chair', min: 2, max: 8, default: 4, sqftPerUnit: 60, unitsServedPerSizeMonth: 260, takeawayShare: 0, cleaningCostPerSizeMonth: 20, crowdPenaltyAbove: 0.95, emptyPenaltyBelow: 0.2 },
  setup: cafePack.setup.map((s) => (s.id === 'seat' ? { ...s, id: 'chair', name: 'Barber chair', cost: 900 } : s)),
  kits: cafePack.kits.map((k) => ({ ...k, size: k.id === 'lean' ? 2 : k.id === 'standard' ? 4 : 6, items: k.items.map((i) => (i.id === 'seat' ? { id: 'chair', qty: 1 } : i)) })),
  staff: [{ id: 'barber', name: 'Barber', hourlyWage: 20, hoursPerMonth: 160, confidence: 'estimate' }],
};

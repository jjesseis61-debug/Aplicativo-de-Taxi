import type { Aoa, Place, Quote, RideCategory } from './types';

// Tarifário provisório — substituir pelos valores reais (ou mover para o servidor).
const BASE_FARE: Aoa = 1000;
const PER_KM: Aoa = 175;
// Distância por estrada ≈ distância em linha recta × factor.
const ROAD_FACTOR = 1.3;
const MIN_PRICE_RATIO = 0.9;
export const PRICE_STEP: Aoa = 100;

const CATEGORY_MULTIPLIER: Record<RideCategory, number> = {
  baza: 1,
  cool: 1.12,
  boss: 1.3,
};

export const CATEGORY_LABEL: Record<RideCategory, string> = {
  baza: 'Baza',
  cool: 'Cool',
  boss: 'Boss',
};

export function distanceKm(a: Place, b: Place): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const roundTo = (v: number, step: number) => Math.round(v / step) * step;
const ceilTo = (v: number, step: number) => Math.ceil(v / step) * step;

export function quoteFor(origin: Place, destination: Place, category: RideCategory): Quote {
  const km = distanceKm(origin, destination) * ROAD_FACTOR;
  const recommendedPrice = roundTo((BASE_FARE + PER_KM * km) * CATEGORY_MULTIPLIER[category], PRICE_STEP);
  return {
    category,
    recommendedPrice,
    minPrice: ceilTo(recommendedPrice * MIN_PRICE_RATIO, PRICE_STEP),
    step: PRICE_STEP,
  };
}

export function quotesFor(origin: Place, destination: Place): Quote[] {
  return (Object.keys(CATEGORY_MULTIPLIER) as RideCategory[]).map((c) => quoteFor(origin, destination, c));
}

// Mantém o preço proposto dentro dos limites e alinhado ao passo.
export function clampPrice(price: Aoa, quote: Quote): Aoa {
  return Math.max(quote.minPrice, roundTo(price, quote.step));
}

export function isBelowRecommended(price: Aoa, quote: Quote): boolean {
  return price < quote.recommendedPrice;
}

import { CURRENT_LOCATION, SAVED_PLACES } from '../core/places';
import type { Driver, RideRequest } from '../core/types';

export const miguel: Driver = { id: 'd-miguel', name: 'Miguel', car: 'Suzuki S-Presso', plate: 'A', verified: true };
export const eduardo: Driver = { id: 'd-eduardo', name: 'Eduardo', car: 'Suzuki S-Presso', plate: 'B', verified: true };

export function request(overrides: Partial<RideRequest> = {}): RideRequest {
  return {
    origin: CURRENT_LOCATION,
    destination: SAVED_PLACES[0],
    category: 'baza',
    proposedPrice: 4500,
    autoAccept: false,
    ...overrides,
  };
}

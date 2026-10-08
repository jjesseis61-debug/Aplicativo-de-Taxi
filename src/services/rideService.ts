import { MockRideService } from '../core/mockRideService';
import type { RideService } from '../core/rideService';

// Trocar pela implementação real quando o backend existir.
export const rideService: RideService = new MockRideService({ latencyMs: 400, simulateDrivers: true });

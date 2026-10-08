import { quoteFor, quotesFor } from './pricing';
import type { RideListener, RideService, RideSnapshot } from './rideService';
import type {
  AcceptFailure,
  AcceptResult,
  Aoa,
  CancelReason,
  Driver,
  Offer,
  Place,
  Quote,
  Ride,
  RideRequest,
} from './types';

export const RIDE_SEARCH_WINDOW_MS = 7 * 60 * 1000;

export interface MockRideServiceOptions {
  now?: () => number;
  // Latência simulada de rede antes de cada operação chegar ao "servidor".
  latencyMs?: number;
  // Se activo, cada viagem pedida recebe propostas de motoristas fictícios.
  simulateDrivers?: boolean;
}

const FAKE_DRIVERS: Driver[] = [
  { id: 'd-miguel', name: 'Miguel', car: 'Suzuki S-Presso, branco', plate: 'LD-12-34-AA', verified: true },
  { id: 'd-eduardo', name: 'Eduardo', car: 'Suzuki S-Presso, branco', plate: 'LD-00-00-XX', verified: true },
  { id: 'd-ana', name: 'Ana', car: 'Hyundai i10, cinzento', plate: 'LD-98-76-BC', verified: true },
];

export class MockRideService implements RideService {
  private rides = new Map<string, Ride>();
  private offers = new Map<string, Offer[]>();
  private listeners = new Map<string, Set<RideListener>>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private seq = 0;
  private failNext = false;
  private readonly now: () => number;
  private readonly latencyMs: number;
  private readonly simulateDrivers: boolean;

  constructor(options: MockRideServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.latencyMs = options.latencyMs ?? 0;
    this.simulateDrivers = options.simulateDrivers ?? false;
  }

  async quotes(origin: Place, destination: Place): Promise<Quote[]> {
    await this.network();
    return quotesFor(origin, destination);
  }

  async requestRide(request: RideRequest): Promise<Ride> {
    await this.network();
    const quote = quoteFor(request.origin, request.destination, request.category);
    if (request.proposedPrice < quote.minPrice) {
      throw new Error(`Preço abaixo do mínimo (${quote.minPrice} AOA)`);
    }
    const createdAt = this.now();
    const ride: Ride = {
      ...request,
      id: this.nextId('ride'),
      status: 'searching',
      assignment: null,
      cancelReason: null,
      createdAt,
      expiresAt: createdAt + RIDE_SEARCH_WINDOW_MS,
    };
    this.rides.set(ride.id, ride);
    this.offers.set(ride.id, []);
    if (this.simulateDrivers) this.startDriverSimulation(ride.id);
    return { ...ride };
  }

  async updatePrice(rideId: string, price: Aoa): Promise<Ride> {
    await this.network();
    const ride = this.requireSearching(rideId);
    const quote = quoteFor(ride.origin, ride.destination, ride.category);
    if (price < quote.minPrice) {
      throw new Error(`Preço abaixo do mínimo (${quote.minPrice} AOA)`);
    }
    ride.proposedPrice = price;
    this.emit(rideId);
    return { ...ride };
  }

  async acceptOffer(rideId: string, offerId: string): Promise<AcceptResult> {
    try {
      await this.network();
    } catch {
      return { ok: false, reason: 'network_error' };
    }
    return this.acceptNow(rideId, offerId);
  }

  async rejectOffer(rideId: string, offerId: string): Promise<void> {
    await this.network();
    const offer = this.offers.get(rideId)?.find((o) => o.id === offerId);
    if (offer?.status === 'pending') {
      offer.status = 'rejected';
      this.emit(rideId);
    }
  }

  async cancelRide(rideId: string, reason: CancelReason): Promise<Ride> {
    await this.network();
    const ride = this.requireRide(rideId);
    if (ride.status === 'searching' || ride.status === 'driver_assigned') {
      ride.status = 'cancelled';
      ride.cancelReason = reason;
      this.closePendingOffers(rideId);
      this.emit(rideId);
    }
    return { ...ride };
  }

  subscribe(rideId: string, listener: RideListener): () => void {
    let set = this.listeners.get(rideId);
    if (!set) {
      set = new Set();
      this.listeners.set(rideId, set);
    }
    set.add(listener);
    const snapshot = this.snapshot(rideId);
    if (snapshot) listener(snapshot);
    return () => set.delete(listener);
  }

  // --- Lado do motorista / controlo para testes e demonstração ---

  // Um motorista envia uma proposta. Se a viagem tiver aceitação automática e
  // o preço couber no proposto, é aceite pelo MESMO caminho atómico.
  receiveOffer(rideId: string, driver: Driver, price: Aoa, etaMinutes: number): Offer | null {
    const ride = this.rides.get(rideId);
    if (!ride || !this.isSearching(ride)) return null;
    const offer: Offer = { id: this.nextId('offer'), rideId, driver, price, etaMinutes, status: 'pending' };
    this.offers.get(rideId)!.push(offer);
    if (ride.autoAccept && price <= ride.proposedPrice) {
      this.acceptNow(rideId, offer.id);
    } else {
      this.emit(rideId);
    }
    return { ...offer };
  }

  // Faz a próxima chamada de rede falhar (para simular o "Ocorreu um erro").
  failNextRequest(): void {
    this.failNext = true;
  }

  // Gera propostas de motoristas fictícios ao longo do tempo.
  startDriverSimulation(rideId: string): void {
    FAKE_DRIVERS.forEach((driver, i) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        const ride = this.rides.get(rideId);
        if (!ride) return;
        // O primeiro motorista faz contraproposta acima do preço; os outros aceitam o proposto.
        const price = i === 0 ? ride.proposedPrice + 700 : ride.proposedPrice;
        this.receiveOffer(rideId, driver, price, 3 + i * 2);
      }, 4000 + i * 6000);
      this.timers.add(timer);
    });
  }

  dispose(): void {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.listeners.clear();
  }

  // --- Interno ---

  // Secção crítica: sem awaits, por isso nada se intercala (o JS é single-threaded).
  // No backend real isto é uma transacção com bloqueio da linha da viagem.
  private acceptNow(rideId: string, offerId: string): AcceptResult {
    const fail = (reason: AcceptFailure): AcceptResult => ({ ok: false, reason });
    const ride = this.rides.get(rideId);
    if (!ride) return fail('ride_not_found');
    const offer = this.offers.get(rideId)?.find((o) => o.id === offerId);
    if (!offer) return fail('offer_not_found');
    if (!this.isSearching(ride)) return fail('ride_not_searching');
    if (offer.status !== 'pending') return fail('offer_not_pending');

    offer.status = 'accepted';
    ride.status = 'driver_assigned';
    ride.assignment = {
      offerId: offer.id,
      driver: offer.driver,
      price: offer.price,
      etaMinutes: offer.etaMinutes,
      assignedAt: this.now(),
    };
    this.closePendingOffers(rideId);
    this.emit(rideId);
    return { ok: true, ride: { ...ride } };
  }

  private isSearching(ride: Ride): boolean {
    if (ride.status === 'searching' && this.now() >= ride.expiresAt) {
      ride.status = 'expired';
      this.closePendingOffers(ride.id);
      this.emit(ride.id);
    }
    return ride.status === 'searching';
  }

  private closePendingOffers(rideId: string): void {
    for (const o of this.offers.get(rideId) ?? []) {
      if (o.status === 'pending') o.status = 'expired';
    }
  }

  private requireRide(rideId: string): Ride {
    const ride = this.rides.get(rideId);
    if (!ride) throw new Error('Viagem não encontrada');
    return ride;
  }

  private requireSearching(rideId: string): Ride {
    const ride = this.requireRide(rideId);
    if (!this.isSearching(ride)) throw new Error('A viagem já não está à procura de motorista');
    return ride;
  }

  private snapshot(rideId: string): RideSnapshot | null {
    const ride = this.rides.get(rideId);
    if (!ride) return null;
    return {
      ride: { ...ride },
      offers: (this.offers.get(rideId) ?? []).map((o) => ({ ...o })),
    };
  }

  private emit(rideId: string): void {
    const snapshot = this.snapshot(rideId);
    if (!snapshot) return;
    this.listeners.get(rideId)?.forEach((l) => l(snapshot));
  }

  private async network(): Promise<void> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    if (this.failNext) {
      this.failNext = false;
      throw new Error('network_error');
    }
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }
}

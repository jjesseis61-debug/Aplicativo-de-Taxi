import type {
  AcceptResult,
  Aoa,
  CancelReason,
  Offer,
  Place,
  Quote,
  Ride,
  RideRequest,
} from './types';

export interface RideSnapshot {
  ride: Ride;
  offers: Offer[];
}

export type RideListener = (snapshot: RideSnapshot) => void;

// Contrato entre o app do passageiro e o backend. O MockRideService implementa-o
// em memória; a implementação real (ex.: Supabase, ver supabase/migrations)
// tem de respeitar as mesmas regras:
//
// - acceptOffer é atómico: ou a viagem fica atribuída exactamente ao motorista
//   e ao preço DESSA proposta, ou nada muda e é devolvido o motivo da falha.
// - A aceitação automática passa pelo mesmo caminho do servidor — nunca há
//   duas atribuições para a mesma viagem.
export interface RideService {
  quotes(origin: Place, destination: Place): Promise<Quote[]>;
  requestRide(request: RideRequest): Promise<Ride>;
  updatePrice(rideId: string, price: Aoa): Promise<Ride>;
  acceptOffer(rideId: string, offerId: string): Promise<AcceptResult>;
  rejectOffer(rideId: string, offerId: string): Promise<void>;
  cancelRide(rideId: string, reason: CancelReason): Promise<Ride>;
  subscribe(rideId: string, listener: RideListener): () => void;
}

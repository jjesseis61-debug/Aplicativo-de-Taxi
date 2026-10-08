// Valores monetários são sempre inteiros em kwanzas (AOA).
export type Aoa = number;

export interface Place {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

export type RideCategory = 'baza' | 'cool' | 'boss';

export interface Quote {
  category: RideCategory;
  recommendedPrice: Aoa;
  minPrice: Aoa;
  step: Aoa;
}

export interface Driver {
  id: string;
  name: string;
  car: string;
  plate: string;
  verified: boolean;
}

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

// Proposta de um motorista para uma viagem. O preço da proposta é o preço
// que o passageiro paga se a aceitar — nunca é substituído por outro valor.
export interface Offer {
  id: string;
  rideId: string;
  driver: Driver;
  price: Aoa;
  etaMinutes: number;
  status: OfferStatus;
}

export type RideStatus = 'searching' | 'driver_assigned' | 'cancelled' | 'expired';

// Motorista e preço atribuídos. Copiados da proposta aceite pelo servidor,
// numa única operação: é a única fonte de verdade para o ecrã "a caminho".
export interface Assignment {
  offerId: string;
  driver: Driver;
  price: Aoa;
  etaMinutes: number;
  assignedAt: number;
}

export type CancelReason =
  | 'driver_not_showing'
  | 'driver_refused'
  | 'driver_too_far'
  | 'change_destination'
  | 'wrong_pickup'
  | 'other';

export interface Ride {
  id: string;
  origin: Place;
  destination: Place;
  category: RideCategory;
  proposedPrice: Aoa;
  // Aceitar automaticamente qualquer proposta com preço <= proposedPrice.
  autoAccept: boolean;
  status: RideStatus;
  assignment: Assignment | null;
  cancelReason: CancelReason | null;
  createdAt: number;
  expiresAt: number;
}

export interface RideRequest {
  origin: Place;
  destination: Place;
  category: RideCategory;
  proposedPrice: Aoa;
  autoAccept: boolean;
}

export type AcceptFailure =
  | 'ride_not_found'
  | 'offer_not_found'
  | 'offer_not_pending'
  | 'ride_not_searching'
  | 'network_error';

export type AcceptResult = { ok: true; ride: Ride } | { ok: false; reason: AcceptFailure };

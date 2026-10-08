import { clampPrice } from './pricing';
import type { RideSnapshot } from './rideService';
import type { AcceptFailure, Aoa, Offer, Place, Quote, Ride, RideCategory } from './types';

// Fluxo do passageiro, do destino até ao motorista a caminho.
//
// Regra principal: o servidor é a fonte de verdade. O ecrã "motorista a
// caminho" só aparece quando um snapshot do servidor diz driver_assigned, e
// mostra o motorista/preço de ride.assignment — nunca o que o cliente "acha"
// que aceitou. Um erro de aceitação nunca coexiste com uma viagem atribuída.
export type Phase =
  | 'route'
  | 'pricing'
  | 'confirmPickup'
  | 'searching'
  | 'driverOnTheWay'
  | 'cancelReason'
  | 'cancelled'
  | 'expired';

export interface FlowState {
  phase: Phase;
  origin: Place;
  destination: Place | null;
  quotes: Quote[];
  category: RideCategory;
  // Preço que o passageiro está a editar (antes de pedir, ou para actualizar).
  draftPrice: Aoa;
  autoAccept: boolean;
  ride: Ride | null;
  offers: Offer[];
  // Proposta cuja aceitação aguarda resposta do servidor.
  acceptingOfferId: string | null;
  busy: boolean;
  error: string | null;
}

export type FlowAction =
  | { type: 'destinationSelected'; destination: Place; quotes: Quote[] }
  | { type: 'categorySelected'; category: RideCategory }
  | { type: 'priceStepped'; direction: 1 | -1 }
  | { type: 'autoAcceptToggled' }
  | { type: 'pickupConfirmationOpened' }
  | { type: 'back' }
  | { type: 'requestStarted' }
  | { type: 'requestFinished' }
  | { type: 'requestFailed'; message: string }
  | { type: 'rideCreated'; ride: Ride }
  | { type: 'snapshot'; snapshot: RideSnapshot }
  | { type: 'acceptStarted'; offerId: string }
  | { type: 'acceptFailed'; reason: AcceptFailure }
  | { type: 'cancelOpened' }
  | { type: 'cancelClosed' }
  | { type: 'errorDismissed' }
  | { type: 'reset' };

export function initialFlowState(origin: Place): FlowState {
  return {
    phase: 'route',
    origin,
    destination: null,
    quotes: [],
    category: 'baza',
    draftPrice: 0,
    autoAccept: true,
    ride: null,
    offers: [],
    acceptingOfferId: null,
    busy: false,
    error: null,
  };
}

export function selectedQuote(state: FlowState): Quote | undefined {
  return state.quotes.find((q) => q.category === state.category);
}

const ACCEPT_ERROR: Record<AcceptFailure, string> = {
  ride_not_found: 'Não encontrámos esta viagem.',
  offer_not_found: 'Esta proposta já não está disponível.',
  offer_not_pending: 'Esta proposta já não está disponível.',
  ride_not_searching: 'Esta viagem já não está à procura de motorista.',
  network_error: 'Sem ligação. A verificar o estado da viagem…',
};

function phaseForRide(ride: Ride, current: Phase): Phase {
  switch (ride.status) {
    case 'searching':
      return current === 'cancelReason' ? current : 'searching';
    case 'driver_assigned':
      return current === 'cancelReason' ? current : 'driverOnTheWay';
    case 'cancelled':
      return 'cancelled';
    case 'expired':
      return 'expired';
  }
}

export function rideFlowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'destinationSelected': {
      const next = { ...state, destination: action.destination, quotes: action.quotes, phase: 'pricing' as const };
      const quote = selectedQuote(next);
      return { ...next, draftPrice: quote?.recommendedPrice ?? 0, busy: false, error: null };
    }

    case 'categorySelected': {
      const next = { ...state, category: action.category };
      const quote = selectedQuote(next);
      return { ...next, draftPrice: quote?.recommendedPrice ?? state.draftPrice };
    }

    case 'priceStepped': {
      const quote = selectedQuote(state);
      if (!quote) return state;
      return { ...state, draftPrice: clampPrice(state.draftPrice + action.direction * quote.step, quote) };
    }

    case 'autoAcceptToggled':
      return { ...state, autoAccept: !state.autoAccept };

    case 'pickupConfirmationOpened':
      return state.phase === 'pricing' ? { ...state, phase: 'confirmPickup' } : state;

    case 'back':
      if (state.phase === 'pricing') return { ...state, phase: 'route', destination: null, quotes: [] };
      if (state.phase === 'confirmPickup') return { ...state, phase: 'pricing' };
      return state;

    case 'requestStarted':
      return { ...state, busy: true, error: null };

    case 'requestFinished':
      return { ...state, busy: false };

    case 'requestFailed':
      return { ...state, busy: false, error: action.message };

    case 'rideCreated':
      return { ...state, busy: false, ride: action.ride, offers: [], phase: phaseForRide(action.ride, state.phase) };

    case 'snapshot': {
      const { ride, offers } = action.snapshot;
      // Ignora snapshots de uma viagem anterior.
      if (!state.ride || ride.id !== state.ride.id) return state;
      const assigned = ride.status !== 'searching';
      return {
        ...state,
        ride,
        offers,
        phase: phaseForRide(ride, state.phase),
        acceptingOfferId: assigned ? null : state.acceptingOfferId,
        // Uma vez atribuída/terminada, um erro pendente de aceitação deixa de fazer sentido.
        error: assigned ? null : state.error,
      };
    }

    case 'acceptStarted':
      if (state.phase !== 'searching' || state.acceptingOfferId) return state;
      return { ...state, acceptingOfferId: action.offerId, error: null };

    case 'acceptFailed':
      // O servidor já atribuiu a viagem (ex.: a resposta perdeu-se na rede mas
      // a aceitação passou) — o estado do servidor ganha, sem banner de erro.
      if (state.ride && state.ride.status !== 'searching') return { ...state, acceptingOfferId: null };
      return { ...state, acceptingOfferId: null, error: ACCEPT_ERROR[action.reason] };

    case 'cancelOpened':
      return state.phase === 'searching' || state.phase === 'driverOnTheWay'
        ? { ...state, phase: 'cancelReason' }
        : state;

    case 'cancelClosed':
      return state.phase === 'cancelReason' && state.ride
        ? { ...state, phase: phaseForRide(state.ride, 'searching') }
        : state;

    case 'errorDismissed':
      return { ...state, error: null };

    case 'reset':
      return initialFlowState(state.origin);
  }
}

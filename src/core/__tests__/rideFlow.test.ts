import { expect, test } from '@jest/globals';

import { MockRideService } from '../mockRideService';
import { CURRENT_LOCATION, SAVED_PLACES } from '../places';
import { quotesFor } from '../pricing';
import type { RideSnapshot } from '../rideService';
import { type FlowAction, type FlowState, initialFlowState, rideFlowReducer } from '../rideFlow';
import { eduardo, miguel, request } from '../../testing/fixtures';

const reduce = (state: FlowState, ...actions: FlowAction[]) => actions.reduce(rideFlowReducer, state);

function pricingState(): FlowState {
  const destination = SAVED_PLACES[0];
  return reduce(initialFlowState(CURRENT_LOCATION), {
    type: 'destinationSelected',
    destination,
    quotes: quotesFor(CURRENT_LOCATION, destination),
  });
}

async function searchingState(service: MockRideService, autoAccept = false) {
  const base = pricingState();
  const ride = await service.requestRide({
    origin: base.origin,
    destination: base.destination!,
    category: base.category,
    proposedPrice: base.draftPrice,
    autoAccept,
  });
  let state = reduce(base, { type: 'pickupConfirmationOpened' }, { type: 'rideCreated', ride });
  const snapshots: RideSnapshot[] = [];
  service.subscribe(ride.id, (s) => snapshots.push(s));
  const sync = () => {
    state = reduce(state, ...snapshots.splice(0).map((snapshot) => ({ type: 'snapshot', snapshot }) as const));
    return state;
  };
  return { ride, sync, get state() { return state; }, set state(s) { state = s; } };
}

test('o preço começa no recomendado e não desce abaixo do mínimo', () => {
  let state = pricingState();
  const quote = state.quotes[0];
  expect(state.draftPrice).toBe(quote.recommendedPrice);
  for (let i = 0; i < 50; i++) state = rideFlowReducer(state, { type: 'priceStepped', direction: -1 });
  expect(state.draftPrice).toBe(quote.minPrice);
});

test('o ecrã do motorista mostra o motorista e o preço da proposta aceite', async () => {
  const service = new MockRideService();
  const flow = await searchingState(service);
  expect(flow.sync().phase).toBe('searching');

  const offer = service.receiveOffer(flow.ride.id, miguel, 5200, 3)!;
  flow.sync();
  flow.state = rideFlowReducer(flow.state, { type: 'acceptStarted', offerId: offer.id });
  expect((await service.acceptOffer(flow.ride.id, offer.id)).ok).toBe(true);
  const state = flow.sync();

  expect(state.phase).toBe('driverOnTheWay');
  expect(state.ride?.assignment?.driver.name).toBe('Miguel');
  expect(state.ride?.assignment?.price).toBe(5200);
  expect(state.acceptingOfferId).toBeNull();
});

test('se outro motorista ganhou, nunca há erro e "a caminho" ao mesmo tempo', async () => {
  const service = new MockRideService();
  const flow = await searchingState(service, true);
  const counter = service.receiveOffer(flow.ride.id, miguel, 5200, 3)!;
  flow.sync();
  flow.state = rideFlowReducer(flow.state, { type: 'acceptStarted', offerId: counter.id });

  // Entretanto a aceitação automática atribui o Eduardo.
  service.receiveOffer(flow.ride.id, eduardo, flow.state.ride!.proposedPrice, 5);
  const result = await service.acceptOffer(flow.ride.id, counter.id);
  expect(result.ok).toBe(false);
  flow.sync();
  if (!result.ok) flow.state = rideFlowReducer(flow.state, { type: 'acceptFailed', reason: result.reason });

  expect(flow.state.phase).toBe('driverOnTheWay');
  expect(flow.state.error).toBeNull();
  expect(flow.state.ride?.assignment?.driver.name).toBe('Eduardo');
});

test('falha ao aceitar sem atribuição: continua à procura e mostra o erro', async () => {
  const service = new MockRideService();
  const flow = await searchingState(service);
  const offer = service.receiveOffer(flow.ride.id, miguel, 5200, 3)!;
  flow.sync();
  flow.state = reduce(
    flow.state,
    { type: 'acceptStarted', offerId: offer.id },
    { type: 'acceptFailed', reason: 'network_error' },
  );

  expect(flow.state.phase).toBe('searching');
  expect(flow.state.error).toMatch(/ligação/);
  expect(flow.state.acceptingOfferId).toBeNull();
});

test('só uma aceitação de cada vez', async () => {
  const service = new MockRideService();
  const flow = await searchingState(service);
  const a = service.receiveOffer(flow.ride.id, miguel, 5200, 3)!;
  const b = service.receiveOffer(flow.ride.id, eduardo, 5000, 4)!;
  flow.sync();
  const state = reduce(
    flow.state,
    { type: 'acceptStarted', offerId: a.id },
    { type: 'acceptStarted', offerId: b.id },
  );
  expect(state.acceptingOfferId).toBe(a.id);
});

test('cancelar a partir do motorista a caminho termina em "cancelada"', async () => {
  const service = new MockRideService();
  const flow = await searchingState(service, true);
  service.receiveOffer(flow.ride.id, eduardo, flow.state.ride!.proposedPrice, 5);
  flow.sync();
  flow.state = rideFlowReducer(flow.state, { type: 'cancelOpened' });
  expect(flow.state.phase).toBe('cancelReason');

  // Fechar volta ao ecrã certo.
  expect(rideFlowReducer(flow.state, { type: 'cancelClosed' }).phase).toBe('driverOnTheWay');

  await service.cancelRide(flow.ride.id, 'driver_too_far');
  expect(flow.sync().phase).toBe('cancelled');
});

test('snapshots de uma viagem anterior são ignorados', async () => {
  const service = new MockRideService();
  const flow = await searchingState(service);
  const old = flow.state;
  const other = await service.requestRide(request({ proposedPrice: old.ride!.proposedPrice }));
  const next = rideFlowReducer(old, { type: 'snapshot', snapshot: { ride: { ...other, status: 'cancelled' }, offers: [] } });
  expect(next).toBe(old);
});

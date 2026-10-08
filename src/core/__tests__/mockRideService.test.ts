import { expect, test } from '@jest/globals';

import { MockRideService, RIDE_SEARCH_WINDOW_MS } from '../mockRideService';
import { quoteFor } from '../pricing';
import { eduardo, miguel, request } from '../../testing/fixtures';

test('aceitar uma contraproposta atribui exactamente esse motorista e esse preço', async () => {
  const service = new MockRideService();
  const ride = await service.requestRide(request({ proposedPrice: 4500 }));
  const offer = service.receiveOffer(ride.id, miguel, 5200, 3)!;

  const result = await service.acceptOffer(ride.id, offer.id);

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.ride.status).toBe('driver_assigned');
  expect(result.ride.assignment).toMatchObject({ offerId: offer.id, driver: miguel, price: 5200 });
});

test('aceitação automática e aceitação manual em corrida: só uma ganha', async () => {
  const service = new MockRideService();
  const ride = await service.requestRide(request({ proposedPrice: 4500, autoAccept: true }));
  const counter = service.receiveOffer(ride.id, miguel, 5200, 3)!; // acima do preço: fica pendente
  service.receiveOffer(ride.id, eduardo, 4500, 5); // dentro do preço: aceite automaticamente

  const result = await service.acceptOffer(ride.id, counter.id);

  expect(result).toEqual({ ok: false, reason: 'ride_not_searching' });
  const snapshots: string[] = [];
  service.subscribe(ride.id, (s) => snapshots.push(`${s.ride.assignment?.driver.name}:${s.ride.assignment?.price}`));
  expect(snapshots).toEqual(['Eduardo:4500']);
});

test('uma falha de rede não altera a viagem', async () => {
  const service = new MockRideService();
  const ride = await service.requestRide(request());
  const offer = service.receiveOffer(ride.id, miguel, 5200, 3)!;
  service.failNextRequest();

  expect(await service.acceptOffer(ride.id, offer.id)).toEqual({ ok: false, reason: 'network_error' });
  expect((await service.acceptOffer(ride.id, offer.id)).ok).toBe(true);
});

test('proposta recusada não pode ser aceite', async () => {
  const service = new MockRideService();
  const ride = await service.requestRide(request());
  const offer = service.receiveOffer(ride.id, miguel, 5200, 3)!;
  await service.rejectOffer(ride.id, offer.id);

  expect(await service.acceptOffer(ride.id, offer.id)).toEqual({ ok: false, reason: 'offer_not_pending' });
});

test('o servidor recusa preços abaixo do mínimo', async () => {
  const service = new MockRideService();
  const min = quoteFor(request().origin, request().destination, 'baza').minPrice;
  await expect(service.requestRide(request({ proposedPrice: min - 100 }))).rejects.toThrow('mínimo');
  const ride = await service.requestRide(request({ proposedPrice: min }));
  await expect(service.updatePrice(ride.id, min - 100)).rejects.toThrow('mínimo');
});

test('a procura expira ao fim da janela e as propostas deixam de ser aceites', async () => {
  let now = 1_000;
  const service = new MockRideService({ now: () => now });
  const ride = await service.requestRide(request());
  const offer = service.receiveOffer(ride.id, miguel, 5200, 3)!;
  now += RIDE_SEARCH_WINDOW_MS;

  expect(await service.acceptOffer(ride.id, offer.id)).toEqual({ ok: false, reason: 'ride_not_searching' });
  expect(service.receiveOffer(ride.id, eduardo, 4500, 3)).toBeNull();
});

test('cancelar fecha as propostas pendentes', async () => {
  const service = new MockRideService();
  const ride = await service.requestRide(request());
  const offer = service.receiveOffer(ride.id, miguel, 5200, 3)!;
  const cancelled = await service.cancelRide(ride.id, 'other');

  expect(cancelled.status).toBe('cancelled');
  expect(await service.acceptOffer(ride.id, offer.id)).toEqual({ ok: false, reason: 'ride_not_searching' });
});

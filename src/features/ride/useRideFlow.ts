import { useCallback, useEffect, useReducer } from 'react';

import { CURRENT_LOCATION } from '../../core/places';
import { initialFlowState, rideFlowReducer, selectedQuote } from '../../core/rideFlow';
import type { RideService } from '../../core/rideService';
import type { CancelReason, Place } from '../../core/types';

const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Ocorreu um erro. Tente novamente.');

export function useRideFlow(service: RideService) {
  const [state, dispatch] = useReducer(rideFlowReducer, CURRENT_LOCATION, initialFlowState);
  const rideId = state.ride?.id;

  useEffect(() => {
    if (!rideId) return;
    return service.subscribe(rideId, (snapshot) => dispatch({ type: 'snapshot', snapshot }));
  }, [service, rideId]);

  const selectDestination = useCallback(
    async (destination: Place) => {
      dispatch({ type: 'requestStarted' });
      try {
        const quotes = await service.quotes(state.origin, destination);
        dispatch({ type: 'destinationSelected', destination, quotes });
      } catch (e) {
        dispatch({ type: 'requestFailed', message: messageOf(e) });
      }
    },
    [service, state.origin],
  );

  const requestRide = useCallback(async () => {
    if (!state.destination || !selectedQuote(state)) return;
    dispatch({ type: 'requestStarted' });
    try {
      const ride = await service.requestRide({
        origin: state.origin,
        destination: state.destination,
        category: state.category,
        proposedPrice: state.draftPrice,
        autoAccept: state.autoAccept,
      });
      dispatch({ type: 'rideCreated', ride });
    } catch (e) {
      dispatch({ type: 'requestFailed', message: messageOf(e) });
    }
  }, [service, state]);

  const updatePrice = useCallback(async () => {
    if (!rideId) return;
    dispatch({ type: 'requestStarted' });
    try {
      await service.updatePrice(rideId, state.draftPrice);
      dispatch({ type: 'requestFinished' });
    } catch (e) {
      dispatch({ type: 'requestFailed', message: messageOf(e) });
    }
  }, [service, rideId, state.draftPrice]);

  const acceptOffer = useCallback(
    async (offerId: string) => {
      if (!rideId || state.acceptingOfferId) return;
      dispatch({ type: 'acceptStarted', offerId });
      const result = await service
        .acceptOffer(rideId, offerId)
        .catch(() => ({ ok: false, reason: 'network_error' }) as const);
      // Em caso de sucesso, o snapshot da subscrição leva ao ecrã do motorista.
      if (!result.ok) dispatch({ type: 'acceptFailed', reason: result.reason });
    },
    [service, rideId, state.acceptingOfferId],
  );

  const rejectOffer = useCallback(
    (offerId: string) => {
      if (rideId) service.rejectOffer(rideId, offerId).catch(() => {});
    },
    [service, rideId],
  );

  const cancelRide = useCallback(
    async (reason: CancelReason) => {
      if (!rideId) return;
      dispatch({ type: 'requestStarted' });
      try {
        await service.cancelRide(rideId, reason);
        dispatch({ type: 'requestFinished' });
      } catch (e) {
        dispatch({ type: 'requestFailed', message: messageOf(e) });
      }
    },
    [service, rideId],
  );

  return { state, dispatch, selectDestination, requestRide, updatePrice, acceptOffer, rejectOffer, cancelRide };
}

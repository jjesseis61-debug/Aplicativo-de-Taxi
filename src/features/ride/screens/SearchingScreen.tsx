import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { formatAoa } from '../../../core/money';
import { selectedQuote } from '../../../core/rideFlow';
import { Button, PriceStepper, Row, styles } from '../../../ui/components';
import type { Flow } from './types';

function useCountdown(until: number): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.round((until - now) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function SearchingScreen({ flow }: { flow: Flow }) {
  const { state, dispatch, acceptOffer, rejectOffer, updatePrice } = flow;
  const ride = state.ride!;
  const quote = selectedQuote(state);
  const countdown = useCountdown(ride.expiresAt);
  const pending = state.offers.filter((o) => o.status === 'pending');

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Row>
        <Text style={[styles.text, { flex: 1 }]}>Os motoristas estão a analisar o teu pedido.</Text>
        <Text style={styles.strong}>{countdown}</Text>
      </Row>

      {pending.length === 0 && <Text style={styles.muted}>A aguardar propostas…</Text>}
      {pending.map((offer) => {
        const accepting = state.acceptingOfferId === offer.id;
        return (
          <View key={offer.id} style={styles.card}>
            <Row>
              <View>
                <Text style={styles.strong}>{offer.driver.name}</Text>
                <Text style={styles.muted}>{offer.driver.car}</Text>
              </View>
              <Text style={styles.price}>{formatAoa(offer.price)}</Text>
            </Row>
            <Text style={styles.muted}>Chega em {offer.etaMinutes} min</Text>
            <Row>
              <Button
                title="Recusar"
                variant="secondary"
                grow
                disabled={!!state.acceptingOfferId}
                onPress={() => rejectOffer(offer.id)}
              />
              <Button
                title={`Aceitar ${formatAoa(offer.price)}`}
                grow
                loading={accepting}
                disabled={!!state.acceptingOfferId && !accepting}
                onPress={() => acceptOffer(offer.id)}
              />
            </Row>
          </View>
        );
      })}

      {quote && (
        <>
          <PriceStepper
            price={state.draftPrice}
            canDecrease={state.draftPrice > quote.minPrice}
            onStep={(direction) => dispatch({ type: 'priceStepped', direction })}
          />
          <Button
            title="Actualizar preço"
            variant="secondary"
            loading={state.busy}
            disabled={state.draftPrice === ride.proposedPrice}
            onPress={updatePrice}
          />
        </>
      )}
      {ride.autoAccept && (
        <Text style={styles.muted}>
          Aceitar automaticamente a primeira proposta de até {formatAoa(ride.proposedPrice)}.
        </Text>
      )}
      <Button title="Cancelar pedido" variant="secondary" onPress={() => dispatch({ type: 'cancelOpened' })} />
    </ScrollView>
  );
}

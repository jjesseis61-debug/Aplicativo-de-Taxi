import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { formatAoa } from '../../../core/money';
import { CATEGORY_LABEL, isBelowRecommended } from '../../../core/pricing';
import { selectedQuote } from '../../../core/rideFlow';
import { Button, MapPlaceholder, PriceStepper, Row, styles } from '../../../ui/components';
import { colors } from '../../../ui/theme';
import type { Flow } from './types';

export function PricingScreen({ flow }: { flow: Flow }) {
  const { state, dispatch } = flow;
  const quote = selectedQuote(state);
  if (!quote || !state.destination) return null;
  const atMinimum = state.draftPrice <= quote.minPrice;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => dispatch({ type: 'back' })}>
        <Text style={styles.text}>← {state.destination.label}</Text>
      </Pressable>
      <MapPlaceholder label={`${state.origin.label} → ${state.destination.label}`} />

      {state.quotes.map((q) => (
        <Pressable
          key={q.category}
          accessibilityRole="radio"
          accessibilityState={{ selected: q.category === state.category }}
          onPress={() => dispatch({ type: 'categorySelected', category: q.category })}
          style={[styles.card, q.category === state.category && styles.cardSelected]}
        >
          <Row>
            <Text style={styles.strong}>{CATEGORY_LABEL[q.category]}</Text>
            <Text style={styles.text}>{formatAoa(q.recommendedPrice)}</Text>
          </Row>
        </Pressable>
      ))}

      <PriceStepper
        price={state.draftPrice}
        canDecrease={!atMinimum}
        onStep={(direction) => dispatch({ type: 'priceStepped', direction })}
      />
      <Text style={[styles.muted, { textAlign: 'center' }]}>
        {atMinimum
          ? `O preço mínimo é ${formatAoa(quote.minPrice)}`
          : `Preço recomendado: ${formatAoa(quote.recommendedPrice)}`}
      </Text>
      {isBelowRecommended(state.draftPrice, quote) && (
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          Abaixo do recomendado poderá receber menos propostas.
        </Text>
      )}

      <Text style={styles.strong}>Pagamento: Dinheiro</Text>
      <Row>
        <Text style={[styles.text, { flex: 1 }]}>
          Aceitar automaticamente a primeira proposta de até {formatAoa(state.draftPrice)}
        </Text>
        <Switch
          value={state.autoAccept}
          onValueChange={() => dispatch({ type: 'autoAcceptToggled' })}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </Row>
      <View>
        <Button title="Procurar motorista" onPress={() => dispatch({ type: 'pickupConfirmationOpened' })} />
      </View>
    </ScrollView>
  );
}

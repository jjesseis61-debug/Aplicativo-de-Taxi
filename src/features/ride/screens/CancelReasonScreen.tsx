import { Pressable, ScrollView, Text } from 'react-native';

import { CANCEL_REASONS } from '../../../core/cancelReasons';
import { styles } from '../../../ui/components';
import { colors } from '../../../ui/theme';
import type { Flow } from './types';

export function CancelReasonScreen({ flow }: { flow: Flow }) {
  const { state, dispatch, cancelRide } = flow;
  const assigned = state.ride?.status === 'driver_assigned';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => dispatch({ type: 'cancelClosed' })}>
        <Text style={styles.text}>✕ Voltar</Text>
      </Pressable>
      <Text style={styles.title}>CANCELAR A VIAGEM</Text>
      {assigned && (
        <Text style={[styles.text, { color: colors.primary, textAlign: 'center' }]}>
          O motorista já está a caminho. Antes de confirmar, diz-nos porque queres cancelar.
        </Text>
      )}
      {CANCEL_REASONS.map(({ reason, label }) => (
        <Pressable
          key={reason}
          accessibilityRole="button"
          disabled={state.busy}
          onPress={() => cancelRide(reason)}
          style={styles.card}
        >
          <Text style={styles.text}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

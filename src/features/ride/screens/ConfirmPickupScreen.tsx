import { Pressable, Text, View } from 'react-native';

import { formatAoa } from '../../../core/money';
import { Button, MapPlaceholder, styles } from '../../../ui/components';
import type { Flow } from './types';

export function ConfirmPickupScreen({ flow }: { flow: Flow }) {
  const { state, dispatch, requestRide } = flow;
  return (
    <View style={styles.content}>
      <Pressable onPress={() => dispatch({ type: 'back' })}>
        <Text style={styles.text}>← Voltar</Text>
      </Pressable>
      <MapPlaceholder label="Ponto de partida" />
      <Text style={styles.title}>CONFIRMA O PONTO DE PARTIDA</Text>
      <View style={styles.card}>
        <Text style={styles.strong}>{state.origin.label}</Text>
        <Text style={styles.muted}>{state.origin.address}</Text>
      </View>
      <Button
        title={`Confirmar (${formatAoa(state.draftPrice)})`}
        loading={state.busy}
        onPress={requestRide}
      />
    </View>
  );
}

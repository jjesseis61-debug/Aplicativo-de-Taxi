import { ScrollView, Text, View } from 'react-native';

import { formatAoa } from '../../../core/money';
import { Button, MapPlaceholder, Row, styles } from '../../../ui/components';
import type { Flow } from './types';

export function DriverScreen({ flow }: { flow: Flow }) {
  const { state, dispatch } = flow;
  // Tudo o que é mostrado aqui vem de ride.assignment (servidor).
  const ride = state.ride!;
  const assignment = ride.assignment!;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <MapPlaceholder label={`Motorista a caminho · ${assignment.etaMinutes} min`} />
      <View style={styles.card}>
        <Text style={styles.strong}>{assignment.driver.name.toUpperCase()}</Text>
        {assignment.driver.verified && <Text style={styles.muted}>Motorista verificado</Text>}
        <Text style={styles.text}>
          {assignment.driver.plate} · {assignment.driver.car}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.text}>● {ride.origin.label}</Text>
        <Text style={styles.text}>■ {ride.destination.label}</Text>
        <Row>
          <Text style={styles.strong}>Dinheiro</Text>
          <Text style={styles.strong}>{formatAoa(assignment.price)}</Text>
        </Row>
      </View>
      <Button title="Cancelar a minha viagem" variant="secondary" onPress={() => dispatch({ type: 'cancelOpened' })} />
    </ScrollView>
  );
}

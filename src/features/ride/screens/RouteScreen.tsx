import { Pressable, ScrollView, Text, View } from 'react-native';

import { SAVED_PLACES } from '../../../core/places';
import { styles } from '../../../ui/components';
import type { Flow } from './types';

export function RouteScreen({ flow }: { flow: Flow }) {
  const { state, selectDestination } = flow;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>A TUA ROTA</Text>
      <View style={styles.card}>
        <Text style={styles.strong}>● {state.origin.label}</Text>
        <Text style={styles.muted}>{state.origin.address}</Text>
      </View>
      <Text style={styles.muted}>Para onde vais?</Text>
      {SAVED_PLACES.map((place) => (
        <Pressable
          key={place.id}
          accessibilityRole="button"
          disabled={state.busy}
          onPress={() => selectDestination(place)}
          style={styles.card}
        >
          <Text style={styles.strong}>{place.label}</Text>
          <Text style={styles.muted}>{place.address}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

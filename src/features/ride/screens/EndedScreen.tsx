import { Text, View } from 'react-native';

import { Button, styles } from '../../../ui/components';
import type { Flow } from './types';

export function EndedScreen({ flow }: { flow: Flow }) {
  const { state, dispatch } = flow;
  const cancelled = state.phase === 'cancelled';
  return (
    <View style={[styles.content, { flex: 1, justifyContent: 'center' }]}>
      <Text style={styles.title}>{cancelled ? 'VIAGEM CANCELADA' : 'NENHUM MOTORISTA ACEITOU'}</Text>
      <Text style={[styles.muted, { textAlign: 'center' }]}>
        {cancelled ? 'O teu cancelamento foi registado.' : 'Tenta de novo, talvez com outro preço.'}
      </Text>
      <Button title="Nova viagem" onPress={() => dispatch({ type: 'reset' })} />
    </View>
  );
}

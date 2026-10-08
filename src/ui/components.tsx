import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatAoa } from '../core/money';
import type { Aoa } from '../core/types';
import { colors, spacing } from './theme';

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  grow,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  // Dentro de uma Row, ocupa o espaço disponível.
  grow?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.button,
        grow && styles.buttonGrow,
        variant === 'secondary' && styles.buttonSecondary,
        inactive && variant === 'primary' && styles.buttonDisabled,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function PriceStepper({
  price,
  canDecrease,
  onStep,
}: {
  price: Aoa;
  canDecrease: boolean;
  onStep: (direction: 1 | -1) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityLabel="Baixar preço"
        disabled={!canDecrease}
        onPress={() => onStep(-1)}
        style={[styles.stepButton, !canDecrease && styles.buttonDisabled]}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.price}>{formatAoa(price)}</Text>
      <Pressable accessibilityLabel="Subir preço" onPress={() => onStep(1)} style={styles.stepButton}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Pressable accessibilityRole="alert" onPress={onDismiss} style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
      <Text style={styles.errorText}>✕</Text>
    </Pressable>
  );
}

// Lugar reservado para o mapa (ex.: react-native-maps) numa próxima etapa.
export function MapPlaceholder({ label }: { label: string }) {
  return (
    <View style={styles.map}>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  text: { color: colors.text, fontSize: 15 },
  strong: { color: colors.text, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardSelected: { borderColor: colors.text },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonGrow: { flexGrow: 1 },
  buttonSecondary: { backgroundColor: colors.border },
  buttonDisabled: { backgroundColor: colors.primaryDisabled },
  buttonText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.text, fontSize: 24, fontWeight: '700' },
  price: { color: colors.text, fontSize: 28, fontWeight: '800' },
  error: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.danger,
    borderRadius: 8,
    padding: spacing.md,
  },
  errorText: { color: colors.text, fontWeight: '600' },
  map: {
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

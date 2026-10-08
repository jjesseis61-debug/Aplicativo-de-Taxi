import type { CancelReason } from './types';

export const CANCEL_REASONS: { reason: CancelReason; label: string }[] = [
  { reason: 'driver_not_showing', label: 'O motorista não apareceu' },
  { reason: 'driver_refused', label: 'O motorista recusou-se a fazer a viagem' },
  { reason: 'driver_too_far', label: 'O motorista está muito longe' },
  { reason: 'change_destination', label: 'Quero alterar o local de destino' },
  { reason: 'wrong_pickup', label: 'Ponto de partida errado' },
  { reason: 'other', label: 'Outro' },
];

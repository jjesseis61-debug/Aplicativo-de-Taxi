import type { Aoa } from './types';

// "4900" -> "4 900 AOA". Feito à mão porque o suporte a Intl/locale pt-AO
// varia entre motores JS (Hermes, web).
export function formatAoa(value: Aoa): string {
  const digits = Math.round(Math.abs(value)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${value < 0 ? '-' : ''}${grouped} AOA`;
}

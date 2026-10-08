import { expect, test } from '@jest/globals';

import { CURRENT_LOCATION, SAVED_PLACES } from '../places';
import { clampPrice, quoteFor, quotesFor } from '../pricing';

const dest = SAVED_PLACES[0];

test('preço mínimo fica abaixo do recomendado e ambos alinhados ao passo', () => {
  const q = quoteFor(CURRENT_LOCATION, dest, 'baza');
  expect(q.minPrice).toBeLessThan(q.recommendedPrice);
  expect(q.recommendedPrice % q.step).toBe(0);
  expect(q.minPrice % q.step).toBe(0);
});

test('categorias superiores custam mais', () => {
  const [baza, cool, boss] = quotesFor(CURRENT_LOCATION, dest);
  expect(cool.recommendedPrice).toBeGreaterThan(baza.recommendedPrice);
  expect(boss.recommendedPrice).toBeGreaterThan(cool.recommendedPrice);
});

test('clampPrice não deixa descer abaixo do mínimo', () => {
  const q = quoteFor(CURRENT_LOCATION, dest, 'baza');
  expect(clampPrice(0, q)).toBe(q.minPrice);
  expect(clampPrice(q.recommendedPrice + 149, q)).toBe(q.recommendedPrice + 100);
});

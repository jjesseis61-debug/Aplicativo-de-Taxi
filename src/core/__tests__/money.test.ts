import { expect, test } from '@jest/globals';

import { formatAoa } from '../money';

test('formata kwanzas com separador de milhares', () => {
  expect(formatAoa(4900)).toBe('4 900 AOA');
  expect(formatAoa(12500)).toBe('12 500 AOA');
  expect(formatAoa(700)).toBe('700 AOA');
  expect(formatAoa(1250000)).toBe('1 250 000 AOA');
});

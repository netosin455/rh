import { describe, expect, it } from 'vitest';
import { calendarDaysInclusive, isValidIsoDate } from '../helpers/datas';

describe('validação de datas de ausência', () => {
  it('rejeita data civil inexistente em vez de normalizá-la silenciosamente', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-31')).toBe(false);
  });

  it('conta datas civis de modo inclusivo sem depender do fuso local', () => {
    expect(calendarDaysInclusive('2026-10-31', '2026-11-02')).toBe(3);
  });
});

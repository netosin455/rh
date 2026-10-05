// tests/camposData.test.ts
import { describe, expect, it } from 'vitest';
import {
  foraDoIntervalo,
  horaValida,
  isoParaBr,
  lerDataBr,
  lerHora,
  mascararData,
  mascararHora,
  mensagemDeData,
  mensagemDeHora,
  validarHorarios,
  validarPeriodo,
} from '../helpers/camposData';

describe('data: ISO <-> BR', () => {
  it('ISO para BR', () => {
    expect(isoParaBr('2026-10-05')).toBe('05/10/2026');
    expect(isoParaBr('2026-10-05T12:00:00Z')).toBe('05/10/2026');
    for (const ruim of ['', null, undefined, '2026-02-31', 'abc']) expect(isoParaBr(ruim as string), String(ruim)).toBe('');
  });

  it('BR para ISO, ida e volta', () => {
    expect(lerDataBr('05/10/2026')).toEqual({ estado: 'ok', iso: '2026-10-05' });
    expect(lerDataBr('05102026')).toEqual({ estado: 'ok', iso: '2026-10-05' });
    expect(isoParaBr((lerDataBr('29/02/2028') as { iso: string }).iso)).toBe('29/02/2028');
  });

  it('vazio, incompleto e inexistente têm estados distintos', () => {
    expect(lerDataBr('')).toEqual({ estado: 'vazio' });
    expect(lerDataBr('  ')).toEqual({ estado: 'vazio' });
    expect(lerDataBr('05/10')).toEqual({ estado: 'incompleto' });
    expect(lerDataBr('05/10/20')).toEqual({ estado: 'incompleto' });
  });

  it('datas que não existem: 31/02, 30/02, dia 0, mês 13, 29/02 em ano não bissexto', () => {
    for (const ruim of ['31/02/2026', '30/02/2026', '00/10/2026', '10/13/2026', '29/02/2027', '31/04/2026']) {
      expect(lerDataBr(ruim), ruim).toEqual({ estado: 'invalido' });
    }
    expect(lerDataBr('29/02/2028').estado).toBe('ok');
  });

  it('máscara de digitação', () => {
    expect(mascararData('0')).toBe('0');
    expect(mascararData('0510')).toBe('05/10');
    expect(mascararData('05102026')).toBe('05/10/2026');
    expect(mascararData('05/10/2026999')).toBe('05/10/2026');
    expect(mascararData('ab05x10')).toBe('05/10');
  });

  it('mensagens específicas, nunca "Data inválida" genérico', () => {
    expect(mensagemDeData(lerDataBr('31/02/2026'))).toBe('Essa data não existe no calendário. Confira o dia e o mês.');
    expect(mensagemDeData(lerDataBr('05/10'), 'a data de nascimento')).toBe('Complete a data de nascimento no formato DD/MM/AAAA.');
    expect(mensagemDeData(lerDataBr(''))).toBeNull();
    expect(mensagemDeData(lerDataBr('05/10/2026'))).toBeNull();
  });
});

describe('data: limites e período', () => {
  it('foraDoIntervalo respeita min e max (inclusivos)', () => {
    expect(foraDoIntervalo('2026-10-05', '2026-10-05', '2026-10-10')).toBe(false);
    expect(foraDoIntervalo('2026-10-04', '2026-10-05')).toBe(true);
    expect(foraDoIntervalo('2026-10-11', undefined, '2026-10-10')).toBe(true);
    expect(foraDoIntervalo('2026-10-11')).toBe(false);
  });

  it('período: Até nunca antes de De; igual vale; incompleto não reclama aqui', () => {
    expect(validarPeriodo('2026-10-05', '2026-10-04')).toBe('A data final não pode ser antes da inicial.');
    expect(validarPeriodo('2026-10-05', '2026-10-05')).toBeNull();
    expect(validarPeriodo('2026-10-05', '2026-10-06')).toBeNull();
    expect(validarPeriodo('2026-10-05', '')).toBeNull();
    expect(validarPeriodo('', '2026-10-05')).toBeNull();
  });
});

describe('hora', () => {
  it('horaValida: 00:00 e 23:59 valem; 24:00, 12:60, 9:00 e texto não', () => {
    for (const ok of ['00:00', '09:30', '23:59']) expect(horaValida(ok), ok).toBe(true);
    for (const ruim of ['24:00', '12:60', '9:00', '09:5', 'ab:cd', '', null, undefined, 930]) expect(horaValida(ruim), String(ruim)).toBe(false);
  });

  it('lerHora: vazio, incompleto, inválido e ok', () => {
    expect(lerHora('')).toEqual({ estado: 'vazio' });
    expect(lerHora('09')).toEqual({ estado: 'incompleto' });
    expect(lerHora('09:3')).toEqual({ estado: 'incompleto' });
    expect(lerHora('24:00')).toEqual({ estado: 'invalido' });
    expect(lerHora('23:60')).toEqual({ estado: 'invalido' });
    expect(lerHora('0930')).toEqual({ estado: 'ok', iso: '09:30' });
    expect(lerHora('00:00')).toEqual({ estado: 'ok', iso: '00:00' });
  });

  it('máscara de hora', () => {
    expect(mascararHora('9')).toBe('9');
    expect(mascararHora('093')).toBe('09:3');
    expect(mascararHora('0930')).toBe('09:30');
    expect(mascararHora('09:30:99')).toBe('09:30');
  });

  it('mensagens específicas', () => {
    expect(mensagemDeHora(lerHora('24:00'))).toBe('Esse horário não existe. Use de 00:00 a 23:59.');
    expect(mensagemDeHora(lerHora('09'), 'o início')).toBe('Complete o início no formato HH:mm.');
    expect(mensagemDeHora(lerHora('09:30'))).toBeNull();
  });

  it('fim precisa ser DEPOIS do início (igual não vale); só compara se os dois existem', () => {
    expect(validarHorarios('09:00', '10:30')).toBeNull();
    expect(validarHorarios('10:30', '09:00')).toBe('O fim precisa ser depois do início.');
    expect(validarHorarios('09:00', '09:00')).toBe('O fim precisa ser depois do início.');
    expect(validarHorarios('09:00', '')).toBeNull();
    expect(validarHorarios('', '09:00')).toBeNull();
    expect(validarHorarios('23:59', '00:00')).toBe('O fim precisa ser depois do início.');
  });
});

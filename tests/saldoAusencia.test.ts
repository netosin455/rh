// tests/saldoAusencia.test.ts
import { describe, expect, it } from 'vitest';
import { efeitoDaExclusao } from '../helpers/saldoAusencia';

const MARIA = { name: 'Maria Souza', vacation_days: 20, folga_hours: 6 };

describe('efeitoDaExclusao', () => {
  it('folga aprovada com horas: as horas voltam e mostra o saldo antes e depois', () => {
    expect(efeitoDaExclusao({ type: 'folga', status: 'aprovado', hours: 4, days_count: 1 }, MARIA))
      .toBe('As 4h de folga voltam ao banco de horas de Maria; saldo passa de 6h para 10h.');
  });

  it('férias aprovadas: os dias voltam', () => {
    expect(efeitoDaExclusao({ type: 'ferias', status: 'aprovado', days_count: 10 }, MARIA))
      .toBe('Os 10 dias de férias voltam para Maria; saldo passa de 20 dias para 30 dias.');
    expect(efeitoDaExclusao({ type: 'ferias', status: 'aprovado', days_count: 1 }, { ...MARIA, vacation_days: 0 }))
      .toBe('O 1 dia de férias volta para Maria; saldo passa de 0 dias para 1 dia.');
  });

  it('falta, licença, outro e folga sem horas não alteram saldo', () => {
    for (const type of ['falta', 'licenca_medica', 'outro', 'folga'] as const) {
      expect(efeitoDaExclusao({ type, status: 'aprovado', days_count: 2 }, MARIA)).toBe('Esta exclusão não altera saldo.');
    }
  });

  it('sem dados do colaborador (saldo desatualizado) não inventa números nem diz que não altera', () => {
    expect(efeitoDaExclusao({ type: 'folga', status: 'aprovado', hours: 4, days_count: 1 }, undefined)).toBe('O saldo do colaborador será ajustado ao excluir.');
    expect(efeitoDaExclusao({ type: 'ferias', status: 'aprovado', days_count: 3 }, undefined)).toBe('O saldo do colaborador será ajustado ao excluir.');
    expect(efeitoDaExclusao({ type: 'falta', status: 'aprovado', days_count: 1 }, undefined)).toBe('Esta exclusão não altera saldo.');
  });

  it('pendente nunca descontou nada: não altera saldo', () => {
    expect(efeitoDaExclusao({ type: 'folga', status: 'pendente', hours: 4, days_count: 1 }, MARIA)).toBe('Esta exclusão não altera saldo.');
  });
});

// tests/fechamento.test.ts — navegação de mês, formatação e CSV do fechamento
import { describe, expect, it } from 'vitest';
import {
  AVISO_SALDO_BANCO, BOM_UTF8, campoCsv, celula, filtrarLinhas, mesValido, montarCsvFechamento, nomeArquivoFechamento,
  normalizarFechamento, numeroBr, rotuloDoMes, somarLinhas, somarMeses,
} from '../helpers/fechamento';
import type { Fechamento, FechamentoLinha } from '../tipos/modelos';

const ZERO = { faltas_dias: 0, faltas_horas: 0, folgas_horas: 0, ferias_dias: 0, licencas_dias: 0, banco_horas_saldo: 0 };
const ANA: FechamentoLinha = { employee_id: 1, name: 'Ana Souza', department_name: 'Jurídico', role_title: 'Advogada', ...ZERO, faltas_dias: 2, faltas_horas: 4.5, banco_horas_saldo: 10 };
const JOSE: FechamentoLinha = { employee_id: 2, name: 'José "Zé"; Silva', department_name: null, role_title: 'Analista', ...ZERO, ferias_dias: 10 };

describe('mês', () => {
  it('valida AAAA-MM', () => {
    expect(mesValido('2026-10')).toBe(true);
    for (const ruim of ['2026-13', '2026-00', '26-10', '2026-1', '', '2026/10']) expect(mesValido(ruim)).toBe(false);
  });

  it('anterior/próximo atravessam o ano', () => {
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-10', 0)).toBe('2026-10');
  });

  it('rótulo por extenso', () => {
    expect(rotuloDoMes('2026-10')).toBe('Outubro de 2026');
    expect(rotuloDoMes('2026-03')).toBe('Março de 2026');
  });
});

describe('formatação', () => {
  it('vírgula decimal, até 2 casas e sem zeros à toa', () => {
    expect(numeroBr(2.5)).toBe('2,5');
    expect(numeroBr(10)).toBe('10');
    expect(numeroBr(0.256)).toBe('0,26');
    expect(numeroBr(-2.5)).toBe('-2,5');
  });

  it('zero e vazio aparecem como "-" na tabela', () => {
    expect(celula(0)).toBe('-');
    expect(celula(null)).toBe('-');
    expect(celula(4.5)).toBe('4,5');
    expect(celula(-1)).toBe('-1');
  });
});

describe('normalizar, filtrar e somar', () => {
  it('numeric em texto vira número', () => {
    const bruto = { month: '2026-10', gerado_em: 'x', saldo_referencia: 'atual', linhas: [{ ...ANA, folgas_horas: '3.50' as never }], totais: { ...ZERO, folgas_horas: '3.50' as never } } as Fechamento;
    const n = normalizarFechamento(bruto);
    expect(n.linhas[0].folgas_horas).toBe(3.5);
    expect(n.totais.folgas_horas).toBe(3.5);
  });

  it('filtra por nome sem acento e soma só o que está visível', () => {
    expect(filtrarLinhas([ANA, JOSE], 'jose').map((l) => l.employee_id)).toEqual([2]);
    expect(filtrarLinhas([ANA, JOSE], '  ')).toHaveLength(2);
    expect(somarLinhas([ANA, JOSE])).toEqual({ ...ZERO, faltas_dias: 2, faltas_horas: 4.5, ferias_dias: 10, banco_horas_saldo: 10 });
  });
});

describe('CSV', () => {
  it('escapa ponto e vírgula, aspas e quebra de linha; protege contra fórmula', () => {
    expect(campoCsv('Ana')).toBe('Ana');
    expect(campoCsv('José "Zé"; Silva')).toBe('"José ""Zé""; Silva"');
    expect(campoCsv('a\nb')).toBe('"a\nb"');
    expect(campoCsv('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(campoCsv('-cmd')).toBe("'-cmd");
  });

  it('BOM, separador ponto e vírgula, decimais com vírgula, TOTAL e observação', () => {
    const totais = somarLinhas([ANA, JOSE]);
    const csv = montarCsvFechamento('2026-10', [ANA, JOSE], totais);
    expect(csv.startsWith(BOM_UTF8)).toBe(true);
    const linhas = csv.slice(1).split('\r\n');
    expect(linhas[0]).toBe('Fechamento de Outubro de 2026');
    expect(linhas[1]).toBe('Colaborador;Departamento;Faltas (dias);Faltas (horas);Folgas (horas);Férias (dias);Licenças (dias);Saldo do banco (horas)');
    expect(linhas[2]).toBe('Ana Souza;Jurídico;2;4,5;0;0;0;10');
    expect(linhas[3]).toBe('"José ""Zé""; Silva";;0;0;0;10;0;0');
    expect(linhas[4]).toBe('TOTAL;;2;4,5;0;10;0;10');
    expect(linhas[5]).toBe(AVISO_SALDO_BANCO);
    expect(csv.endsWith('\r\n')).toBe(true);
    // Nenhum ponto decimal no CSV (Excel brasileiro).
    expect(linhas.slice(2, 5).join('')).not.toMatch(/\d\.\d/);
  });

  it('nome do arquivo', () => {
    expect(nomeArquivoFechamento('2026-10')).toBe('fechamento-2026-10.csv');
  });
});

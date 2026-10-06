// ============================================================
// helpers/fechamento.ts — SuperRH
// Fechamento do mês: navegação de mês, formatação da tabela, filtro e CSV para o Excel brasileiro.
// Sem React e sem rede.
// ============================================================

import type { Fechamento, FechamentoLinha, FechamentoValores } from '../tipos/modelos';
import { normalizarTexto } from './buscaColaborador';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const AVISO_SALDO_BANCO = 'O saldo do banco de horas é o saldo ATUAL, não o de fim do mês.';

export function mesValido(mes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

/** "2026-10" a partir de uma data ISO (AAAA-MM-DD). */
export function mesDaData(iso: string): string {
  return iso.slice(0, 7);
}

/** Soma `delta` meses (negativo volta). "2026-01" − 1 = "2025-12". */
export function somarMeses(mes: string, delta: number): string {
  const [ano, m] = mes.split('-').map(Number);
  const indice = ano * 12 + (m - 1) + delta;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`;
}

/** "Outubro de 2026". */
export function rotuloDoMes(mes: string): string {
  if (!mesValido(mes)) return mes;
  const [ano, m] = mes.split('-').map(Number);
  const nome = MESES[m - 1];
  return `${nome.charAt(0).toLocaleUpperCase('pt-BR')}${nome.slice(1)} de ${ano}`;
}

/** Número com vírgula decimal e até 2 casas, sem zeros à toa: 2,5 / 10 / 0,25. */
export function numeroBr(n: number): string {
  return String(Number(n.toFixed(2))).replace('.', ',');
}

/** Valor da tabela: zero (ou vazio) aparece como "-" para leitura rápida. */
export function celula(n: number | null | undefined): string {
  return !n ? '-' : numeroBr(n);
}

export interface ColunaFechamento {
  chave: keyof FechamentoValores;
  /** Texto do cabeçalho da tabela. */
  titulo: string;
  /** Texto do cabeçalho no CSV (com a unidade). */
  csv: string;
}

export const COLUNAS_FECHAMENTO: readonly ColunaFechamento[] = [
  { chave: 'faltas_dias', titulo: 'Faltas (dias)', csv: 'Faltas (dias)' },
  { chave: 'faltas_horas', titulo: 'Faltas (h)', csv: 'Faltas (horas)' },
  { chave: 'folgas_horas', titulo: 'Folgas (h)', csv: 'Folgas (horas)' },
  { chave: 'ferias_dias', titulo: 'Férias (dias)', csv: 'Férias (dias)' },
  { chave: 'licencas_dias', titulo: 'Licenças (dias)', csv: 'Licenças (dias)' },
  { chave: 'banco_horas_saldo', titulo: 'Saldo do banco (h)', csv: 'Saldo do banco (horas)' },
];

/** A API pode devolver numeric do Postgres como texto: tudo vira número (inválido vira 0). */
function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function valoresNormalizados(bruto: Partial<Record<keyof FechamentoValores, unknown>> | undefined): FechamentoValores {
  return {
    faltas_dias: numero(bruto?.faltas_dias),
    faltas_horas: numero(bruto?.faltas_horas),
    folgas_horas: numero(bruto?.folgas_horas),
    ferias_dias: numero(bruto?.ferias_dias),
    licencas_dias: numero(bruto?.licencas_dias),
    banco_horas_saldo: numero(bruto?.banco_horas_saldo),
  };
}

/** Leitura tolerante da resposta da API. */
export function normalizarFechamento(bruto: Fechamento): Fechamento {
  return {
    month: bruto.month,
    gerado_em: bruto.gerado_em,
    saldo_referencia: 'atual',
    linhas: (bruto.linhas ?? []).map((l) => ({ ...l, department_name: l.department_name ?? null, ...valoresNormalizados(l) })),
    totais: valoresNormalizados(bruto.totais),
  };
}

/** Filtro opcional por nome (sem diferenciar acento nem maiúsculas). */
export function filtrarLinhas(linhas: readonly FechamentoLinha[], busca: string): FechamentoLinha[] {
  const q = normalizarTexto(busca);
  return q ? linhas.filter((l) => normalizarTexto(l.name).includes(q)) : [...linhas];
}

/** Soma as linhas mostradas (com filtro, o TOTAL acompanha o que está na tela). */
export function somarLinhas(linhas: readonly FechamentoLinha[]): FechamentoValores {
  const total = valoresNormalizados(undefined);
  for (const l of linhas) for (const c of COLUNAS_FECHAMENTO) total[c.chave] += l[c.chave];
  for (const c of COLUNAS_FECHAMENTO) total[c.chave] = Number(total[c.chave].toFixed(2));
  return total;
}

// ── CSV (Excel brasileiro) ──────────────────────────────────

export const BOM_UTF8 = '﻿';
const SEPARADOR = ';';

/**
 * Campo de TEXTO do CSV: entre aspas quando tem ; " ou quebra de linha (aspas duplicadas).
 * Texto que começaria com = + - @ ganha um apóstrofo na frente: o Excel não executa como fórmula.
 */
export function campoCsv(texto: string): string {
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** Número no CSV: vírgula decimal e zero como "0" (planilha precisa do número, não do traço). */
function numeroCsv(n: number): string {
  return numeroBr(n);
}

export function nomeArquivoFechamento(mes: string): string {
  return `fechamento-${mes}.csv`;
}

/**
 * Conteúdo do CSV: BOM UTF-8, separador ponto e vírgula, decimais com vírgula, linhas CRLF.
 * Termina com a linha TOTAL e a observação do saldo.
 */
export function montarCsvFechamento(mes: string, linhas: readonly FechamentoLinha[], totais: FechamentoValores): string {
  const cabecalho = ['Colaborador', 'Departamento', ...COLUNAS_FECHAMENTO.map((c) => c.csv)].map(campoCsv).join(SEPARADOR);
  const corpo = linhas.map((l) => [campoCsv(l.name), campoCsv(l.department_name ?? ''), ...COLUNAS_FECHAMENTO.map((c) => numeroCsv(l[c.chave]))].join(SEPARADOR));
  const total = [campoCsv('TOTAL'), '', ...COLUNAS_FECHAMENTO.map((c) => numeroCsv(totais[c.chave]))].join(SEPARADOR);
  const titulo = campoCsv(`Fechamento de ${rotuloDoMes(mes)}`);
  return `${BOM_UTF8}${[titulo, cabecalho, ...corpo, total, campoCsv(AVISO_SALDO_BANCO)].join('\r\n')}\r\n`;
}

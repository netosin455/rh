// ============================================================
// helpers/lancamento.ts — SuperRH
// Lógica pura da tela "Lançar" (falta, folga, hora extra, férias, licença).
// Sem React e sem rede: monta o payload, calcula saldo e valida.
// Os payloads seguem exatamente os que a API já aceita (não muda a API).
// ============================================================

import type { AbsenceType, CreateAbsenceData } from '../tipos/modelos';
import { brToIso, calendarDaysInclusive, isValidIsoDate } from './datas';

export type TipoLancamento = 'faltou' | 'folga' | 'hora_extra' | 'ferias' | 'licenca';
export type SubtipoLicenca = Extract<AbsenceType, 'licenca_medica' | 'licenca_maternidade' | 'licenca_paternidade' | 'outro'>;
export type AtalhoData = 'hoje' | 'ontem' | 'outro';
export type Quanto = 'dia_inteiro' | 'algumas_horas';

export const TIPOS_LANCAMENTO: readonly { key: TipoLancamento; label: string }[] = [
  { key: 'faltou', label: 'Faltou' },
  { key: 'folga', label: 'Folga' },
  { key: 'hora_extra', label: 'Hora extra' },
  { key: 'ferias', label: 'Férias' },
  { key: 'licenca', label: 'Licença' },
];

export const SUBTIPOS_LICENCA: readonly { key: SubtipoLicenca; label: string }[] = [
  { key: 'licenca_medica', label: 'Médica' },
  { key: 'licenca_maternidade', label: 'Maternidade' },
  { key: 'licenca_paternidade', label: 'Paternidade' },
  { key: 'outro', label: 'Outro' },
];

/** O que o RH preencheu na tela. Datas em DD/MM/AAAA (como o usuário digita). */
export interface EntradaLancamento {
  tipo: TipoLancamento;
  licenca: SubtipoLicenca;
  atalhoData: AtalhoData;
  /** Usado quando atalhoData === 'outro' (Faltou/Folga). */
  outroDia: string;
  inicio: string;
  fim: string;
  quanto: Quanto;
  horas: string;
  observacao: string;
}

/** Saldos atuais do colaborador. */
export interface SaldoColaborador {
  vacation_days: number;
  folga_hours: number;
}

export type PayloadLancamento =
  | { via: 'ausencia'; dados: CreateAbsenceData }
  | { via: 'banco_horas'; employee_id: number; folga_hours_delta: number };

export interface PreviaSaldo {
  rotulo: string;
  antes: number;
  depois: number;
  unidade: 'h' | 'dias';
}

export type ResultadoMontagem =
  | { ok: true; payload: PayloadLancamento; previa: PreviaSaldo | null }
  | { ok: false; erro: string };

export function entradaInicial(): EntradaLancamento {
  return { tipo: 'faltou', licenca: 'licenca_medica', atalhoData: 'hoje', outroDia: '', inicio: '', fim: '', quanto: 'dia_inteiro', horas: '', observacao: '' };
}

/** Faltou e Folga têm um único dia; Férias e Licença têm período. */
export function usaPeriodo(tipo: TipoLancamento): boolean {
  return tipo === 'ferias' || tipo === 'licenca';
}

/** Só Faltou escolhe entre dia inteiro e algumas horas. Folga SEMPRE exige horas (desconta do banco). */
export function usaQuanto(tipo: TipoLancamento): boolean {
  return tipo === 'faltou';
}

/** Atalhos de horas mostrados em Folga (chips que preenchem o campo). */
export const ATALHOS_HORAS_FOLGA: readonly number[] = [2, 4, 8];

/** Salvar fica desabilitado enquanto Folga não tiver horas válidas (> 0). */
export function faltamHorasNaFolga(entrada: EntradaLancamento): boolean {
  return entrada.tipo === 'folga' && parseHoras(entrada.horas) == null;
}

export function mostraBancoHoras(tipo: TipoLancamento): boolean {
  return tipo === 'folga' || tipo === 'hora_extra';
}

/** Data ISO de "ontem" a partir de "hoje" (aritmética em UTC: imune a horário de verão). */
export function diaAnterior(hojeIso: string): string {
  const [ano, mes, dia] = hojeIso.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia - 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Converte texto de horas ("2", "2,5") em número > 0; null se inválido ou vazio. */
export function parseHoras(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (limpo === '') return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "10h", "2,5h" — sem zeros à toa. */
export function formatarHoras(n: number): string {
  return `${String(Number(n.toFixed(2))).replace('.', ',')}h`;
}

function formatarDias(n: number): string {
  return `${n} dia${n === 1 ? '' : 's'}`;
}

/** Data única do lançamento (Faltou/Folga) em ISO, ou null se "Outro dia" está vazio/inválido. */
export function dataUnica(entrada: EntradaLancamento, hojeIso: string): string | null {
  if (entrada.atalhoData === 'hoje') return hojeIso;
  if (entrada.atalhoData === 'ontem') return diaAnterior(hojeIso);
  const iso = brToIso(entrada.outroDia);
  return isValidIsoDate(iso) ? iso : null;
}

/** Tipo de ausência na API para cada botão da tela. */
export function tipoAusencia(entrada: EntradaLancamento): AbsenceType {
  switch (entrada.tipo) {
    case 'faltou': return 'falta';
    case 'folga': return 'folga';
    case 'ferias': return 'ferias';
    case 'licenca': return entrada.licenca;
    case 'hora_extra': throw new Error('Hora extra não é uma ausência.');
  }
}

/** Prévia do saldo ANTES de salvar (só Folga e Hora extra usam banco de horas). */
export function previaBancoHoras(entrada: EntradaLancamento, saldo: SaldoColaborador): PreviaSaldo | null {
  if (!mostraBancoHoras(entrada.tipo)) return null;
  const antes = saldo.folga_hours;
  const horas = parseHoras(entrada.horas);
  if (horas == null) return null;
  const depois = entrada.tipo === 'folga' ? antes - horas : antes + horas;
  return { rotulo: 'Banco de horas', antes, depois, unidade: 'h' };
}

/** Prévia dos dias de férias (usa o período digitado; sem período válido mostra só o saldo). */
export function previaFerias(entrada: EntradaLancamento, saldo: SaldoColaborador): PreviaSaldo & { dias: number | null } {
  const dias = diasDoPeriodo(entrada);
  const antes = saldo.vacation_days;
  return { rotulo: 'Dias de férias', antes, depois: dias == null ? antes : antes - dias, unidade: 'dias', dias };
}

/** Quantidade de dias do período (inclusive), ou null se inválido. */
export function diasDoPeriodo(entrada: EntradaLancamento): number | null {
  const inicio = brToIso(entrada.inicio);
  const fim = brToIso(entrada.fim);
  if (!isValidIsoDate(inicio) || !isValidIsoDate(fim) || inicio > fim) return null;
  return calendarDaysInclusive(inicio, fim);
}

/**
 * Mensagem de bloqueio quando o pedido passa do saldo (Folga acima do banco, Férias acima dos dias).
 * Serve para desabilitar o Salvar antes mesmo de tentar; a API devolveria 422 do mesmo jeito.
 */
export function bloqueioDeSaldo(entrada: EntradaLancamento, nome: string, saldo: SaldoColaborador): string | null {
  if (entrada.tipo === 'folga') {
    const horas = parseHoras(entrada.horas);
    if (horas != null && horas > saldo.folga_hours) {
      return `${nome} tem só ${formatarHoras(saldo.folga_hours)} no banco de horas. Não dá para lançar ${formatarHoras(horas)} de folga.`;
    }
  }
  if (entrada.tipo === 'ferias') {
    const dias = diasDoPeriodo(entrada);
    if (dias != null && dias > saldo.vacation_days) {
      return `${nome} tem ${formatarDias(saldo.vacation_days)} de férias disponíveis, mas o período tem ${formatarDias(dias)}.`;
    }
  }
  return null;
}

/**
 * Valida e monta o payload. Bloqueia no cliente o que a API recusaria (saldo insuficiente),
 * mas a API continua sendo a autoridade: ela revalida tudo.
 */
export function montarLancamento(
  entrada: EntradaLancamento,
  employeeId: number,
  nome: string,
  saldo: SaldoColaborador,
  hojeIso: string,
): ResultadoMontagem {
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return { ok: false, erro: 'Escolha para quem é o lançamento.' };
  }
  const observacao = entrada.observacao.trim() || undefined;

  if (entrada.tipo === 'hora_extra') {
    const horas = parseHoras(entrada.horas);
    if (horas == null) return { ok: false, erro: 'Informe quantas horas extras (um número maior que zero).' };
    return {
      ok: true,
      payload: { via: 'banco_horas', employee_id: employeeId, folga_hours_delta: horas },
      previa: previaBancoHoras(entrada, saldo),
    };
  }

  if (usaPeriodo(entrada.tipo)) {
    const inicio = brToIso(entrada.inicio);
    const fim = brToIso(entrada.fim);
    if (!entrada.inicio.trim() || !isValidIsoDate(inicio)) return { ok: false, erro: 'Informe a data de início (DD/MM/AAAA).' };
    if (!entrada.fim.trim() || !isValidIsoDate(fim)) return { ok: false, erro: 'Informe a data de fim (DD/MM/AAAA).' };
    if (inicio > fim) return { ok: false, erro: 'A data de fim não pode ser antes do início.' };
    const dias = calendarDaysInclusive(inicio, fim);
    const bloqueio = bloqueioDeSaldo(entrada, nome, saldo);
    if (bloqueio) return { ok: false, erro: bloqueio };
    return {
      ok: true,
      payload: {
        via: 'ausencia',
        dados: { employee_id: employeeId, type: tipoAusencia(entrada), start_date: inicio, end_date: fim, reason: observacao },
      },
      previa: entrada.tipo === 'ferias' ? previaFerias(entrada, saldo) : null,
    };
  }

  // Faltou / Folga: um único dia. Faltou: horas opcionais (em branco = dia inteiro). Folga: horas obrigatórias.
  const dia = dataUnica(entrada, hojeIso);
  if (dia == null) return { ok: false, erro: 'Informe o dia (DD/MM/AAAA).' };

  let horas: number | undefined;
  if (entrada.tipo === 'folga' || entrada.quanto === 'algumas_horas') {
    const h = parseHoras(entrada.horas);
    if (h == null) {
      return { ok: false, erro: entrada.tipo === 'folga' ? 'Informe quantas horas de folga (um número maior que zero).' : 'Informe quantas horas (um número maior que zero).' };
    }
    horas = h;
  }
  const bloqueio = bloqueioDeSaldo(entrada, nome, saldo);
  if (bloqueio) return { ok: false, erro: bloqueio };
  return {
    ok: true,
    payload: {
      via: 'ausencia',
      dados: { employee_id: employeeId, type: tipoAusencia(entrada), start_date: dia, end_date: dia, hours: horas, reason: observacao },
    },
    previa: entrada.tipo === 'folga' ? previaBancoHoras(entrada, saldo) : null,
  };
}

function dataCurta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

const ROTULO_LICENCA: Record<SubtipoLicenca, string> = {
  licenca_medica: 'Licença médica',
  licenca_maternidade: 'Licença maternidade',
  licenca_paternidade: 'Licença paternidade',
  outro: 'Afastamento',
};

/** Frase do toast de sucesso: o que foi lançado e para quem. */
export function descreverLancamento(payload: PayloadLancamento, entrada: EntradaLancamento, nome: string, previa: PreviaSaldo | null): string {
  const banco = previa && previa.unidade === 'h' && previa.antes !== previa.depois
    ? ` Banco de horas: ${formatarHoras(previa.antes)} → ${formatarHoras(previa.depois)}.`
    : '';
  if (payload.via === 'banco_horas') {
    return `${formatarHoras(payload.folga_hours_delta)} de hora extra lançadas para ${nome}.${banco}`;
  }
  const d = payload.dados;
  const periodo = d.start_date === d.end_date ? `em ${dataCurta(d.start_date)}` : `de ${dataCurta(d.start_date)} a ${dataCurta(d.end_date)}`;
  switch (entrada.tipo) {
    case 'faltou': return `Falta${d.hours != null ? ` de ${formatarHoras(d.hours)}` : ''} lançada para ${nome} ${periodo}.`;
    case 'folga': return `Folga${d.hours != null ? ` de ${formatarHoras(d.hours)}` : ''} lançada para ${nome} ${periodo}.${banco}`;
    case 'ferias': return `Férias ${periodo} (${formatarDias(calendarDaysInclusive(d.start_date, d.end_date))}) lançadas para ${nome}.`;
    case 'licenca': return `${ROTULO_LICENCA[entrada.licenca]} ${periodo} lançada para ${nome}.`;
    case 'hora_extra': return `Hora extra lançada para ${nome}.`;
  }
}

// ============================================================
// helpers/saldoAusencia.ts — SuperRH
// Efeito no saldo de excluir um lançamento de ausência, em texto para a confirmação.
// Só lançamento APROVADO mexe em saldo (o pendente ainda não descontou nada). Sem React e sem rede.
// A API é a autoridade: ela devolve/ajusta o saldo de verdade; aqui é só o aviso antes de confirmar.
// ============================================================

import type { Absence, Employee } from '../tipos/modelos';
import { formatarHoras } from './lancamento';

type DadosColaborador = Pick<Employee, 'name' | 'vacation_days' | 'folga_hours'> | undefined;

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** "As 4h de folga voltam ao banco de horas de Maria; saldo passa de 6h para 10h." / férias idem / "Não altera saldo." */
export function efeitoDaExclusao(ausencia: Pick<Absence, 'type' | 'status' | 'hours' | 'days_count'>, colaborador: DadosColaborador): string {
  const semEfeito = 'Esta exclusão não altera saldo.';
  if (ausencia.status !== 'aprovado' || !colaborador) return semEfeito;
  const nome = primeiroNome(colaborador.name);

  if (ausencia.type === 'folga' && ausencia.hours != null && ausencia.hours > 0) {
    const saldo = Number(colaborador.folga_hours);
    return `As ${formatarHoras(ausencia.hours)} de folga voltam ao banco de horas de ${nome}; saldo passa de ${formatarHoras(saldo)} para ${formatarHoras(saldo + ausencia.hours)}.`;
  }
  if (ausencia.type === 'ferias' && ausencia.days_count > 0) {
    const dias = ausencia.days_count;
    const saldo = colaborador.vacation_days;
    const rotulo = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
    return `${dias === 1 ? 'O' : 'Os'} ${rotulo(dias)} de férias ${dias === 1 ? 'volta' : 'voltam'} para ${nome}; saldo passa de ${rotulo(saldo)} para ${rotulo(saldo + dias)}.`;
  }
  return semEfeito;
}

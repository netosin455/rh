// ============================================================
// helpers/camposData.ts — SuperRH
// Conversão e validação de data/hora para os campos DateField e TimeField.
// A aplicação trabalha SEMPRE em ISO (AAAA-MM-DD e HH:mm); o texto DD/MM/AAAA e HH:mm
// só existe na digitação (fallback nativo). Sem React e sem rede.
// ============================================================

import { isValidIsoDate } from './datas';

// ── Data ────────────────────────────────────────────────────

export type LeituraCampo =
  | { estado: 'vazio' }
  | { estado: 'incompleto' }
  | { estado: 'invalido' }
  | { estado: 'ok'; iso: string };

/** ISO -> "DD/MM/AAAA". ISO ausente ou inválido => "". */
export function isoParaBr(iso: string | null | undefined): string {
  if (!iso || !isValidIsoDate(iso.slice(0, 10))) return '';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Máscara de digitação: só dígitos, no formato DD/MM/AAAA. */
export function mascararData(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Lê o texto digitado: vazio, incompleto, inválido (ex.: 31/02) ou ok com o ISO. */
export function lerDataBr(texto: string): LeituraCampo {
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length === 0) return { estado: 'vazio' };
  if (digitos.length < 8) return { estado: 'incompleto' };
  const iso = `${digitos.slice(4, 8)}-${digitos.slice(2, 4)}-${digitos.slice(0, 2)}`;
  return isValidIsoDate(iso) ? { estado: 'ok', iso } : { estado: 'invalido' };
}

/** Mensagem específica para cada problema de data (nunca um "Data inválida" genérico). */
export function mensagemDeData(leitura: LeituraCampo, nomeDoCampo = 'a data'): string | null {
  if (leitura.estado === 'incompleto') return `Complete ${nomeDoCampo} no formato DD/MM/AAAA.`;
  if (leitura.estado === 'invalido') return `Essa data não existe no calendário. Confira o dia e o mês.`;
  return null;
}

/** True se o ISO está fora de [min, max] (limites opcionais, também em ISO). */
export function foraDoIntervalo(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}

/** Período De/Até: "Até" nunca antes de "De". Devolve a mensagem ou null. */
export function validarPeriodo(inicioIso: string, fimIso: string): string | null {
  if (!isValidIsoDate(inicioIso) || !isValidIsoDate(fimIso)) return null; // campos incompletos: quem chama avisa
  return fimIso < inicioIso ? 'A data final não pode ser antes da inicial.' : null;
}

// ── Hora ────────────────────────────────────────────────────

/** True para "HH:mm" real (00:00 a 23:59). "24:00" e "12:60" não valem. */
export function horaValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{2}:\d{2}$/.test(valor)) return false;
  const [h, m] = valor.split(':').map(Number);
  return (h ?? 99) <= 23 && (m ?? 99) <= 59;
}

/** Máscara de digitação: só dígitos, no formato HH:mm. */
export function mascararHora(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** Lê o texto digitado: vazio, incompleto, inválido (ex.: 24:00) ou ok com "HH:mm". */
export function lerHora(texto: string): LeituraCampo {
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length === 0) return { estado: 'vazio' };
  if (digitos.length < 4) return { estado: 'incompleto' };
  const iso = `${digitos.slice(0, 2)}:${digitos.slice(2, 4)}`;
  return horaValida(iso) ? { estado: 'ok', iso } : { estado: 'invalido' };
}

export function mensagemDeHora(leitura: LeituraCampo, nomeDoCampo = 'o horário'): string | null {
  if (leitura.estado === 'incompleto') return `Complete ${nomeDoCampo} no formato HH:mm.`;
  if (leitura.estado === 'invalido') return 'Esse horário não existe. Use de 00:00 a 23:59.';
  return null;
}

/** Fim precisa ser DEPOIS do início (igual também não vale). Só compara se os dois existem. */
export function validarHorarios(inicio: string, fim: string): string | null {
  if (!horaValida(inicio) || !horaValida(fim)) return null;
  return fim <= inicio ? 'O fim precisa ser depois do início.' : null;
}

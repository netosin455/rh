// ============================================================
// helpers/pesquisa.ts — SuperRH
// Lógica pura das pesquisas com várias perguntas: editor do RH, validação,
// montagem de payloads, respostas do colaborador e leitura tolerante da API
// (aceita o formato antigo de 1 pergunta). Sem React e sem rede.
// ============================================================

import type {
  CreateSurveyData,
  NewSurveyQuestion,
  PublicSurvey,
  PulseSurvey,
  QuestionResult,
  SurveyAnswerInput,
  SurveyQuestion,
  SurveyResults,
  SurveyType,
} from '../tipos/modelos';
import { brToIso, isValidIsoDate } from './datas';

export const MAX_PERGUNTAS = 10;
export const MIN_OPCOES = 2;
export const MAX_OPCOES = 8;
export const MAX_TEXTO = 1000;

export const TIPOS_PERGUNTA: readonly { tipo: SurveyType; titulo: string; explicacao: string }[] = [
  { tipo: 'scale', titulo: 'Escala 1 a 5', explicacao: 'A pessoa dá uma nota de 1 a 5.' },
  { tipo: 'choice', titulo: 'Escolha', explicacao: 'A pessoa escolhe uma opção da lista.' },
  { tipo: 'text', titulo: 'Aberta', explicacao: 'A pessoa escreve com as próprias palavras.' },
];

// ── Editor do RH ────────────────────────────────────────────

/** Pergunta em edição. `chave` é só local (identifica o cartão), nunca vai para a API. */
export interface PerguntaRascunho {
  chave: string;
  question: string;
  type: SurveyType;
  options: string[];
  required: boolean;
}

let contadorChave = 0;
function novaChave(): string {
  contadorChave += 1;
  return `p${contadorChave}`;
}

export function perguntaNova(type: SurveyType = 'scale'): PerguntaRascunho {
  return { chave: novaChave(), question: '', type, options: type === 'choice' ? ['', ''] : [], required: true };
}

export function podeAdicionarPergunta(perguntas: readonly PerguntaRascunho[]): boolean {
  return perguntas.length < MAX_PERGUNTAS;
}

export function adicionarPergunta(perguntas: readonly PerguntaRascunho[]): PerguntaRascunho[] {
  return podeAdicionarPergunta(perguntas) ? [...perguntas, perguntaNova()] : [...perguntas];
}

/** Duplica logo abaixo da original; respeita o limite de 10. */
export function duplicarPergunta(perguntas: readonly PerguntaRascunho[], indice: number): PerguntaRascunho[] {
  const original = perguntas[indice];
  if (!original || !podeAdicionarPergunta(perguntas)) return [...perguntas];
  const copia: PerguntaRascunho = { ...original, chave: novaChave(), options: [...original.options] };
  return [...perguntas.slice(0, indice + 1), copia, ...perguntas.slice(indice + 1)];
}

/** Não deixa a lista ficar vazia: toda pesquisa tem pelo menos 1 pergunta. */
export function removerPergunta(perguntas: readonly PerguntaRascunho[], indice: number): PerguntaRascunho[] {
  if (perguntas.length <= 1) return [...perguntas];
  return perguntas.filter((_, i) => i !== indice);
}

/** delta = -1 sobe, +1 desce. Fora dos limites não faz nada. */
export function moverPergunta(perguntas: readonly PerguntaRascunho[], indice: number, delta: -1 | 1): PerguntaRascunho[] {
  const destino = indice + delta;
  if (destino < 0 || destino >= perguntas.length) return [...perguntas];
  const copia = [...perguntas];
  const [item] = copia.splice(indice, 1);
  copia.splice(destino, 0, item);
  return copia;
}

/** Troca o tipo. Escolha ganha 2 opções em branco; os outros tipos descartam as opções. */
export function trocarTipo(pergunta: PerguntaRascunho, type: SurveyType): PerguntaRascunho {
  if (pergunta.type === type) return pergunta;
  return { ...pergunta, type, options: type === 'choice' ? (pergunta.options.length >= MIN_OPCOES ? pergunta.options : ['', '']) : [] };
}

export function podeAdicionarOpcao(pergunta: PerguntaRascunho): boolean {
  return pergunta.options.length < MAX_OPCOES;
}

export function adicionarOpcao(pergunta: PerguntaRascunho): PerguntaRascunho {
  return podeAdicionarOpcao(pergunta) ? { ...pergunta, options: [...pergunta.options, ''] } : pergunta;
}

/** Remove uma opção, mantendo o mínimo de 2 campos. */
export function removerOpcao(pergunta: PerguntaRascunho, indice: number): PerguntaRascunho {
  if (pergunta.options.length <= MIN_OPCOES) return pergunta;
  return { ...pergunta, options: pergunta.options.filter((_, i) => i !== indice) };
}

export function editarOpcao(pergunta: PerguntaRascunho, indice: number, texto: string): PerguntaRascunho {
  return { ...pergunta, options: pergunta.options.map((o, i) => (i === indice ? texto : o)) };
}

// ── Validação (erros no próprio campo) ──────────────────────

export interface ErrosPergunta {
  question?: string;
  /** Erro geral das opções (ex.: "Coloque pelo menos 2 opções"). */
  opcoes?: string;
  /** Erro por opção, pelo índice. */
  opcao?: Record<number, string>;
}

export interface ErrosPesquisa {
  titulo?: string;
  validade?: string;
  perguntas: Record<string, ErrosPergunta>;
}

/** Interpreta a data de encerramento digitada (DD/MM/AAAA). Vazio = sem prazo (null). */
export function lerValidade(texto: string): { ok: true; iso: string | null } | { ok: false } {
  if (texto.trim() === '') return { ok: true, iso: null };
  const iso = brToIso(texto);
  return isValidIsoDate(iso) ? { ok: true, iso } : { ok: false };
}

export function validarPesquisa(titulo: string, validadeBr: string, perguntas: readonly PerguntaRascunho[]): { ok: boolean; erros: ErrosPesquisa; totalErros: number } {
  const erros: ErrosPesquisa = { perguntas: {} };
  let total = 0;
  if (!titulo.trim()) { erros.titulo = 'Dê um título para a pesquisa'; total++; }
  if (!lerValidade(validadeBr).ok) { erros.validade = 'Use o formato DD/MM/AAAA'; total++; }

  for (const p of perguntas) {
    const e: ErrosPergunta = {};
    if (!p.question.trim()) { e.question = 'Escreva a pergunta'; total++; }
    if (p.type === 'choice') {
      const preenchidas = p.options.map((o) => o.trim());
      const opcao: Record<number, string> = {};
      preenchidas.forEach((o, i) => { if (o === '') opcao[i] = 'Preencha ou remova esta opção'; });
      const validas = preenchidas.filter((o) => o !== '');
      if (validas.length < MIN_OPCOES) { e.opcoes = 'Coloque pelo menos 2 opções'; total++; }
      else if (new Set(validas.map((o) => o.toLowerCase())).size !== validas.length) { e.opcoes = 'Há opções repetidas'; total++; }
      const vazias = Object.keys(opcao).length;
      if (vazias > 0) { e.opcao = opcao; total += vazias; }
    }
    if (e.question || e.opcoes || e.opcao) erros.perguntas[p.chave] = e;
  }
  return { ok: total === 0, erros, totalErros: total };
}

/** Monta o corpo do POST /api/surveys (só chame depois de validarPesquisa ok). */
export function montarPesquisa(titulo: string, validadeBr: string, perguntas: readonly PerguntaRascunho[]): CreateSurveyData {
  const validade = lerValidade(validadeBr);
  const questions: NewSurveyQuestion[] = perguntas.map((p) => ({
    question: p.question.trim(),
    type: p.type,
    ...(p.type === 'choice' ? { options: p.options.map((o) => o.trim()).filter((o) => o !== '') } : {}),
    required: p.required,
  }));
  return { title: titulo.trim(), expires_at: validade.ok ? validade.iso : null, questions };
}

/** Pesquisa de mentira para a prévia "Ver como o colaborador vai ver" (nada é gravado). */
export function previaPublica(titulo: string, perguntas: readonly PerguntaRascunho[]): PublicSurvey {
  return {
    id: 0,
    title: titulo.trim() || 'Título da pesquisa',
    expires_at: null,
    questions: perguntas.map((p, i) => ({
      id: i + 1,
      position: i + 1,
      question: p.question.trim() || 'Pergunta sem texto',
      type: p.type,
      options: p.type === 'choice' ? p.options.map((o) => o.trim()).filter((o) => o !== '') : null,
      required: p.required,
    })),
  };
}

// ── Responder (colaborador) ─────────────────────────────────

/** Resposta em andamento a uma pergunta. */
export interface RespostaLocal {
  score?: number;
  choice?: string;
  text?: string;
}

export type RespostasLocais = Record<number, RespostaLocal>;

export function estaRespondida(pergunta: SurveyQuestion, resposta: RespostaLocal | undefined): boolean {
  if (!resposta) return false;
  if (pergunta.type === 'scale') return typeof resposta.score === 'number' && resposta.score >= 1 && resposta.score <= 5;
  if (pergunta.type === 'choice') return typeof resposta.choice === 'string' && (pergunta.options ?? []).includes(resposta.choice);
  return typeof resposta.text === 'string' && resposta.text.trim() !== '';
}

/** Mensagem que bloqueia o "Próxima" (ou null se pode seguir). */
export function bloqueioDeAvanco(pergunta: SurveyQuestion, resposta: RespostaLocal | undefined): string | null {
  if (pergunta.type === 'text' && (resposta?.text ?? '').length > MAX_TEXTO) return `Use no máximo ${MAX_TEXTO} caracteres.`;
  if (!pergunta.required || estaRespondida(pergunta, resposta)) return null;
  if (pergunta.type === 'text') return 'Escreva sua resposta para continuar.';
  return 'Escolha uma resposta para continuar.';
}

/** Corpo do POST /api/surveys/:id/respond. Pula as opcionais em branco. */
export function montarRespostas(perguntas: readonly SurveyQuestion[], respostas: RespostasLocais): SurveyAnswerInput[] {
  const out: SurveyAnswerInput[] = [];
  for (const p of perguntas) {
    const r = respostas[p.id];
    if (!estaRespondida(p, r)) continue;
    if (p.type === 'scale') out.push({ question_id: p.id, score: r?.score });
    else if (p.type === 'choice') out.push({ question_id: p.id, choice: r?.choice });
    else out.push({ question_id: p.id, text: (r?.text ?? '').trim() });
  }
  return out;
}

/** Primeira pergunta obrigatória sem resposta (índice) ou -1. */
export function primeiraObrigatoriaPendente(perguntas: readonly SurveyQuestion[], respostas: RespostasLocais): number {
  return perguntas.findIndex((p) => p.required && !estaRespondida(p, respostas[p.id]));
}

// ── Leitura tolerante da API (formato antigo de 1 pergunta) ──

interface PesquisaLegada {
  question?: string;
  type?: SurveyType;
  options?: string[] | null;
}

function perguntasDe(bruto: { questions?: SurveyQuestion[] } & PesquisaLegada): SurveyQuestion[] {
  if (Array.isArray(bruto.questions) && bruto.questions.length > 0) {
    return [...bruto.questions].sort((a, b) => a.position - b.position).map((q) => ({ ...q, options: q.options ?? null, required: q.required !== false }));
  }
  // Pesquisa antiga: vira uma única pergunta obrigatória. id 0 sinaliza "formato antigo" no envio.
  if (bruto.question) {
    return [{ id: 0, position: 1, question: bruto.question, type: bruto.type ?? 'scale', options: bruto.options ?? null, required: true }];
  }
  return [];
}

export function normalizarPesquisaPublica(bruto: { id: number; title: string; expires_at?: string | null; questions?: SurveyQuestion[] } & PesquisaLegada): PublicSurvey {
  return { id: bruto.id, title: bruto.title, expires_at: bruto.expires_at ?? null, questions: perguntasDe(bruto) };
}

/** Pesquisa do formato antigo (sem `questions`): o envio usa o corpo antigo {score|choice}. */
export function ehFormatoAntigo(pesquisa: PublicSurvey): boolean {
  return pesquisa.questions.length === 1 && pesquisa.questions[0]?.id === 0;
}

export interface ResultadosBrutos {
  survey: PulseSurvey;
  total_responses: number;
  questions?: QuestionResult[];
  /** Formato antigo: um único bloco de resultados. */
  results?: { avg?: number; distribution?: Record<string, number> };
}

export function normalizarResultados(bruto: ResultadosBrutos): SurveyResults {
  if (Array.isArray(bruto.questions)) {
    return { survey: bruto.survey, total_responses: bruto.total_responses, questions: [...bruto.questions].sort((a, b) => a.position - b.position) };
  }
  const p = perguntasDe(bruto.survey)[0];
  const questions: QuestionResult[] = p
    ? [{ question_id: p.id, position: 1, question: p.question, type: p.type, answered: bruto.total_responses, avg: bruto.results?.avg, distribution: bruto.results?.distribution }]
    : [];
  return { survey: bruto.survey, total_responses: bruto.total_responses, questions };
}

export function rotuloTipo(tipo: SurveyType): string {
  return tipo === 'scale' ? 'Escala 1 a 5' : tipo === 'choice' ? 'Escolha' : 'Aberta';
}

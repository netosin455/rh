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
  SurveyAudience,
  SurveyContact,
  SurveyContactInput,
  SurveyAnswerInput,
  SurveyQuestion,
  SurveyResults,
  SurveyType,
  UpdateSurveyData,
} from '../tipos/modelos';
import { brToIso, isoToBr, isValidIsoDate } from './datas';

export const MAX_PERGUNTAS = 10;
export const MIN_OPCOES = 2;
export const MAX_OPCOES = 8;
export const MAX_TEXTO = 1000;

export const TIPOS_PERGUNTA: readonly { tipo: SurveyType; titulo: string; explicacao: string }[] = [
  { tipo: 'scale', titulo: 'Escala 1 a 5', explicacao: 'A pessoa dá uma nota de 1 a 5.' },
  { tipo: 'choice', titulo: 'Escolha', explicacao: 'A pessoa escolhe uma opção da lista.' },
  { tipo: 'text', titulo: 'Aberta', explicacao: 'A pessoa escreve com as próprias palavras.' },
  { tipo: 'nps', titulo: 'Nota NPS (0 a 10)', explicacao: 'De 0 a 10, quanto recomendaria? Calcula o NPS.' },
];

// ── Áreas: Pesquisas (colaboradores) e NPS (clientes) ───────

export type AreaPesquisa = 'pesquisas' | 'nps';

/** Tipos de pergunta de cada área: o NPS 0–10 só existe na área NPS; Escolha só em Pesquisas. */
export const TIPOS_POR_AREA: Record<AreaPesquisa, readonly SurveyType[]> = {
  pesquisas: ['scale', 'choice', 'text'],
  nps: ['nps', 'scale', 'text'],
};

export interface ConfigArea {
  audience: SurveyAudience;
  titulo: string;
  subtitulo: string;
  botaoNova: string;
  botaoCriarVazio: string;
  rotaRaiz: string;
  rotaNova: string;
  rotaDetalhe: (id: number) => string;
  rotaEditar: (id: number) => string;
  singular: string;
  plural: string;
  metrica: string;
  tituloLista: string;
  descricaoLista: string;
  tituloVazio: string;
  descricaoVazio: string;
}

export const AREAS_PESQUISA: Record<AreaPesquisa, ConfigArea> = {
  pesquisas: {
    audience: 'employees',
    titulo: 'Pesquisas de pulso',
    subtitulo: 'Colete feedback da equipe e acompanhe as respostas.',
    botaoNova: 'Nova pesquisa',
    botaoCriarVazio: 'Criar pesquisa',
    rotaRaiz: '/pesquisas',
    rotaNova: '/pesquisas/nova',
    rotaDetalhe: (id) => `/pesquisas/${id}`,
    rotaEditar: (id) => `/pesquisas/editar/${id}`,
    singular: 'pesquisa',
    plural: 'pesquisas',
    metrica: 'Pesquisas ativas',
    tituloLista: 'Todas as pesquisas',
    descricaoLista: 'Abra uma pesquisa para consultar os resultados.',
    tituloVazio: 'Nenhuma pesquisa criada',
    descricaoVazio: 'Crie uma pesquisa para coletar feedback da equipe.',
  },
  nps: {
    audience: 'customers',
    titulo: 'NPS — satisfação do cliente',
    subtitulo: 'Meça se os clientes recomendariam o escritório e retorne o contato de quem não ficou satisfeito.',
    botaoNova: 'Nova campanha NPS',
    botaoCriarVazio: 'Criar campanha NPS',
    rotaRaiz: '/nps',
    rotaNova: '/nps/nova',
    rotaDetalhe: (id) => `/nps/${id}`,
    rotaEditar: (id) => `/nps/editar/${id}`,
    singular: 'campanha',
    plural: 'campanhas',
    metrica: 'Campanhas ativas',
    tituloLista: 'Todas as campanhas',
    descricaoLista: 'Abra uma campanha para ver o NPS e retornar contatos.',
    tituloVazio: 'Nenhuma campanha NPS',
    descricaoVazio: 'Crie uma campanha, copie o link ou mostre o QR code para os clientes responderem.',
  },
};

// ── Editor do RH ────────────────────────────────────────────

/** Pergunta em edição. `chave` é só local (identifica o cartão), nunca vai para a API. */
export interface PerguntaRascunho {
  chave: string;
  question: string;
  type: SurveyType;
  options: string[];
  required: boolean;
  /** Só na edição: id da pergunta que já existe na API (sem id = pergunta nova). */
  id?: number;
  /** Só na edição: como a pergunta estava ao abrir (base das regras de bloqueio). */
  original?: { required: boolean; options: number };
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

/** `opcional`: pesquisa com respostas — a pergunta nova nasce opcional (regra do servidor). */
export function adicionarPergunta(perguntas: readonly PerguntaRascunho[], opcional = false): PerguntaRascunho[] {
  if (!podeAdicionarPergunta(perguntas)) return [...perguntas];
  const nova = perguntaNova();
  return [...perguntas, opcional ? { ...nova, required: false } : nova];
}

/** Duplica logo abaixo da original; respeita o limite de 10. A cópia é sempre uma pergunta NOVA (sem id). */
export function duplicarPergunta(perguntas: readonly PerguntaRascunho[], indice: number, opcional = false): PerguntaRascunho[] {
  const original = perguntas[indice];
  if (!original || !podeAdicionarPergunta(perguntas)) return [...perguntas];
  const { id: _id, original: _snapshot, ...base } = original;
  const copia: PerguntaRascunho = { ...base, chave: novaChave(), options: [...original.options], ...(opcional ? { required: false } : {}) };
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
export function montarPesquisa(titulo: string, validadeBr: string, perguntas: readonly PerguntaRascunho[], audience: SurveyAudience = 'employees'): CreateSurveyData {
  const validade = lerValidade(validadeBr);
  const questions: NewSurveyQuestion[] = perguntas.map((p) => ({
    question: p.question.trim(),
    type: p.type,
    ...(p.type === 'choice' ? { options: p.options.map((o) => o.trim()).filter((o) => o !== '') } : {}),
    required: p.required,
  }));
  // Só envia `audience` para clientes: pesquisas de colaborador seguem com o corpo de sempre.
  return { title: titulo.trim(), expires_at: validade.ok ? validade.iso : null, ...(audience === 'customers' ? { audience } : {}), questions };
}

// ── Edição, cópia e exclusão ────────────────────────────────

function ordenadas(s: Pick<PulseSurvey, 'questions'>): SurveyQuestion[] {
  return [...(s.questions ?? [])].sort((a, b) => a.position - b.position);
}

/** Pesquisa vinda da API vira rascunho do editor (cada pergunta guarda o id e o estado original). */
export function rascunhoDaPesquisa(s: Pick<PulseSurvey, 'questions'>): PerguntaRascunho[] {
  return ordenadas(s).map((q) => ({
    chave: novaChave(),
    id: q.id,
    question: q.question,
    type: q.type,
    options: [...(q.options ?? [])],
    required: q.required !== false,
    original: { required: q.required !== false, options: (q.options ?? []).length },
  }));
}

/** Prazo da API ("2026-10-05" ou timestamp) para o campo de data (DD/MM/AAAA). Sem prazo => "". */
export function validadeDoCampo(expiresAt: string | null | undefined): string {
  return expiresAt ? isoToBr(expiresAt.slice(0, 10)) : '';
}

/** Corpo do PUT /api/surveys/:id (só chame depois de validarPesquisa ok). Perguntas existentes levam o `id`. */
export function montarEdicao(titulo: string, validadeBr: string, perguntas: readonly PerguntaRascunho[]): UpdateSurveyData {
  const validade = lerValidade(validadeBr);
  return {
    title: titulo.trim(),
    expires_at: validade.ok ? validade.iso : null,
    questions: perguntas.map((p) => ({
      ...(p.id !== undefined ? { id: p.id } : {}),
      question: p.question.trim(),
      type: p.type,
      ...(p.type === 'choice' ? { options: p.options.map((o) => o.trim()).filter((o) => o !== '') } : {}),
      required: p.required,
    })),
  };
}

/** Corpo do POST para a CÓPIA de uma pesquisa: "Cópia de ...", sem prazo, mesmas perguntas (sem ids). */
export function montarCopia(s: Pick<PulseSurvey, 'title' | 'audience' | 'questions'>): CreateSurveyData {
  return {
    title: `Cópia de ${s.title}`,
    expires_at: null,
    ...(s.audience === 'customers' ? { audience: 'customers' as const } : {}),
    questions: ordenadas(s).map((q) => ({
      question: q.question,
      type: q.type,
      ...(q.type === 'choice' ? { options: [...(q.options ?? [])] } : {}),
      required: q.required !== false,
    })),
  };
}

/**
 * Restrições de UMA pergunta quando a pesquisa já tem respostas. ESPELHA a regra do servidor
 * (PUT /api/surveys/:id): com respostas só se pode mudar título, prazo, TEXTO das perguntas,
 * obrigatória de sim para não, ACRESCENTAR opções ao fim e ACRESCENTAR perguntas novas ao fim (opcionais).
 * O servidor continua sendo a autoridade: se discordar, responde 409 com os bloqueios.
 */
export interface RestricaoPergunta {
  /** Não pode trocar o tipo. */
  tipo: boolean;
  /** Não pode remover. */
  remover: boolean;
  /** Não pode mudar de posição. */
  mover: boolean;
  /** Não pode duplicar. */
  duplicar: boolean;
  /** Não pode ficar obrigatória (nova pergunta, ou já era opcional). */
  obrigatoria: boolean;
  /** As primeiras N opções (as que já existiam) ficam fixas; só dá para acrescentar ao fim. */
  opcoesFixas: number;
  /** Explicação para mostrar no cartão (null = sem restrição). */
  motivo: string | null;
}

export const SEM_RESTRICAO: RestricaoPergunta = { tipo: false, remover: false, mover: false, duplicar: false, obrigatoria: false, opcoesFixas: 0, motivo: null };

export const MOTIVO_PERGUNTA_EXISTENTE = 'Esta pergunta já tem respostas: o tipo, a posição e as opções que já existem ficam fixos. Você pode editar o texto, acrescentar opções ao fim e deixá-la opcional.';
export const MOTIVO_PERGUNTA_NOVA = 'Pergunta nova: como a pesquisa já tem respostas, ela nasce opcional e fica no fim.';

export function restricaoDaPergunta(p: PerguntaRascunho, comRespostas: boolean): RestricaoPergunta {
  if (!comRespostas) return SEM_RESTRICAO;
  if (p.id === undefined) {
    // Nova: pode tudo, menos ser obrigatória (o servidor exige required=false).
    return { ...SEM_RESTRICAO, obrigatoria: true, motivo: MOTIVO_PERGUNTA_NOVA };
  }
  return {
    tipo: true,
    remover: true,
    mover: true,
    duplicar: true,
    // Só dá para tornar opcional: se já era opcional, não volta a ser obrigatória.
    obrigatoria: p.original?.required === false,
    opcoesFixas: p.type === 'choice' ? (p.original?.options ?? 0) : 0,
    motivo: MOTIVO_PERGUNTA_EXISTENTE,
  };
}

/** Subir/descer: com respostas, só vale entre perguntas NOVAS (as existentes não mudam de posição e as novas ficam no fim). */
export function podeMoverPergunta(perguntas: readonly PerguntaRascunho[], indice: number, delta: -1 | 1, comRespostas: boolean): boolean {
  const destino = indice + delta;
  if (destino < 0 || destino >= perguntas.length) return false;
  if (!comRespostas) return true;
  return perguntas[indice].id === undefined && perguntas[destino].id === undefined;
}

/** Remover/duplicar opção: as opções que já existiam não saem do lugar nem do texto. */
export function opcaoEditavel(restricao: RestricaoPergunta, indiceOpcao: number): boolean {
  return indiceOpcao >= restricao.opcoesFixas;
}

/** "Esta pesquisa já tem 21 respostas, por isso algumas alterações estão bloqueadas." */
export function textoBannerRespostas(quantidade: number, substantivo: 'pesquisa' | 'campanha' = 'pesquisa'): string {
  const esta = substantivo === 'campanha' ? 'Esta campanha' : 'Esta pesquisa';
  return `${esta} já tem ${quantidade} ${quantidade === 1 ? 'resposta' : 'respostas'}, por isso algumas alterações estão bloqueadas.`;
}

/** Aviso da exclusão com a consequência: "Isso apaga a pesquisa e as 21 respostas. Não dá para desfazer." */
export function textoExclusaoPesquisa(quantidade: number, substantivo: 'pesquisa' | 'campanha' = 'pesquisa'): string {
  const respostas = quantidade <= 0 ? '' : quantidade === 1 ? ' e a resposta' : ` e as ${quantidade} respostas`;
  return `Isso apaga a ${substantivo}${respostas}. Não dá para desfazer.`;
}

/** Pesquisa de mentira para a prévia "Ver como o colaborador vai ver" (nada é gravado). */
export function previaPublica(titulo: string, perguntas: readonly PerguntaRascunho[], audience: SurveyAudience = 'employees'): PublicSurvey {
  return {
    id: 0,
    audience,
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
  if (pergunta.type === 'nps') return Number.isInteger(resposta.score) && (resposta.score as number) >= 0 && (resposta.score as number) <= 10;
  if (pergunta.type === 'choice') return typeof resposta.choice === 'string' && (pergunta.options ?? []).includes(resposta.choice);
  return typeof resposta.text === 'string' && resposta.text.trim() !== '';
}

/** Mensagem que bloqueia o "Próxima" (ou null se pode seguir). */
export function bloqueioDeAvanco(pergunta: SurveyQuestion, resposta: RespostaLocal | undefined): string | null {
  if (pergunta.type === 'text' && (resposta?.text ?? '').length > MAX_TEXTO) return `Use no máximo ${MAX_TEXTO} caracteres.`;
  if (!pergunta.required || estaRespondida(pergunta, resposta)) return null;
  if (pergunta.type === 'text') return 'Escreva sua resposta para continuar.';
  if (pergunta.type === 'nps') return 'Escolha uma nota de 0 a 10 para continuar.';
  return 'Escolha uma resposta para continuar.';
}

/** Corpo do POST /api/surveys/:id/respond. Pula as opcionais em branco. */
export function montarRespostas(perguntas: readonly SurveyQuestion[], respostas: RespostasLocais): SurveyAnswerInput[] {
  const out: SurveyAnswerInput[] = [];
  for (const p of perguntas) {
    const r = respostas[p.id];
    if (!estaRespondida(p, r)) continue;
    if (p.type === 'scale' || p.type === 'nps') out.push({ question_id: p.id, score: r?.score });
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

export function normalizarPesquisaPublica(bruto: { id: number; title: string; expires_at?: string | null; audience?: SurveyAudience; questions?: SurveyQuestion[] } & PesquisaLegada): PublicSurvey {
  return { id: bruto.id, title: bruto.title, expires_at: bruto.expires_at ?? null, audience: bruto.audience === 'customers' ? 'customers' : 'employees', questions: perguntasDe(bruto) };
}

/** Pesquisa do formato antigo (sem `questions`): o envio usa o corpo antigo {score|choice}. */
export function ehFormatoAntigo(pesquisa: PublicSurvey): boolean {
  return pesquisa.questions.length === 1 && pesquisa.questions[0]?.id === 0;
}

export interface ResultadosBrutos {
  survey: PulseSurvey;
  total_responses: number;
  questions?: QuestionResult[];
  contacts?: SurveyContact[];
  /** Formato antigo: um único bloco de resultados. */
  results?: { avg?: number; distribution?: Record<string, number> };
}

export function normalizarResultados(bruto: ResultadosBrutos): SurveyResults {
  if (Array.isArray(bruto.questions)) {
    return { survey: bruto.survey, total_responses: bruto.total_responses, questions: [...bruto.questions].sort((a, b) => a.position - b.position), ...(bruto.contacts ? { contacts: bruto.contacts } : {}) };
  }
  const p = perguntasDe(bruto.survey)[0];
  const questions: QuestionResult[] = p
    ? [{ question_id: p.id, position: 1, question: p.question, type: p.type, answered: bruto.total_responses, avg: bruto.results?.avg, distribution: bruto.results?.distribution }]
    : [];
  return { survey: bruto.survey, total_responses: bruto.total_responses, questions };
}

export function rotuloTipo(tipo: SurveyType): string {
  return tipo === 'scale' ? 'Escala 1 a 5' : tipo === 'choice' ? 'Escolha' : tipo === 'nps' ? 'Nota NPS (0 a 10)' : 'Aberta';
}

// ── Pesquisa de CLIENTE: modelo pronto ──────────────────────

export const TITULO_MODELO_CLIENTE = 'Satisfação do cliente';

/**
 * Modelo "Satisfação do cliente": 4 perguntas, todas editáveis.
 * Só o NPS é obrigatório; o resto é opcional para não cansar o cliente.
 */
export function modeloSatisfacaoCliente(): PerguntaRascunho[] {
  const nps = { ...perguntaNova('nps'), question: 'De 0 a 10, quanto você recomendaria nosso escritório a um amigo ou colega?', required: true };
  const motivo = { ...perguntaNova('text'), question: 'Qual o principal motivo da sua nota?', required: false };
  const atendimento = { ...perguntaNova('scale'), question: 'Como você avalia o atendimento?', required: false };
  const clareza = { ...perguntaNova('scale'), question: 'Como você avalia a clareza das informações sobre o seu processo?', required: false };
  return [nps, motivo, atendimento, clareza];
}

// ── Contato opcional do cliente (LGPD) ──────────────────────

export const MAX_NOME_CONTATO = 100;
export const MAX_TELEFONE_CONTATO = 30;
export const MAX_EMAIL_CONTATO = 120;
export const TEXTO_CONSENTIMENTO = 'Usaremos seu contato apenas para falar sobre esta avaliação.';

export interface ContatoRascunho {
  consentimento: boolean;
  nome: string;
  telefone: string;
  email: string;
}

export const CONTATO_VAZIO: ContatoRascunho = { consentimento: false, nome: '', telefone: '', email: '' };

export interface ErrosContato {
  nome?: string;
  contato?: string;
  email?: string;
  telefone?: string;
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sem consentimento o contato é ignorado por completo (ok, sem erros): nada de dado pessoal é enviado.
 * Com consentimento: nome + (telefone ou e-mail) válidos.
 */
export function validarContato(c: ContatoRascunho): { ok: boolean; erros: ErrosContato } {
  if (!c.consentimento) return { ok: true, erros: {} };
  const erros: ErrosContato = {};
  const nome = c.nome.trim();
  const telefone = c.telefone.trim();
  const email = c.email.trim();
  if (nome.length < 2) erros.nome = 'Como podemos te chamar?';
  if (!telefone && !email) erros.contato = 'Informe um telefone ou um e-mail.';
  if (telefone) {
    const digitos = telefone.replace(/\D/g, '');
    if (digitos.length < 8 || digitos.length > 15 || telefone.length > MAX_TELEFONE_CONTATO) erros.telefone = 'Confira o telefone (com DDD).';
  }
  if (email && (!REGEX_EMAIL.test(email) || email.length > MAX_EMAIL_CONTATO)) erros.email = 'Confira o e-mail.';
  return { ok: Object.keys(erros).length === 0, erros };
}

/** Contato para enviar à API, ou null (sem consentimento nada vai). Só chame com validarContato ok. */
export function montarContato(c: ContatoRascunho): SurveyContactInput | null {
  if (!c.consentimento) return null;
  const telefone = c.telefone.trim();
  const email = c.email.trim();
  return {
    name: c.nome.trim().slice(0, MAX_NOME_CONTATO),
    ...(telefone ? { phone: telefone } : {}),
    ...(email ? { email } : {}),
    consent: true,
  };
}

// ── NPS ─────────────────────────────────────────────────────

export type GrupoNps = 'promotor' | 'neutro' | 'detrator';

/** 9 e 10 promotores; 7 e 8 neutros; 0 a 6 detratores. */
export function grupoDoNps(nota: number): GrupoNps {
  if (nota >= 9) return 'promotor';
  if (nota >= 7) return 'neutro';
  return 'detrator';
}

export interface ContagemNps {
  promoters: number;
  passives: number;
  detractors: number;
}

export const POUCAS_RESPOSTAS_NPS = 10;

export function totalNps(c: ContagemNps): number {
  return c.promoters + c.passives + c.detractors;
}

/**
 * NPS = % promotores − % detratores, inteiro de −100 a +100; null sem respostas (nunca 0).
 * O servidor é a fonte oficial; isto serve de conferência e de reserva quando o campo não vier.
 */
export function calcularNps(c: ContagemNps): number | null {
  const total = totalNps(c);
  if (total <= 0) return null;
  return Math.round(((c.promoters - c.detractors) * 100) / total);
}

/** "+42", "−15", "0" ou "Sem dados". */
export function formatarNps(nps: number | null | undefined): string {
  if (nps == null) return 'Sem dados';
  if (nps > 0) return `+${nps}`;
  if (nps < 0) return `−${Math.abs(nps)}`;
  return '0';
}

export function poucasRespostasNps(total: number): boolean {
  return total > 0 && total < POUCAS_RESPOSTAS_NPS;
}

/** Percentuais (0 a 100) de cada grupo; tudo 0 sem respostas. */
export function percentuaisNps(c: ContagemNps): { promotores: number; neutros: number; detratores: number } {
  const total = totalNps(c);
  if (total <= 0) return { promotores: 0, neutros: 0, detratores: 0 };
  return { promotores: (c.promoters / total) * 100, neutros: (c.passives / total) * 100, detratores: (c.detractors / total) * 100 };
}

/** Contagem por nota de 0 a 10 (sempre 11 posições). */
export function distribuicaoNps(distribuicao: Record<string, number> | undefined): number[] {
  return Array.from({ length: 11 }, (_, nota) => distribuicao?.[String(nota)] ?? 0);
}

/** Contagem dos grupos: usa os campos do servidor e, se faltarem, soma a distribuição. */
export function contagemDoResultado(r: QuestionResult): ContagemNps {
  if (r.promoters != null && r.passives != null && r.detractors != null) return { promoters: r.promoters, passives: r.passives, detractors: r.detractors };
  const d = distribuicaoNps(r.distribution);
  return { detractors: d.slice(0, 7).reduce((t, n) => t + n, 0), passives: (d[7] ?? 0) + (d[8] ?? 0), promoters: (d[9] ?? 0) + (d[10] ?? 0) };
}

/** Quem pediu contato, separado: detratores (a retornar) e os demais. Pendentes primeiro, notas mais baixas antes. */
export function separarContatos(contatos: readonly SurveyContact[] | undefined): { aRetornar: SurveyContact[]; outros: SurveyContact[] } {
  const lista = [...(contatos ?? [])];
  const ordem = (a: SurveyContact, b: SurveyContact) =>
    Number(a.contacted_at != null) - Number(b.contacted_at != null) || (a.score ?? 11) - (b.score ?? 11) || b.submitted_at.localeCompare(a.submitted_at);
  const detrator = (c: SurveyContact) => c.score != null && grupoDoNps(c.score) === 'detrator';
  return { aRetornar: lista.filter(detrator).sort(ordem), outros: lista.filter((c) => !detrator(c)).sort(ordem) };
}

// ============================================================
// helpers/pdfPesquisa.ts — SuperRH
// Relatório em PDF dos resultados de uma pesquisa (HTML puro para impressão em A4). Funções PURAS, sem React nem
// rede, para testar o que importa:
//  - ANONIMATO: o relatório só lê os campos listados em `DadosDoRelatorio`. Contatos ("Retornar contato" do NPS),
//    telefone, e-mail, voter_token e ids de participação nunca entram (dadosDoRelatorio descarta o resto);
//  - todo texto vindo do banco (título, opções, respostas abertas) é escapado — nada vira HTML;
//  - porcentagens de cada pergunta somam exatamente 100 (maior resto);
//  - respostas abertas: TODAS, na ordem recebida, com quebra de linha preservada.
// Quem abre a janela de impressão é helpers/pdf.ts (exportPesquisaPDF).
// ============================================================

import type { QuestionResult, SurveyAudience, SurveyResults } from '../tipos/modelos';
import { calcularNps, contagemDoResultado, distribuicaoNps, formatarNps, poucasRespostasNps, rotuloTipo, totalNps } from './pesquisa';

const FUSO = 'America/Sao_Paulo';
const ROTULOS_NOTA: Record<number, string> = { 1: 'Muito ruim', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Ótimo' };

/** Tudo o que o relatório pode mostrar. Nada de contatos, tokens ou ids de participação. */
export interface DadosDoRelatorio {
  titulo: string;
  publico: SurveyAudience;
  criadaEm: string;
  expiraEm: string | null;
  totalParticipacoes: number;
  /** Colaboradores ativos (só pesquisa de colaboradores, e só se a tela/cache já tinha). undefined = não mostra %. */
  colaboradoresAtivos?: number;
  perguntas: QuestionResult[];
}

/** Escolhe do resultado da tela só o que vai ao relatório (descarta `contacts` e qualquer outro campo). */
export function dadosDoRelatorio(resultados: SurveyResults, colaboradoresAtivos?: number): DadosDoRelatorio {
  const s = resultados.survey;
  return {
    titulo: s.title,
    publico: s.audience ?? 'employees',
    criadaEm: s.created_at,
    expiraEm: s.expires_at ?? null,
    totalParticipacoes: resultados.total_responses,
    colaboradoresAtivos,
    perguntas: resultados.questions.map((q) => ({
      question_id: q.question_id, position: q.position, question: q.question, type: q.type, answered: q.answered,
      avg: q.avg, distribution: q.distribution, texts: q.texts, nps: q.nps, promoters: q.promoters, passives: q.passives, detractors: q.detractors,
    })),
  };
}

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Porcentagens inteiras que somam EXATAMENTE 100 (método do maior resto). Total 0 = tudo 0.
 * Empates no resto são resolvidos pela ordem das posições (determinístico).
 */
export function porcentagensQueSomam100(contagens: readonly number[]): number[] {
  const total = contagens.reduce((t, n) => t + Math.max(0, n), 0);
  if (total <= 0) return contagens.map(() => 0);
  // Conta em inteiros (sem ponto flutuante): parte inteira = n*100/total, resto = n*100 mod total.
  const base = contagens.map((n) => Math.floor((Math.max(0, n) * 100) / total));
  let faltam = 100 - base.reduce((t, n) => t + n, 0);
  const porResto = contagens.map((n, i) => ({ i, resto: (Math.max(0, n) * 100) % total })).sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of porResto) { if (faltam <= 0) break; base[i] += 1; faltam -= 1; }
  return base;
}

/** 4,3 → "4,3" (1 casa, vírgula). */
export function mediaBr(valor: number): string {
  return valor.toFixed(1).replace('.', ',');
}

function dataBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO });
}

function dataHoraBr(d: Date): string {
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
  return `${data} às ${hora}`;
}

/** Nome sugerido ao salvar: "titulo-da-pesquisa-AAAA-MM-DD" (sem acento nem espaço). Vai no <title>, que o navegador usa no "Salvar como PDF". */
export function nomeDoArquivo(titulo: string, agora: Date): string {
  const slug = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'pesquisa';
  const partes = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: FUSO }).format(agora); // AAAA-MM-DD
  return `${slug}-${partes}`;
}

function linhaDeBarra(rotulo: string, contagem: number, pct: number): string {
  return `<div class="linha"><div class="rotulo">${escaparHtml(rotulo)}</div><div class="trilho"><div class="barra" style="width:${pct}%"></div></div><div class="valor">${contagem} · ${pct}%</div></div>`;
}

function blocoEscolha(q: QuestionResult): string {
  const entradas = Object.entries(q.distribution ?? {});
  const pcts = porcentagensQueSomam100(entradas.map(([, n]) => n));
  return entradas.map(([opcao, n], i) => linhaDeBarra(opcao, n, pcts[i])).join('');
}

function blocoEscala(q: QuestionResult): string {
  const notas = [5, 4, 3, 2, 1];
  const contagens = notas.map((n) => q.distribution?.[String(n)] ?? 0);
  const pcts = porcentagensQueSomam100(contagens);
  const media = q.avg !== undefined && q.avg !== null ? `<p class="destaque">Média: <strong>${mediaBr(q.avg)}</strong> em uma escala de 1 a 5</p>` : '';
  return media + notas.map((n, i) => linhaDeBarra(`${n} — ${ROTULOS_NOTA[n]}`, contagens[i], pcts[i])).join('');
}

function blocoNps(q: QuestionResult): string {
  const c = contagemDoResultado(q);
  const total = totalNps(c);
  const nps = q.nps !== undefined ? q.nps : calcularNps(c);
  const pcts = porcentagensQueSomam100([c.promoters, c.passives, c.detractors]);
  const dist = distribuicaoNps(q.distribution);
  const pctsDist = porcentagensQueSomam100(dist);
  return `
    <p class="destaque">NPS: <strong class="nps">${escaparHtml(formatarNps(nps))}</strong> <span class="nota">(% de promotores menos % de detratores, de −100 a +100)</span></p>
    ${poucasRespostasNps(total) ? `<p class="aviso">Poucas respostas (${total}): use este número com cautela.</p>` : ''}
    ${linhaDeBarra('Promotores (9 e 10)', c.promoters, pcts[0])}
    ${linhaDeBarra('Neutros (7 e 8)', c.passives, pcts[1])}
    ${linhaDeBarra('Detratores (0 a 6)', c.detractors, pcts[2])}
    <p class="subtitulo">Notas de 0 a 10</p>
    ${dist.map((n, nota) => linhaDeBarra(String(nota), n, pctsDist[nota])).join('')}`;
}

function blocoAberta(q: QuestionResult): string {
  const textos = q.texts ?? [];
  const itens = textos.map((t) => `<div class="resposta">${escaparHtml(t)}</div>`).join('');
  const limitado = textos.length < q.answered ? `<p class="nota">Mostrando as ${textos.length} respostas mais recentes (de ${q.answered}).</p>` : '';
  return `<p class="nota">Respostas anônimas. Se alguém escreveu nomes ou dados pessoais, trate com cuidado.</p>${itens}${limitado}`;
}

function blocoDaPergunta(q: QuestionResult): string {
  if (q.answered === 0) return '<p class="vazio">Sem respostas</p>';
  if (q.type === 'nps') return blocoNps(q);
  if (q.type === 'scale') return blocoEscala(q);
  if (q.type === 'choice') return blocoEscolha(q);
  return blocoAberta(q);
}

const CSS = `
  @page { size: A4 portrait; margin: 16mm 14mm 20mm; @bottom-right { content: "Página " counter(page); font: 9pt 'Segoe UI', Arial, sans-serif; color: #444; } }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; font-size: 11.5pt; line-height: 1.4; background: #fff; }
  header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
  .marca { font-size: 10pt; font-weight: 700; letter-spacing: 1px; color: #444; text-transform: uppercase; }
  h1 { font-size: 20pt; line-height: 1.2; margin: 4px 0 8px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 18px; font-size: 10pt; color: #333; }
  .meta strong { color: #111; }
  .participacao { border: 1px solid #111; border-radius: 4px; padding: 8px 12px; margin: 0 0 14px; font-size: 11pt; }
  .pergunta { page-break-inside: avoid; break-inside: avoid; border-top: 1px solid #999; padding-top: 10px; margin-top: 14px; }
  .pergunta.longa { page-break-inside: auto; break-inside: auto; }
  .pergunta h2 { font-size: 12.5pt; line-height: 1.3; margin-bottom: 2px; }
  .tipo { font-size: 9pt; color: #555; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.4px; }
  .linha { display: grid; grid-template-columns: 34% 1fr 70px; align-items: center; gap: 8px; margin: 3px 0; page-break-inside: avoid; }
  .rotulo { font-size: 10pt; }
  .trilho { height: 11px; border: 1px solid #555; background: #fff; border-radius: 2px; overflow: hidden; }
  .barra { height: 100%; background: #333; }
  .valor { font-size: 10pt; text-align: right; font-variant-numeric: tabular-nums; }
  .destaque { font-size: 12pt; margin: 2px 0 8px; }
  .nps { font-size: 20pt; }
  .aviso { border: 1px dashed #111; padding: 4px 8px; margin: 0 0 8px; font-size: 10pt; font-weight: 700; }
  .subtitulo { font-size: 10.5pt; font-weight: 700; margin: 10px 0 4px; }
  .nota { font-size: 9.5pt; color: #444; margin: 4px 0; }
  .vazio { font-style: italic; color: #444; }
  .resposta { border-left: 3px solid #333; background: #f3f3f3; padding: 5px 9px; margin: 5px 0; white-space: pre-wrap; overflow-wrap: anywhere; page-break-inside: avoid; break-inside: avoid; }
  .rodape { position: fixed; bottom: 0; left: 0; right: 0; font-size: 9pt; color: #444; text-align: center; border-top: 1px solid #999; padding-top: 4px; background: #fff; }
`;

/** HTML completo do relatório. `agora` é injetado para o teste (data e hora da geração). */
export function montarHtmlPesquisa(dados: DadosDoRelatorio, agora: Date = new Date()): string {
  const cliente = dados.publico === 'customers';
  const expirou = dados.expiraEm ? new Date(dados.expiraEm).getTime() < agora.getTime() : false;
  const validade = dados.expiraEm ? `${expirou ? 'Encerrada em' : 'Encerra em'} ${dataBr(dados.expiraEm)}` : 'Sem data de encerramento';
  const ativos = dados.colaboradoresAtivos;
  const mostrarPct = !cliente && ativos !== undefined && ativos > 0;
  const participacao = mostrarPct
    ? `<strong>${dados.totalParticipacoes}</strong> de <strong>${ativos}</strong> colaboradores ativos (${Math.round((dados.totalParticipacoes / ativos) * 100)}%)`
    : `<strong>${dados.totalParticipacoes}</strong> participaç${dados.totalParticipacoes === 1 ? 'ão' : 'ões'}`;
  const perguntas = [...dados.perguntas].sort((a, b) => a.position - b.position).map((q) => `
    <section class="pergunta${q.type === 'text' && q.answered > 8 ? ' longa' : ''}">
      <h2>${q.position}. ${escaparHtml(q.question)}</h2>
      <div class="tipo">${escaparHtml(rotuloTipo(q.type))} · ${q.answered} resposta${q.answered === 1 ? '' : 's'}</div>
      ${blocoDaPergunta(q)}
    </section>`).join('');
  const arquivo = nomeDoArquivo(dados.titulo, agora);
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escaparHtml(arquivo)}</title><style>${CSS}</style></head>
<body>
  <header>
    <div class="marca">SuperRH · Relatório de pesquisa</div>
    <h1>${escaparHtml(dados.titulo)}</h1>
    <div class="meta">
      <div>Público: <strong>${cliente ? 'Clientes' : 'Colaboradores'}</strong></div>
      <div>Criada em: <strong>${dataBr(dados.criadaEm)}</strong></div>
      <div>Validade: <strong>${validade}</strong></div>
      <div>Relatório gerado em: <strong>${dataHoraBr(agora)}</strong></div>
    </div>
  </header>
  <div class="participacao">Participação: ${participacao}</div>
  ${perguntas}
  <div class="rodape">Respostas anônimas · SuperRH</div>
</body></html>`;
}

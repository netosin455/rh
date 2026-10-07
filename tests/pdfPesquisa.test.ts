// tests/pdfPesquisa.test.ts — relatório em PDF da pesquisa: escape (XSS), anonimato, porcentagens, NPS, textos, participação
import { describe, expect, it } from 'vitest';
import { dadosDoRelatorio, escaparHtml, mediaBr, montarHtmlPesquisa, nomeDoArquivo, porcentagensQueSomam100, type DadosDoRelatorio } from '../helpers/pdfPesquisa';
import type { QuestionResult, SurveyResults } from '../tipos/modelos';

const AGORA = new Date('2026-10-20T15:30:00Z'); // 12:30 em São Paulo

function pergunta(extra: Partial<QuestionResult> & Pick<QuestionResult, 'position' | 'type'>): QuestionResult {
  return { question_id: extra.position * 10, question: `Pergunta ${extra.position}`, answered: 0, ...extra };
}

function dados(extra: Partial<DadosDoRelatorio> = {}): DadosDoRelatorio {
  return { titulo: 'Pesquisa de Pulso - Outubro 2026', publico: 'employees', criadaEm: '2026-10-01T12:00:00Z', expiraEm: null, totalParticipacoes: 26, perguntas: [], ...extra };
}

describe('porcentagensQueSomam100', () => {
  it('sempre soma 100 quando há respostas (maior resto)', () => {
    for (const c of [[1, 1, 1], [1, 1, 1, 1, 1, 1], [3, 3, 1], [33, 33, 34], [7, 0, 0], [1, 2, 3, 4, 5], [5, 5]]) {
      expect(porcentagensQueSomam100(c).reduce((t, n) => t + n, 0), JSON.stringify(c)).toBe(100);
    }
  });

  it('1/1/1 = 34/33/33; sem respostas = tudo 0; valores inteiros', () => {
    expect(porcentagensQueSomam100([1, 1, 1])).toEqual([34, 33, 33]);
    expect(porcentagensQueSomam100([0, 0, 0])).toEqual([0, 0, 0]);
    expect(porcentagensQueSomam100([2, 6]).every(Number.isInteger)).toBe(true);
  });
});

describe('escape (XSS)', () => {
  it('escapaHtml troca & < > " \'', () => {
    expect(escaparHtml(`<script>alert("x")</script> & 'a'`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;a&#39;');
  });

  it('título, pergunta, opções e respostas abertas nunca viram HTML', () => {
    const html = montarHtmlPesquisa(dados({
      titulo: '<img src=x onerror=alert(1)>Clima',
      perguntas: [
        pergunta({ position: 1, type: 'choice', question: '<b>Escolha</b>', answered: 2, distribution: { '<script>1</script>': 2 } }),
        pergunta({ position: 2, type: 'text', question: 'Aberta', answered: 1, texts: ['<script>alert(1)</script>'] }),
      ],
    }), AGORA);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>Escolha');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;Clima');
  });
});

describe('perguntas', () => {
  it('mantém a ordem pela posição, mesmo com a lista embaralhada', () => {
    const html = montarHtmlPesquisa(dados({ perguntas: [pergunta({ position: 3, type: 'text' }), pergunta({ position: 1, type: 'text' }), pergunta({ position: 2, type: 'text' })] }), AGORA);
    expect(html.indexOf('1. Pergunta 1')).toBeLessThan(html.indexOf('2. Pergunta 2'));
    expect(html.indexOf('2. Pergunta 2')).toBeLessThan(html.indexOf('3. Pergunta 3'));
  });

  it('pergunta sem respostas mostra "Sem respostas"', () => {
    const html = montarHtmlPesquisa(dados({ perguntas: [pergunta({ position: 1, type: 'scale', answered: 0 })] }), AGORA);
    expect(html).toContain('Sem respostas');
  });

  it('escolha: uma barra por opção, contagem e % somando 100', () => {
    const html = montarHtmlPesquisa(dados({ perguntas: [pergunta({ position: 1, type: 'choice', answered: 3, distribution: { Sim: 1, Não: 1, Talvez: 1 } })] }), AGORA);
    expect(html).toContain('1 · 34%');
    expect(html.match(/1 · 33%/g)).toHaveLength(2);
    expect(html).toContain('width:34%');
  });

  it('escala: média com 1 casa e vírgula, notas de 5 a 1 com rótulos', () => {
    const html = montarHtmlPesquisa(dados({ perguntas: [pergunta({ position: 1, type: 'scale', answered: 4, avg: 4.25, distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 } })] }), AGORA);
    expect(mediaBr(4.25)).toBe('4,3');
    expect(html).toContain('<strong>4,3</strong>');
    expect(html.indexOf('5 — Ótimo')).toBeLessThan(html.indexOf('1 — Muito ruim'));
    expect(html).toContain('2 · 50%');
  });

  it('NPS: número com sinal, grupos com contagem e %, distribuição 0..10 e aviso de poucas respostas', () => {
    const dist = Object.fromEntries(Array.from({ length: 11 }, (_, n) => [String(n), n === 10 ? 4 : n === 8 ? 1 : n === 3 ? 1 : 0]));
    const html = montarHtmlPesquisa(dados({ publico: 'customers', perguntas: [pergunta({ position: 1, type: 'nps', answered: 6, nps: 50, promoters: 4, passives: 1, detractors: 1, distribution: dist })] }), AGORA);
    expect(html).toContain('+50');
    expect(html).toContain('Promotores (9 e 10)');
    expect(html).toContain('4 · 67%');
    expect(html).toContain('Notas de 0 a 10');
    expect(html).toContain('Poucas respostas (6)');
    // negativo usa o sinal de menos tipográfico
    expect(montarHtmlPesquisa(dados({ perguntas: [pergunta({ position: 1, type: 'nps', answered: 3, nps: -33, promoters: 0, passives: 1, detractors: 2, distribution: {} })] }), AGORA)).toContain('−33');
  });

  it('NPS com 10 ou mais respostas não mostra o aviso', () => {
    const html = montarHtmlPesquisa(dados({ perguntas: [pergunta({ position: 1, type: 'nps', answered: 12, nps: 0, promoters: 4, passives: 4, detractors: 4, distribution: {} })] }), AGORA);
    expect(html).not.toContain('Poucas respostas');
  });
});

describe('respostas abertas', () => {
  it('lista TODAS na ordem recebida e preserva quebras de linha (white-space: pre-wrap)', () => {
    const textos = Array.from({ length: 200 }, (_, i) => `Resposta ${i + 1}\nsegunda linha`);
    const html = montarHtmlPesquisa(dados({ perguntas: [pergunta({ position: 1, type: 'text', answered: 200, texts: textos })] }), AGORA);
    expect(html.match(/class="resposta"/g)).toHaveLength(200);
    expect(html.indexOf('Resposta 1\nsegunda')).toBeLessThan(html.indexOf('Resposta 2\nsegunda'));
    expect(html).toContain('white-space: pre-wrap');
    expect(html).not.toContain('Mostrando as');
  });

  it('quando a API limitou os textos, avisa "Mostrando as N respostas mais recentes"', () => {
    const html = montarHtmlPesquisa(dados({ perguntas: [pergunta({ position: 1, type: 'text', answered: 350, texts: Array.from({ length: 200 }, (_, i) => `t${i}`) })] }), AGORA);
    expect(html).toContain('Mostrando as 200 respostas mais recentes');
  });
});

describe('cabeçalho, participação e rodapé', () => {
  it('colaboradores com N conhecido: "26 de 39 colaboradores ativos (67%)"', () => {
    const html = montarHtmlPesquisa(dados({ colaboradoresAtivos: 39 }), AGORA);
    expect(html).toContain('<strong>26</strong> de <strong>39</strong> colaboradores ativos (67%)');
    expect(html).toContain('Colaboradores');
  });

  it('sem N (ou N = 0): só o total, SEM inventar porcentagem', () => {
    for (const ativos of [undefined, 0]) {
      const html = montarHtmlPesquisa(dados({ colaboradoresAtivos: ativos }), AGORA);
      expect(html).toContain('<strong>26</strong> participações');
      expect(html).not.toContain('colaboradores ativos');
      expect(html).not.toMatch(/\d+%\)/);
    }
  });

  it('clientes: só o total, mesmo que passem o N', () => {
    const html = montarHtmlPesquisa(dados({ publico: 'customers', colaboradoresAtivos: 39, totalParticipacoes: 1 }), AGORA);
    expect(html).toContain('<strong>1</strong> participação');
    expect(html).not.toContain('colaboradores ativos');
    expect(html).toContain('Clientes');
  });

  it('validade: sem data, encerrada e futura; criação e geração em horário de São Paulo', () => {
    expect(montarHtmlPesquisa(dados(), AGORA)).toContain('Sem data de encerramento');
    expect(montarHtmlPesquisa(dados({ expiraEm: '2026-10-10T12:00:00Z' }), AGORA)).toContain('Encerrada em 10/10/2026');
    expect(montarHtmlPesquisa(dados({ expiraEm: '2026-10-30T12:00:00Z' }), AGORA)).toContain('Encerra em 30/10/2026');
    const html = montarHtmlPesquisa(dados(), AGORA);
    expect(html).toContain('01/10/2026');
    expect(html).toContain('20/10/2026 às 12:30');
  });

  it('rodapé "Respostas anônimas", A4 retrato e número de página no @page', () => {
    const html = montarHtmlPesquisa(dados(), AGORA);
    expect(html).toContain('Respostas anônimas · SuperRH');
    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('counter(page)');
    expect(html).toContain('page-break-inside: avoid');
  });

  it('nome sugerido do arquivo: sem acento e sem espaço, com a data de São Paulo', () => {
    expect(nomeDoArquivo('Pesquisa de Pulso - Outubro 2026', AGORA)).toBe('pesquisa-de-pulso-outubro-2026-2026-10-20');
    expect(nomeDoArquivo('Satisfação do cliente!', AGORA)).toBe('satisfacao-do-cliente-2026-10-20');
    expect(nomeDoArquivo('???', AGORA)).toBe('pesquisa-2026-10-20');
    expect(montarHtmlPesquisa(dados(), AGORA)).toContain('<title>pesquisa-de-pulso-outubro-2026-2026-10-20</title>');
  });
});

describe('anonimato: nada que identifique quem respondeu', () => {
  it('contatos do NPS (nome, telefone, e-mail, ids) NÃO vazam, nem com o objeto completo da tela', () => {
    const resultados = {
      survey: { id: 7, company_id: 1, created_by: 1, title: 'Satisfação do cliente', audience: 'customers', target_dept: null, created_at: '2026-10-01T12:00:00Z' },
      total_responses: 3,
      questions: [pergunta({ position: 1, type: 'nps', answered: 3, nps: 33, promoters: 2, passives: 0, detractors: 1, distribution: { '10': 2, '3': 1 } })],
      contacts: [{ submission_id: 991, name: 'Cliente Secreto', phone: '11 98888-7777', email: 'secreto@cliente.test', score: 3, comment: 'Quero retorno', submitted_at: '2026-10-02', contacted_at: null }],
      voter_token: 'TOKEN-VOTER-ABC',
    } as unknown as SurveyResults;
    const html = montarHtmlPesquisa(dadosDoRelatorio(resultados), AGORA);
    for (const proibido of ['Cliente Secreto', '98888-7777', 'secreto@cliente.test', 'Quero retorno', 'TOKEN-VOTER-ABC', 'Retornar contato', 'contacts', 'voter_token', 'submission', '991']) {
      expect(html, `vazou: ${proibido}`).not.toContain(proibido);
    }
  });

  it('dadosDoRelatorio só carrega os campos permitidos', () => {
    const r = { survey: { title: 'X', created_at: '2026-10-01', audience: 'employees' }, total_responses: 1, questions: [], contacts: [{ name: 'A' }] } as unknown as SurveyResults;
    expect(Object.keys(dadosDoRelatorio(r, 5)).sort()).toEqual(['colaboradoresAtivos', 'criadaEm', 'expiraEm', 'perguntas', 'publico', 'titulo', 'totalParticipacoes']);
  });
});

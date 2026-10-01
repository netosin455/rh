// tests/nps.test.ts
// Pesquisa de CLIENTE: modelo pronto, pergunta NPS, contato com consentimento (LGPD), NPS e QR.
import { describe, expect, it } from 'vitest';
import type { QuestionResult, SurveyContact, SurveyQuestion } from '../tipos/modelos';
import {
  CONTATO_VAZIO,
  ContatoRascunho,
  TEXTO_CONSENTIMENTO,
  TIPOS_PERGUNTA,
  TITULO_MODELO_CLIENTE,
  bloqueioDeAvanco,
  calcularNps,
  contagemDoResultado,
  distribuicaoNps,
  estaRespondida,
  formatarNps,
  grupoDoNps,
  modeloSatisfacaoCliente,
  montarContato,
  montarPesquisa,
  montarRespostas,
  normalizarPesquisaPublica,
  normalizarResultados,
  perguntaNova,
  percentuaisNps,
  poucasRespostasNps,
  previaPublica,
  rotuloTipo,
  separarContatos,
  validarContato,
  validarPesquisa,
} from '../helpers/pesquisa';
import { MARGEM_QR, gerarQr, htmlParaImpressao, qrParaSvg, trechosDoQr } from '../helpers/qr';

describe('modelo "Satisfação do cliente"', () => {
  it('monta as 4 perguntas na ordem do plano; só o NPS é obrigatório', () => {
    const m = modeloSatisfacaoCliente();
    expect(m.map((p) => p.type)).toEqual(['nps', 'text', 'scale', 'scale']);
    expect(m.map((p) => p.required)).toEqual([true, false, false, false]);
    expect(m[0]?.question).toBe('De 0 a 10, quanto você recomendaria nosso escritório a um amigo ou colega?');
    expect(m[1]?.question).toBe('Qual o principal motivo da sua nota?');
    expect(m[2]?.question).toBe('Como você avalia o atendimento?');
    expect(m[3]?.question).toBe('Como você avalia a clareza das informações sobre o seu processo?');
    expect(TITULO_MODELO_CLIENTE).toBe('Satisfação do cliente');
  });

  it('cada chamada gera chaves novas (cartões independentes) e a lista é editável sem afetar a próxima', () => {
    const a = modeloSatisfacaoCliente();
    const b = modeloSatisfacaoCliente();
    expect(new Set([...a, ...b].map((p) => p.chave)).size).toBe(8);
    a[0] = { ...a[0]!, question: 'editada' };
    expect(b[0]?.question).not.toBe('editada');
  });

  it('o modelo passa na validação com título e vira o corpo do POST com audience customers', () => {
    const m = modeloSatisfacaoCliente();
    expect(validarPesquisa(TITULO_MODELO_CLIENTE, '', m).ok).toBe(true);
    const corpo = montarPesquisa(TITULO_MODELO_CLIENTE, '', m, 'customers');
    expect(corpo.audience).toBe('customers');
    expect(corpo.questions.map((q) => q.type)).toEqual(['nps', 'text', 'scale', 'scale']);
    expect(corpo.questions[0]).toEqual({ question: m[0]?.question, type: 'nps', required: true });
  });

  it('pesquisa de colaborador NÃO envia audience (corpo igual ao de antes)', () => {
    const corpo = montarPesquisa('Clima', '', [{ ...perguntaNova('scale'), question: 'Nota?' }]);
    expect('audience' in corpo).toBe(false);
  });

  it('pergunta NPS não pede opções na validação', () => {
    const p = { ...perguntaNova('nps'), question: 'Recomendaria?' };
    expect(p.options).toEqual([]);
    expect(validarPesquisa('T', '', [p]).ok).toBe(true);
  });

  it('o seletor de tipos tem 4 opções, com NPS', () => {
    expect(TIPOS_PERGUNTA.map((t) => t.tipo)).toEqual(['scale', 'choice', 'text', 'nps']);
    expect(rotuloTipo('nps')).toBe('Nota NPS (0 a 10)');
  });

  it('a prévia herda o público', () => {
    expect(previaPublica('T', modeloSatisfacaoCliente(), 'customers').audience).toBe('customers');
    expect(previaPublica('T', [perguntaNova()]).audience).toBe('employees');
  });
});

const NPS_Q: SurveyQuestion = { id: 1, position: 1, question: 'Recomendaria?', type: 'nps', options: null, required: true };

describe('pergunta NPS (0 a 10) no respondente', () => {
  it('0 e 10 são respostas válidas (o zero NÃO conta como "em branco")', () => {
    expect(estaRespondida(NPS_Q, { score: 0 })).toBe(true);
    expect(estaRespondida(NPS_Q, { score: 10 })).toBe(true);
    expect(bloqueioDeAvanco(NPS_Q, { score: 0 })).toBeNull();
  });

  it('fora de 0..10, decimal ou ausente não vale', () => {
    for (const score of [-1, 11, 5.5, Number.NaN]) expect(estaRespondida(NPS_Q, { score }), String(score)).toBe(false);
    expect(estaRespondida(NPS_Q, undefined)).toBe(false);
    expect(estaRespondida(NPS_Q, {})).toBe(false);
  });

  it('obrigatória sem nota bloqueia com mensagem própria', () => {
    expect(bloqueioDeAvanco(NPS_Q, undefined)).toBe('Escolha uma nota de 0 a 10 para continuar.');
  });

  it('montarRespostas envia o score, inclusive 0', () => {
    expect(montarRespostas([NPS_Q], { 1: { score: 0 } })).toEqual([{ question_id: 1, score: 0 }]);
    expect(montarRespostas([NPS_Q], { 1: { score: 10 } })).toEqual([{ question_id: 1, score: 10 }]);
  });
});

function contato(parcial: Partial<ContatoRascunho>): ContatoRascunho {
  return { ...CONTATO_VAZIO, ...parcial };
}

describe('contato com consentimento (LGPD)', () => {
  it('SEM consentimento nada é enviado, mesmo com campos preenchidos', () => {
    const c = contato({ nome: 'Maria', telefone: '11999998888', email: 'm@x.com', consentimento: false });
    expect(validarContato(c)).toEqual({ ok: true, erros: {} });
    expect(montarContato(c)).toBeNull();
    expect(montarContato(CONTATO_VAZIO)).toBeNull();
  });

  it('com consentimento exige nome e telefone OU e-mail', () => {
    expect(validarContato(contato({ consentimento: true })).erros).toMatchObject({ nome: 'Como podemos te chamar?', contato: 'Informe um telefone ou um e-mail.' });
    expect(validarContato(contato({ consentimento: true, nome: 'Maria' })).erros.contato).toBeDefined();
    expect(validarContato(contato({ consentimento: true, nome: 'Maria', telefone: '(11) 99999-8888' })).ok).toBe(true);
    expect(validarContato(contato({ consentimento: true, nome: 'Maria', email: 'maria@exemplo.com' })).ok).toBe(true);
  });

  it('telefone e e-mail inválidos são recusados', () => {
    expect(validarContato(contato({ consentimento: true, nome: 'Maria', telefone: '123' })).erros.telefone).toBeDefined();
    expect(validarContato(contato({ consentimento: true, nome: 'Maria', telefone: '1'.repeat(16) })).erros.telefone).toBeDefined();
    expect(validarContato(contato({ consentimento: true, nome: 'Maria', email: 'sem-arroba' })).erros.email).toBeDefined();
    expect(validarContato(contato({ consentimento: true, nome: 'Maria', email: 'a@b' })).erros.email).toBeDefined();
  });

  it('nome com 1 letra é recusado (precisa de pelo menos 2)', () => {
    expect(validarContato(contato({ consentimento: true, nome: 'M', email: 'm@x.com' })).erros.nome).toBeDefined();
  });

  it('montarContato apara espaços, omite o que está vazio e marca consent: true', () => {
    expect(montarContato(contato({ consentimento: true, nome: '  Maria Souza ', telefone: ' (11) 99999-8888 ', email: '' }))).toEqual({ name: 'Maria Souza', phone: '(11) 99999-8888', consent: true });
    expect(montarContato(contato({ consentimento: true, nome: 'Maria', email: ' m@x.com ' }))).toEqual({ name: 'Maria', email: 'm@x.com', consent: true });
  });

  it('a finalidade está descrita na tela', () => {
    expect(TEXTO_CONSENTIMENTO).toBe('Usaremos seu contato apenas para falar sobre esta avaliação.');
  });
});

describe('NPS', () => {
  it('grupos nas bordas: 6/7 e 8/9', () => {
    expect([0, 5, 6].map(grupoDoNps)).toEqual(['detrator', 'detrator', 'detrator']);
    expect([7, 8].map(grupoDoNps)).toEqual(['neutro', 'neutro']);
    expect([9, 10].map(grupoDoNps)).toEqual(['promotor', 'promotor']);
  });

  it('calcula % promotores − % detratores, de −100 a +100', () => {
    expect(calcularNps({ promoters: 10, passives: 0, detractors: 0 })).toBe(100);
    expect(calcularNps({ promoters: 0, passives: 0, detractors: 5 })).toBe(-100);
    expect(calcularNps({ promoters: 0, passives: 7, detractors: 0 })).toBe(0);
    expect(calcularNps({ promoters: 5, passives: 3, detractors: 2 })).toBe(30);
    expect(calcularNps({ promoters: 1, passives: 0, detractors: 2 })).toBe(-33);
  });

  it('sem respostas é "sem dados" (null), nunca 0', () => {
    expect(calcularNps({ promoters: 0, passives: 0, detractors: 0 })).toBeNull();
    expect(formatarNps(null)).toBe('Sem dados');
    expect(formatarNps(undefined)).toBe('Sem dados');
    expect(formatarNps(0)).toBe('0');
  });

  it('formata com sinal: +42, −15', () => {
    expect(formatarNps(42)).toBe('+42');
    expect(formatarNps(-15)).toBe('−15');
    expect(formatarNps(100)).toBe('+100');
  });

  it('aviso de poucas respostas: de 1 a 9', () => {
    expect([0, 1, 9, 10, 50].map(poucasRespostasNps)).toEqual([false, true, true, false, false]);
  });

  it('percentuais somam 100 (ou 0 sem respostas)', () => {
    const p = percentuaisNps({ promoters: 5, passives: 3, detractors: 2 });
    expect(p.promotores + p.neutros + p.detratores).toBeCloseTo(100);
    expect(percentuaisNps({ promoters: 0, passives: 0, detractors: 0 })).toEqual({ promotores: 0, neutros: 0, detratores: 0 });
  });

  it('distribuição sempre tem 11 posições (0 a 10), mesmo faltando notas', () => {
    const d = distribuicaoNps({ '0': 2, '10': 5 });
    expect(d).toHaveLength(11);
    expect(d[0]).toBe(2);
    expect(d[10]).toBe(5);
    expect(d[5]).toBe(0);
    expect(distribuicaoNps(undefined)).toEqual(Array(11).fill(0));
  });

  it('contagem usa os campos do servidor; sem eles, soma a distribuição (0–6, 7–8, 9–10)', () => {
    const base: QuestionResult = { question_id: 1, position: 1, question: 'q', type: 'nps', answered: 10 };
    expect(contagemDoResultado({ ...base, promoters: 4, passives: 3, detractors: 3, distribution: {} })).toEqual({ promoters: 4, passives: 3, detractors: 3 });
    expect(contagemDoResultado({ ...base, distribution: { '6': 2, '7': 1, '8': 1, '9': 3, '10': 3 } })).toEqual({ promoters: 6, passives: 2, detractors: 2 });
  });
});

describe('contatos de clientes (Retornar contato)', () => {
  const c = (id: number, score: number | null, contacted: string | null, enviado: string): SurveyContact => ({ submission_id: id, name: `Cliente ${id}`, phone: null, email: 'x@y.com', score, comment: null, submitted_at: enviado, contacted_at: contacted });

  it('detratores à parte; pendentes antes dos já contatados; nota mais baixa primeiro', () => {
    const { aRetornar, outros } = separarContatos([
      c(1, 6, '2026-10-02T10:00:00Z', '2026-10-01T10:00:00Z'),
      c(2, 3, null, '2026-10-01T10:00:00Z'),
      c(3, 0, null, '2026-10-01T09:00:00Z'),
      c(4, 9, null, '2026-10-01T08:00:00Z'),
      c(5, 7, null, '2026-10-01T08:00:00Z'),
    ]);
    expect(aRetornar.map((x) => x.submission_id)).toEqual([3, 2, 1]);
    expect(outros.map((x) => x.submission_id)).toEqual([5, 4]);
  });

  it('sem lista não quebra', () => {
    expect(separarContatos(undefined)).toEqual({ aRetornar: [], outros: [] });
  });

  it('contato sem nota (null) não é detrator', () => {
    expect(separarContatos([c(1, null, null, '2026-10-01T00:00:00Z')]).outros).toHaveLength(1);
  });
});

describe('leitura da API', () => {
  it('audience: customers é respeitado; qualquer outra coisa vira employees', () => {
    expect(normalizarPesquisaPublica({ id: 1, title: 'T', audience: 'customers', questions: [] }).audience).toBe('customers');
    expect(normalizarPesquisaPublica({ id: 1, title: 'T', questions: [] }).audience).toBe('employees');
  });

  it('resultados mantêm a lista de contatos', () => {
    const survey = { id: 1, company_id: 1, created_by: null, title: 'T', target_dept: null, created_at: '' };
    const contatos: SurveyContact[] = [{ submission_id: 1, name: 'A', phone: null, email: 'a@b.com', score: 2, comment: 'ruim', submitted_at: '2026-10-01T00:00:00Z', contacted_at: null }];
    expect(normalizarResultados({ survey, total_responses: 1, questions: [], contacts: contatos }).contacts).toEqual(contatos);
    expect('contacts' in normalizarResultados({ survey, total_responses: 1, questions: [] })).toBe(false);
  });
});

describe('QR code', () => {
  const link = 'https://super-rh.vercel.app/responder/12';

  it('gera matriz quadrada de versão válida (lado = 17 + 4×versão) e é determinístico', () => {
    const m = gerarQr(link);
    expect((m.tamanho - 17) % 4).toBe(0);
    expect(m.modulos).toHaveLength(m.tamanho);
    expect(m.modulos.every((l) => l.length === m.tamanho)).toBe(true);
    expect(gerarQr(link)).toEqual(m);
    expect(gerarQr(`${link}?x=1`).modulos).not.toEqual(m.modulos);
  });

  it('tem os 3 quadrados de posição e a linha de sincronismo alternada (estrutura exigida pelo padrão)', () => {
    const m = gerarQr(link);
    const n = m.tamanho;
    const finder = (y0: number, x0: number) => {
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const borda = y === 0 || y === 6 || x === 0 || x === 6;
        const centro = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        expect(m.modulos[y0 + y]?.[x0 + x], `${y0 + y},${x0 + x}`).toBe(borda || centro);
      }
    };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (let i = 8; i < n - 8; i++) {
      expect(m.modulos[6]?.[i]).toBe(i % 2 === 0);
      expect(m.modulos[i]?.[6]).toBe(i % 2 === 0);
    }
  });

  it('trechos reconstroem exatamente a matriz', () => {
    const m = gerarQr(link);
    const refeita = m.modulos.map((l) => l.map(() => false));
    for (const t of trechosDoQr(m)) for (let i = 0; i < t.largura; i++) refeita[t.y]![t.x + i] = true;
    expect(refeita).toEqual(m.modulos);
  });

  it('SVG tem margem de silêncio de 4 módulos, fundo branco e o caminho dos módulos', () => {
    const m = gerarQr(link);
    const svg = qrParaSvg(m);
    const lado = m.tamanho + MARGEM_QR * 2;
    expect(svg).toContain(`viewBox="0 0 ${lado} ${lado}"`);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('<path d="M');
    expect(svg.startsWith('<svg')).toBe(true);
  });

  it('texto vazio dá erro claro', () => {
    expect(() => gerarQr('  ')).toThrow('Texto vazio');
  });

  it('página de impressão escapa título e link (nada de HTML injetado)', () => {
    const html = htmlParaImpressao('<svg></svg>', '<script>alert(1)</script> Satisfação', 'https://x.com/?a=1&b="2"');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;b=&quot;2&quot;');
    expect(html).toContain('<svg></svg>');
  });
});

// tests/pesquisa.test.ts
import { describe, expect, it } from 'vitest';
import type { SurveyQuestion } from '../tipos/modelos';
import {
  MAX_OPCOES,
  MAX_PERGUNTAS,
  MAX_TEXTO,
  PerguntaRascunho,
  adicionarOpcao,
  adicionarPergunta,
  bloqueioDeAvanco,
  duplicarPergunta,
  ehFormatoAntigo,
  estaRespondida,
  lerValidade,
  montarPesquisa,
  montarRespostas,
  moverPergunta,
  normalizarPesquisaPublica,
  normalizarResultados,
  perguntaNova,
  previaPublica,
  primeiraObrigatoriaPendente,
  removerOpcao,
  removerPergunta,
  trocarTipo,
  validarPesquisa,
} from '../helpers/pesquisa';

function lista(n: number): PerguntaRascunho[] {
  return Array.from({ length: n }, (_, i) => ({ ...perguntaNova('scale'), question: `P${i + 1}` }));
}

describe('editor: lista de perguntas', () => {
  it('nasce com 1 pergunta de escala obrigatória; escolha nasce com 2 opções', () => {
    expect(perguntaNova()).toMatchObject({ type: 'scale', required: true, options: [] });
    expect(perguntaNova('choice').options).toEqual(['', '']);
  });

  it('limite de 10 perguntas', () => {
    expect(adicionarPergunta(lista(9))).toHaveLength(10);
    expect(adicionarPergunta(lista(MAX_PERGUNTAS))).toHaveLength(MAX_PERGUNTAS);
    expect(duplicarPergunta(lista(MAX_PERGUNTAS), 0)).toHaveLength(MAX_PERGUNTAS);
  });

  it('duplicar coloca a cópia logo abaixo, com chave nova e opções independentes', () => {
    const base = [{ ...perguntaNova('choice'), question: 'A', options: ['x', 'y'] }, ...lista(1)];
    const r = duplicarPergunta(base, 0);
    expect(r.map((p) => p.question)).toEqual(['A', 'A', 'P1']);
    expect(r[1]?.chave).not.toBe(r[0]?.chave);
    r[1]?.options.push('z');
    expect(r[0]?.options).toEqual(['x', 'y']);
  });

  it('subir/descer troca de lugar e respeita as pontas', () => {
    const l = lista(3);
    expect(moverPergunta(l, 1, -1).map((p) => p.question)).toEqual(['P2', 'P1', 'P3']);
    expect(moverPergunta(l, 1, 1).map((p) => p.question)).toEqual(['P1', 'P3', 'P2']);
    expect(moverPergunta(l, 0, -1).map((p) => p.question)).toEqual(['P1', 'P2', 'P3']);
    expect(moverPergunta(l, 2, 1).map((p) => p.question)).toEqual(['P1', 'P2', 'P3']);
  });

  it('excluir nunca deixa a pesquisa sem pergunta', () => {
    expect(removerPergunta(lista(2), 0).map((p) => p.question)).toEqual(['P2']);
    expect(removerPergunta(lista(1), 0)).toHaveLength(1);
  });

  it('trocar para escolha cria 2 campos; sair de escolha descarta as opções', () => {
    const escolha = trocarTipo(perguntaNova('scale'), 'choice');
    expect(escolha.options).toEqual(['', '']);
    expect(trocarTipo({ ...escolha, options: ['a', 'b', 'c'] }, 'text').options).toEqual([]);
  });

  it('opções: máximo 8, mínimo 2', () => {
    let p = perguntaNova('choice');
    for (let i = 0; i < 10; i++) p = adicionarOpcao(p);
    expect(p.options).toHaveLength(MAX_OPCOES);
    expect(removerOpcao(perguntaNova('choice'), 0).options).toHaveLength(2);
    expect(removerOpcao({ ...p }, 0).options).toHaveLength(MAX_OPCOES - 1);
  });
});

describe('validação: erros no próprio campo', () => {
  it('título e pergunta vazios apontam o campo', () => {
    const l = lista(1); l[0] = { ...l[0], question: '  ' };
    const r = validarPesquisa('', '', l);
    expect(r.ok).toBe(false);
    expect(r.erros.titulo).toBe('Dê um título para a pesquisa');
    expect(r.erros.perguntas[l[0].chave]?.question).toBe('Escreva a pergunta');
    expect(r.totalErros).toBe(2);
  });

  it('escolha com menos de 2 opções preenchidas e opção vazia', () => {
    const p: PerguntaRascunho = { ...perguntaNova('choice'), question: 'Q', options: ['Sim', ''] };
    const r = validarPesquisa('T', '', [p]);
    expect(r.ok).toBe(false);
    expect(r.erros.perguntas[p.chave]).toMatchObject({ opcoes: 'Coloque pelo menos 2 opções', opcao: { 1: 'Preencha ou remova esta opção' } });
  });

  it('opções repetidas (ignorando maiúsculas) são recusadas', () => {
    const p: PerguntaRascunho = { ...perguntaNova('choice'), question: 'Q', options: ['Sim', 'sim'] };
    expect(validarPesquisa('T', '', [p]).erros.perguntas[p.chave]?.opcoes).toBe('Há opções repetidas');
  });

  it('validade: vazio = sem prazo; formato ruim é erro', () => {
    expect(lerValidade('')).toEqual({ ok: true, iso: null });
    expect(lerValidade('31/10/2026')).toEqual({ ok: true, iso: '2026-10-31' });
    expect(lerValidade('31/02/2026')).toEqual({ ok: false });
    expect(validarPesquisa('T', '99/99/2026', lista(1)).erros.validade).toBeDefined();
  });

  it('pesquisa completa de 10 perguntas mistas é válida', () => {
    const mistas: PerguntaRascunho[] = Array.from({ length: 10 }, (_, i) => {
      const tipo = (['scale', 'choice', 'text'] as const)[i % 3];
      const base = perguntaNova(tipo);
      return { ...base, question: `Pergunta ${i + 1}`, options: tipo === 'choice' ? ['Sim', 'Não'] : [] };
    });
    expect(validarPesquisa('Clima', '', mistas).ok).toBe(true);
  });
});

describe('montarPesquisa (corpo do POST)', () => {
  it('só escolha leva options; aparam espaços; required vai junto', () => {
    const a: PerguntaRascunho = { ...perguntaNova('scale'), question: ' Nota? ', required: false };
    const b: PerguntaRascunho = { ...perguntaNova('choice'), question: 'Qual?', options: [' Sim ', 'Não'] };
    const c: PerguntaRascunho = { ...perguntaNova('text'), question: 'Comentário' };
    expect(montarPesquisa(' Clima ', '31/10/2026', [a, b, c])).toEqual({
      title: 'Clima',
      expires_at: '2026-10-31',
      questions: [
        { question: 'Nota?', type: 'scale', required: false },
        { question: 'Qual?', type: 'choice', options: ['Sim', 'Não'], required: true },
        { question: 'Comentário', type: 'text', required: true },
      ],
    });
  });

  it('prévia usa a mesma pesquisa, sem gravar nada', () => {
    const p: PerguntaRascunho = { ...perguntaNova('choice'), question: 'Q', options: ['a', '', 'b'] };
    const previa = previaPublica('T', [p]);
    expect(previa.questions[0]).toMatchObject({ id: 1, position: 1, type: 'choice', options: ['a', 'b'] });
  });
});

const PERGUNTAS: SurveyQuestion[] = [
  { id: 11, position: 1, question: 'Nota', type: 'scale', options: null, required: true },
  { id: 12, position: 2, question: 'Qual', type: 'choice', options: ['A', 'B'], required: true },
  { id: 13, position: 3, question: 'Comentário', type: 'text', options: null, required: false },
];

describe('responder', () => {
  it('estaRespondida valida por tipo (nota fora de 1..5, opção fora da lista, texto em branco)', () => {
    expect(estaRespondida(PERGUNTAS[0], { score: 4 })).toBe(true);
    expect(estaRespondida(PERGUNTAS[0], { score: 6 })).toBe(false);
    expect(estaRespondida(PERGUNTAS[1], { choice: 'C' })).toBe(false);
    expect(estaRespondida(PERGUNTAS[1], { choice: 'B' })).toBe(true);
    expect(estaRespondida(PERGUNTAS[2], { text: '   ' })).toBe(false);
    expect(estaRespondida(PERGUNTAS[2], undefined)).toBe(false);
  });

  it('obrigatória bloqueia o avanço com mensagem simples; opcional não', () => {
    expect(bloqueioDeAvanco(PERGUNTAS[0], undefined)).toBe('Escolha uma resposta para continuar.');
    expect(bloqueioDeAvanco(PERGUNTAS[0], { score: 3 })).toBeNull();
    expect(bloqueioDeAvanco(PERGUNTAS[2], undefined)).toBeNull();
    expect(bloqueioDeAvanco({ ...PERGUNTAS[2], required: true }, undefined)).toBe('Escreva sua resposta para continuar.');
  });

  it('texto acima do limite bloqueia', () => {
    expect(bloqueioDeAvanco(PERGUNTAS[2], { text: 'x'.repeat(MAX_TEXTO + 1) })).toContain(String(MAX_TEXTO));
  });

  it('montarRespostas: um campo por tipo, pula opcional em branco, apara o texto', () => {
    expect(montarRespostas(PERGUNTAS, { 11: { score: 5 }, 12: { choice: 'A' } })).toEqual([
      { question_id: 11, score: 5 },
      { question_id: 12, choice: 'A' },
    ]);
    expect(montarRespostas(PERGUNTAS, { 11: { score: 2 }, 12: { choice: 'B' }, 13: { text: '  ótimo  ' } }).at(-1)).toEqual({ question_id: 13, text: 'ótimo' });
  });

  it('primeiraObrigatoriaPendente aponta a que falta', () => {
    expect(primeiraObrigatoriaPendente(PERGUNTAS, { 11: { score: 3 } })).toBe(1);
    expect(primeiraObrigatoriaPendente(PERGUNTAS, { 11: { score: 3 }, 12: { choice: 'A' } })).toBe(-1);
  });
});

describe('leitura tolerante da API', () => {
  it('formato novo: ordena por position e mantém required', () => {
    const r = normalizarPesquisaPublica({ id: 1, title: 'T', questions: [PERGUNTAS[2], PERGUNTAS[0]] });
    expect(r.questions.map((q) => q.id)).toEqual([11, 13]);
    expect(ehFormatoAntigo(r)).toBe(false);
  });

  it('pesquisa antiga vira 1 pergunta obrigatória com id 0 (envio no corpo antigo)', () => {
    const r = normalizarPesquisaPublica({ id: 1, title: 'T', question: 'Como está?', type: 'scale', options: null });
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0]).toMatchObject({ id: 0, required: true, type: 'scale' });
    expect(ehFormatoAntigo(r)).toBe(true);
  });

  it('resultados antigos viram 1 bloco de pergunta', () => {
    const survey = { id: 1, company_id: 1, created_by: null, title: 'T', question: 'Q', type: 'scale' as const, options: null, target_dept: null, created_at: '' };
    const r = normalizarResultados({ survey, total_responses: 3, results: { avg: 4, distribution: { '4': 3 } } });
    expect(r.questions).toEqual([{ question_id: 0, position: 1, question: 'Q', type: 'scale', answered: 3, avg: 4, distribution: { '4': 3 } }]);
  });

  it('resultados novos: só reordena por position', () => {
    const survey = { id: 1, company_id: 1, created_by: null, title: 'T', target_dept: null, created_at: '' };
    const r = normalizarResultados({ survey, total_responses: 2, questions: [
      { question_id: 2, position: 2, question: 'B', type: 'text', answered: 1, texts: ['oi'] },
      { question_id: 1, position: 1, question: 'A', type: 'scale', answered: 2, avg: 3, distribution: {} },
    ] });
    expect(r.questions.map((q) => q.question)).toEqual(['A', 'B']);
  });
});

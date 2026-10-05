// tests/pesquisaEdicao.test.ts — regras de edição de pesquisa com respostas (espelho do servidor)
import { describe, expect, it } from 'vitest';
import {
  MOTIVO_PERGUNTA_EXISTENTE,
  adicionarPergunta,
  duplicarPergunta,
  montarCopia,
  montarEdicao,
  opcaoEditavel,
  podeMoverPergunta,
  rascunhoDaPesquisa,
  restricaoDaPergunta,
  textoBannerRespostas,
  textoExclusaoPesquisa,
  validadeDoCampo,
} from '../helpers/pesquisa';
import type { PulseSurvey, SurveyQuestion } from '../tipos/modelos';

const PERGUNTAS: SurveyQuestion[] = [
  { id: 11, position: 2, question: 'Onde prefere trabalhar?', type: 'choice', options: ['Remoto', 'Presencial'], required: false },
  { id: 10, position: 1, question: 'Como está o clima?', type: 'scale', options: null, required: true },
];
const PESQUISA: Pick<PulseSurvey, 'title' | 'audience' | 'questions'> = { title: 'Clima', audience: 'employees', questions: PERGUNTAS };

describe('rascunhoDaPesquisa / montarEdicao', () => {
  it('ordena por posição, guarda id e estado original', () => {
    const r = rascunhoDaPesquisa(PESQUISA);
    expect(r.map((p) => p.id)).toEqual([10, 11]);
    expect(r[1].original).toEqual({ required: false, options: 2 });
  });

  it('o corpo do PUT leva o id só das perguntas existentes e opções só na escolha', () => {
    const r = [...rascunhoDaPesquisa(PESQUISA), ...adicionarPergunta([], true)];
    r[2].question = 'Nova?';
    expect(montarEdicao('  Clima 2 ', '', r)).toEqual({
      title: 'Clima 2',
      expires_at: null,
      questions: [
        { id: 10, question: 'Como está o clima?', type: 'scale', required: true },
        { id: 11, question: 'Onde prefere trabalhar?', type: 'choice', options: ['Remoto', 'Presencial'], required: false },
        { question: 'Nova?', type: 'scale', required: false },
      ],
    });
  });

  it('converte o prazo da API para o campo e de volta', () => {
    expect(validadeDoCampo('2026-10-05T00:00:00.000Z')).toBe('05/10/2026');
    expect(validadeDoCampo(null)).toBe('');
    expect(montarEdicao('T', '05/10/2026', rascunhoDaPesquisa(PESQUISA)).expires_at).toBe('2026-10-05');
  });
});

describe('restrições com respostas', () => {
  const [escala, escolha] = rascunhoDaPesquisa(PESQUISA);

  it('sem respostas a edição é livre', () => {
    expect(restricaoDaPergunta(escala, false).motivo).toBeNull();
    expect(podeMoverPergunta([escala, escolha], 0, 1, false)).toBe(true);
  });

  it('pergunta existente: tipo, remover, mover e duplicar bloqueados', () => {
    const r = restricaoDaPergunta(escala, true);
    expect(r).toMatchObject({ tipo: true, remover: true, mover: true, duplicar: true, obrigatoria: false, opcoesFixas: 0, motivo: MOTIVO_PERGUNTA_EXISTENTE });
  });

  it('obrigatória só pode ir de sim para não: quem já era opcional não volta a ser obrigatória', () => {
    expect(restricaoDaPergunta(escala, true).obrigatoria).toBe(false);
    expect(restricaoDaPergunta(escolha, true).obrigatoria).toBe(true);
  });

  it('opções existentes ficam fixas; só dá para acrescentar ao fim', () => {
    const r = restricaoDaPergunta(escolha, true);
    expect(r.opcoesFixas).toBe(2);
    expect(opcaoEditavel(r, 1)).toBe(false);
    expect(opcaoEditavel(r, 2)).toBe(true);
  });

  it('pergunta nova nasce opcional e pode tudo, menos ser obrigatória', () => {
    const [nova] = adicionarPergunta([], true);
    expect(nova.required).toBe(false);
    expect(restricaoDaPergunta(nova, true)).toMatchObject({ tipo: false, remover: false, mover: false, obrigatoria: true });
  });

  it('só se move pergunta nova entre novas; existente nunca', () => {
    const [n1] = adicionarPergunta([], true);
    const [n2] = adicionarPergunta([], true);
    expect(podeMoverPergunta([escala, escolha, n1, n2], 2, 1, true)).toBe(true);
    expect(podeMoverPergunta([escala, escolha, n1, n2], 2, -1, true)).toBe(false);
    expect(podeMoverPergunta([escala, escolha, n1, n2], 0, 1, true)).toBe(false);
    expect(podeMoverPergunta([escala, n1], 1, 1, true)).toBe(false);
  });

  it('duplicar gera uma pergunta nova (sem id) e opcional quando há respostas', () => {
    const lista = duplicarPergunta([escala], 0, true);
    expect(lista).toHaveLength(2);
    expect(lista[1].id).toBeUndefined();
    expect(lista[1].original).toBeUndefined();
    expect(lista[1].required).toBe(false);
    expect(lista[0].id).toBe(10);
  });
});

describe('cópia e textos', () => {
  it('a cópia tem título "Cópia de", sem prazo e sem ids', () => {
    expect(montarCopia(PESQUISA)).toEqual({
      title: 'Cópia de Clima',
      expires_at: null,
      questions: [
        { question: 'Como está o clima?', type: 'scale', required: true },
        { question: 'Onde prefere trabalhar?', type: 'choice', options: ['Remoto', 'Presencial'], required: false },
      ],
    });
    expect(montarCopia({ ...PESQUISA, audience: 'customers' }).audience).toBe('customers');
  });

  it('banner e aviso de exclusão trazem a contagem', () => {
    expect(textoBannerRespostas(21)).toBe('Esta pesquisa já tem 21 respostas, por isso algumas alterações estão bloqueadas.');
    expect(textoBannerRespostas(1, 'campanha')).toBe('Esta campanha já tem 1 resposta, por isso algumas alterações estão bloqueadas.');
    expect(textoExclusaoPesquisa(21)).toBe('Isso apaga a pesquisa e as 21 respostas. Não dá para desfazer.');
    expect(textoExclusaoPesquisa(1)).toBe('Isso apaga a pesquisa e a resposta. Não dá para desfazer.');
    expect(textoExclusaoPesquisa(0, 'campanha')).toBe('Isso apaga a campanha. Não dá para desfazer.');
  });
});

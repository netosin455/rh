// tests/feedbackExclusao.test.ts
import { describe, expect, it } from 'vitest';
import { textoExclusaoFeedback } from '../helpers/feedback';

describe('textoExclusaoFeedback', () => {
  it('rascunho: aviso simples', () => {
    expect(textoExclusaoFeedback('draft')).toEqual({ titulo: 'Excluir rascunho', mensagem: 'Excluir este rascunho? Não dá para desfazer.' });
  });

  it('publicado e confirmado: avisa que o link para e a ciência/observação se perdem', () => {
    for (const status of ['published', 'acknowledged'] as const) {
      expect(textoExclusaoFeedback(status).mensagem).toBe('O link deixa de funcionar e a data e a observação do colaborador serão perdidas. Não dá para desfazer.');
    }
  });

  it('revogado: o link já não funcionava, então o aviso é só sobre apagar', () => {
    expect(textoExclusaoFeedback('revoked').mensagem).not.toContain('link deixa de funcionar');
  });
});

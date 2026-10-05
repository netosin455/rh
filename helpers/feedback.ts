// ============================================================
// helpers/feedback.ts — SuperRH
// Textos de confirmação do feedback individual, proporcionais ao estrago. Sem React e sem rede.
// ============================================================

import type { FeedbackStatus } from '../tipos/modelos';

/** Título e texto do aviso antes de excluir, conforme o status do feedback. */
export function textoExclusaoFeedback(status: FeedbackStatus): { titulo: string; mensagem: string } {
  if (status === 'draft') return { titulo: 'Excluir rascunho', mensagem: 'Excluir este rascunho? Não dá para desfazer.' };
  if (status === 'revoked') return { titulo: 'Excluir feedback', mensagem: 'O feedback revogado será apagado do sistema. Não dá para desfazer.' };
  return {
    titulo: 'Excluir feedback',
    mensagem: 'O link deixa de funcionar e a data e a observação do colaborador serão perdidas. Não dá para desfazer.',
  };
}

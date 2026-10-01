// ============================================================
// app/pesquisas/nova.tsx — Criar pesquisa de colaboradores
// Só colaboradores: escala, escolha e aberta. (Campanhas de cliente ficam em /nps/nova.)
// O editor vem de componentes/EditorPesquisa.tsx, compartilhado com o NPS.
// ============================================================

import { EditorPesquisa } from '../../componentes/EditorPesquisa';

export default function NovaPesquisaScreen() {
  return <EditorPesquisa area="pesquisas" />;
}

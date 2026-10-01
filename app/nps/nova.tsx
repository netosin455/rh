// ============================================================
// app/nps/nova.tsx — Criar campanha NPS (clientes)
// Já abre com o modelo "Satisfação do cliente" montado e editável; público fixo em Clientes.
// ============================================================

import { EditorPesquisa } from '../../componentes/EditorPesquisa';

export default function NovaCampanhaNpsScreen() {
  return <EditorPesquisa area="nps" />;
}

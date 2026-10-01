// ============================================================
// app/nps/index.tsx — NPS: campanhas de satisfação do cliente
// Área própria (item "NPS" no menu); separada de Pesquisas (colaboradores).
// ============================================================

import { ListaPesquisas } from '../../componentes/ListaPesquisas';

export default function NpsScreen() {
  return <ListaPesquisas area="nps" />;
}

// ============================================================
// app/nps/editar/[id].tsx — Editar uma campanha NPS (clientes)
// ============================================================

import { useLocalSearchParams } from 'expo-router';
import { EditorPesquisa } from '../../../componentes/EditorPesquisa';
import { EmptyState } from '../../../componentes/EmptyState';

export default function EditarCampanhaNpsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const numero = Number(Array.isArray(id) ? id[0] : id);
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    return <EmptyState icon="alert-circle-outline" title="Campanha inválida" description="O identificador da campanha não é válido." />;
  }
  return <EditorPesquisa area="nps" pesquisaId={numero} />;
}

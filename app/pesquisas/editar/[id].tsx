// ============================================================
// app/pesquisas/editar/[id].tsx — Editar uma pesquisa de colaboradores
// ============================================================

import { useLocalSearchParams } from 'expo-router';
import { EditorPesquisa } from '../../../componentes/EditorPesquisa';
import { EmptyState } from '../../../componentes/EmptyState';

export default function EditarPesquisaScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const numero = Number(Array.isArray(id) ? id[0] : id);
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    return <EmptyState icon="alert-circle-outline" title="Pesquisa inválida" description="O identificador da pesquisa não é válido." />;
  }
  return <EditorPesquisa area="pesquisas" pesquisaId={numero} />;
}

// ============================================================
// app/fechamento.tsx — Fechamento do mês (rota fina; a tela vive em componentes/TelaFechamento)
// ============================================================

import { EmptyState } from '../componentes/EmptyState';
import { TelaFechamento } from '../componentes/TelaFechamento';
import { useAuth } from '../contextos/Autenticacao';
import { SHELL_GROUPS, canAccessNavigation } from '../helpers/shellNav';

const ITEM = SHELL_GROUPS.flatMap((g) => g.items).find((i) => i.key === 'fechamento');

export default function FechamentoScreen() {
  const { user } = useAuth();
  // A API também recusa; aqui só evitamos mostrar uma tela que daria 403.
  if (!canAccessNavigation(ITEM?.roles ?? null, user?.role)) {
    return <EmptyState icon="lock-closed-outline" title="Acesso restrito" description="Somente RH e administradores veem o fechamento do mês." />;
  }
  return <TelaFechamento />;
}

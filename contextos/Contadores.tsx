// ============================================================
// contextos/Contadores.tsx — SuperRH
// Contadores do shell (férias pendentes e notificações não lidas).
// Único lugar que faz polling: sidebar web e abas mobile só leem daqui.
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { countPendentes } from '../conexoes/ausencias';
import { buscarNotificacoes } from '../conexoes/notificacoes';
import { aoInvalidar } from '../helpers/cacheDados';
import { CAN_APPROVE } from '../helpers/shellNav';
import { useAuth } from './Autenticacao';

const INTERVALO_MS = 120_000;

interface ContadoresShell {
  pendentes: number;
  naoLidas: number;
  /** Rebusca os contadores agora (ex.: depois de marcar notificações como lidas), sem esperar o próximo ciclo. */
  atualizar: () => void;
}

const ContadoresContext = createContext<ContadoresShell>({ pendentes: 0, naoLidas: 0, atualizar: () => undefined });

export function ContadoresProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const logado = Boolean(user);
  const [pendentes, setPendentes] = useState(0);
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    if (!CAN_APPROVE.includes(role)) {
      setPendentes(0);
      return;
    }
    // Badge é conveniência: falha aqui não deve incomodar, só é registrada.
    const buscar = () => countPendentes().then(setPendentes).catch((erro: unknown) => console.warn('[Contadores] pendentes:', erro));
    buscar();
    const timer = setInterval(buscar, INTERVALO_MS);
    // Qualquer escrita em ausência (aprovar, lançar, excluir) muda a fila: o badge do menu atualiza na hora.
    const cancelar = aoInvalidar('absences', buscar);
    return () => { clearInterval(timer); cancelar(); };
  }, [role]);

  const buscarNaoLidas = useCallback(
    () => buscarNotificacoes().then((r) => setNaoLidas(r.unread)).catch((erro: unknown) => console.warn('[Contadores] notificações:', erro)),
    [],
  );

  useEffect(() => {
    if (!logado) {
      setNaoLidas(0);
      return;
    }
    void buscarNaoLidas();
    const timer = setInterval(() => { void buscarNaoLidas(); }, INTERVALO_MS);
    const cancelar = aoInvalidar('notifications', () => { void buscarNaoLidas(); });
    return () => { clearInterval(timer); cancelar(); };
  }, [logado, buscarNaoLidas]);

  const atualizar = useCallback(() => { if (logado) void buscarNaoLidas(); }, [logado, buscarNaoLidas]);

  const valor = useMemo(() => ({ pendentes, naoLidas, atualizar }), [pendentes, naoLidas, atualizar]);
  return <ContadoresContext.Provider value={valor}>{children}</ContadoresContext.Provider>;
}

export function useContadoresShell(): ContadoresShell {
  return useContext(ContadoresContext);
}

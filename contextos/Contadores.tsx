// ============================================================
// contextos/Contadores.tsx — SuperRH
// Contadores do shell (férias pendentes e notificações não lidas).
// Único lugar que faz polling: sidebar web e abas mobile só leem daqui.
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { countPendentes } from '../conexoes/ausencias';
import { buscarNotificacoes } from '../conexoes/notificacoes';
import { aoInvalidar, buscarComCache } from '../helpers/cacheDados';
import { chaves } from '../helpers/chavesCache';
import { CAN_APPROVE } from '../helpers/shellNav';
import { useAuth } from './Autenticacao';

const INTERVALO_MS = 120_000;

interface ContadoresShell {
  pendentes: number;
  naoLidas: number;
  /** Rebusca os contadores agora (ex.: depois de marcar notificações como lidas), sem esperar o próximo ciclo. */
  atualizar: () => void;
  /** true depois da 1ª leitura de cada contador: só aí uma mudança vale como "chegou novidade" (sino/pop). */
  pendentesPronto: boolean;
  naoLidasPronto: boolean;
}

const ContadoresContext = createContext<ContadoresShell>({ pendentes: 0, naoLidas: 0, atualizar: () => undefined, pendentesPronto: false, naoLidasPronto: false });

export function ContadoresProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const logado = Boolean(user);
  const [pendentes, setPendentes] = useState(0);
  const [naoLidas, setNaoLidas] = useState(0);
  const [pendentesPronto, setPendentesPronto] = useState(false);
  const [naoLidasPronto, setNaoLidasPronto] = useState(false);

  useEffect(() => {
    if (!CAN_APPROVE.includes(role)) {
      setPendentes(0);
      setPendentesPronto(false);
      return;
    }
    // Badge é conveniência: falha aqui não deve incomodar, só é registrada.
    // buscarComCache: junta com o pedido igual que o Dashboard/aquecimento já tenha em andamento (1 chamada só) e alimenta o cache.
    const buscar = () => buscarComCache(chaves.contagemPendentes, () => countPendentes()).then((n) => { setPendentes(n); setPendentesPronto(true); }).catch((erro: unknown) => console.warn('[Contadores] pendentes:', erro));
    buscar();
    const timer = setInterval(buscar, INTERVALO_MS);
    // Qualquer escrita em ausência (aprovar, lançar, excluir) muda a fila: o badge do menu atualiza na hora.
    const cancelar = aoInvalidar('absences', buscar);
    return () => { clearInterval(timer); cancelar(); };
  }, [role]);

  const buscarNaoLidas = useCallback(
    () => buscarComCache(chaves.notificacoes, () => buscarNotificacoes()).then((r) => { setNaoLidas(r.unread); setNaoLidasPronto(true); }).catch((erro: unknown) => console.warn('[Contadores] notificações:', erro)),
    [],
  );

  useEffect(() => {
    if (!logado) {
      setNaoLidas(0);
      setNaoLidasPronto(false);
      return;
    }
    void buscarNaoLidas();
    const timer = setInterval(() => { void buscarNaoLidas(); }, INTERVALO_MS);
    const cancelar = aoInvalidar('notifications', () => { void buscarNaoLidas(); });
    return () => { clearInterval(timer); cancelar(); };
  }, [logado, buscarNaoLidas]);

  const atualizar = useCallback(() => { if (logado) void buscarNaoLidas(); }, [logado, buscarNaoLidas]);

  const valor = useMemo(() => ({ pendentes, naoLidas, atualizar, pendentesPronto, naoLidasPronto }), [pendentes, naoLidas, atualizar, pendentesPronto, naoLidasPronto]);
  return <ContadoresContext.Provider value={valor}>{children}</ContadoresContext.Provider>;
}

export function useContadoresShell(): ContadoresShell {
  return useContext(ContadoresContext);
}

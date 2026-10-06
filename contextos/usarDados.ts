// ============================================================
// contextos/usarDados.ts — SuperRH
// Hook de dados com cache e revalidação (stale-while-revalidate), sobre helpers/cacheDados.ts.
//
//  - Com dado em cache: devolve NA HORA (sem esqueleto). Se passou do TTL, atualiza em segundo plano.
//  - Revalidação que falha MANTÉM o dado antigo e só sinaliza `erroLeve` (a tela mostra um aviso discreto).
//  - Sem cache: `carregando` (esqueleto) e, no erro, `erro` (ErroComRetry), como antes.
//  - Invalidado (por uma escrita) com a tela aberta: busca de novo na hora; enquanto isso `desatualizado`
//    é true. Telas que mostram SALDO não devem confiar nesse dado até `desatualizado` voltar a false.
//  - Tela desmontada não recebe atualização de estado.
// ============================================================

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from './Autenticacao';
import { TTL_PADRAO_MS, assinar, atualizarCache, buscarComCache, idadeDoCache, lerCache, versaoDoCache } from '../helpers/cacheDados';

export interface OpcoesUsarDados {
  /** Tempo em que o dado é fresco (padrão 60 s). */
  ttlMs?: number;
  /** false = não busca nada (ex.: tela que só vale para certo perfil). */
  ativo?: boolean;
}

export interface ResultadoDados<T> {
  dados: T | undefined;
  /** Só quando NÃO há nada para mostrar e a busca ainda não terminou (esqueleto). */
  carregando: boolean;
  /** Buscando de novo (em segundo plano ou não). */
  revalidando: boolean;
  /** Último erro de busca (null se a última deu certo). */
  erro: Error | null;
  /** Erro com dado antigo na tela: mostrar só um aviso discreto. */
  erroLeve: boolean;
  /** O dado foi invalidado por uma escrita e a busca nova ainda não chegou. */
  desatualizado: boolean;
  /** Busca de novo agora (pull-to-refresh, "Tentar de novo"). */
  recarregar: () => Promise<void>;
  /** Altera o dado em cache na hora (otimismo). */
  definir: (transformar: (atual: T) => T) => void;
}

export function usarDados<T>(chave: string | null, buscar: () => Promise<T>, opcoes: OpcoesUsarDados = {}): ResultadoDados<T> {
  const { ttlMs = TTL_PADRAO_MS, ativo: ativoPedido = true } = opcoes;
  // Sem usuário logado nada é buscado nem mostrado (logout: o cache já foi esquecido e as telas não podem refazê-lo).
  const { user } = useAuth();
  const ativo = ativoPedido && Boolean(user);
  // Faz a tela redesenhar quando o cache muda (prefetch, escrita, otimismo, outra tela).
  useSyncExternalStore(assinar, versaoDoCache);

  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;
  const chaveRef = useRef(chave);
  chaveRef.current = chave;
  const montado = useRef(true);
  const [revalidando, setRevalidando] = useState(false);
  const [erro, setErro] = useState<Error | null>(null);
  const [, setAjuste] = useState(0);
  // Último dado mostrado para ESTA chave: segura a tela enquanto uma invalidação é refeita (sem piscar esqueleto).
  const ultimo = useRef<{ chave: string | null; dados: T | undefined }>({ chave, dados: undefined });
  if (ultimo.current.chave !== chave) ultimo.current = { chave, dados: undefined };

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const entrada = chave && ativo ? lerCache<T>(chave) : undefined;
  if (entrada) ultimo.current.dados = entrada.dados;
  const dados = entrada ? entrada.dados : (chave && ativo ? ultimo.current.dados : undefined);
  const semEntrada = entrada === undefined;

  const executar = useCallback(async () => {
    if (!chave || !ativo) return;
    const minha = chave;
    setRevalidando(true);
    try {
      // Se uma invalidação/limpeza passou por cima do pedido, o resultado não foi guardado: tenta de novo (poucas vezes).
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        await buscarComCache(minha, () => buscarRef.current());
        if (lerCache(minha) || !montado.current || chaveRef.current !== minha) break;
      }
      if (montado.current && chaveRef.current === minha) setErro(null);
    } catch (e: unknown) {
      if (montado.current && chaveRef.current === minha) setErro(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (montado.current && chaveRef.current === minha) setRevalidando(false);
    }
  }, [chave, ativo]);

  useEffect(() => {
    if (!chave || !ativo) return;
    // Sem cache (1ª visita) ou invalidado por uma escrita: busca agora.
    if (semEntrada) void executar();
  }, [chave, ativo, semEntrada, executar]);

  // Telas de aba continuam montadas quando se sai delas: a cada vez que a tela volta ao foco (e na 1ª vez),
  // dado com cache vencido é atualizado por baixo, mostrando o que já tem enquanto isso.
  useFocusEffect(useCallback(() => {
    if (!chave || !ativo) return;
    const idade = idadeDoCache(chave);
    if (idade !== null && idade >= ttlMs) void executar();
  }, [chave, ativo, ttlMs, executar]));

  const definir = useCallback((transformar: (atual: T) => T) => {
    if (!chave) return;
    if (lerCache<T>(chave)) { atualizarCache<T>(chave, transformar); return; }
    // Invalidado e ainda buscando: ajusta o que está na tela (a busca nova substitui em seguida).
    if (ultimo.current.chave === chave && ultimo.current.dados !== undefined) {
      ultimo.current.dados = transformar(ultimo.current.dados);
      setAjuste((n) => n + 1);
    }
  }, [chave]);

  const temDados = dados !== undefined;
  return {
    dados,
    carregando: ativo && Boolean(chave) && !temDados && !erro,
    revalidando,
    erro,
    erroLeve: erro !== null && temDados,
    desatualizado: ativo && semEntrada && temDados,
    recarregar: executar,
    definir,
  };
}

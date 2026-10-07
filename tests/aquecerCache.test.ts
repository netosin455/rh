// tests/aquecerCache.test.ts — aquecimento do cache após o login: fila com limite de 3, filtro por perfil, cancelamento
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gravarCache, invalidar, limpar } from '../helpers/cacheDados';
import { LIMITE_PARALELO, executarFila, executarTarefa, hrefDoPathname, perfilPodeAbrir, tarefasParaAquecer } from '../helpers/aquecerCache';
import { chaves } from '../helpers/chavesCache';
import type { TarefaDePrefetch } from '../helpers/prefetchRotas';

vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));

const atraso = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function tarefas(n: number): TarefaDePrefetch[] {
  return Array.from({ length: n }, (_, i) => ({ chave: `t${i}`, buscar: async () => i }));
}

beforeEach(() => { limpar(); });

describe('executarFila', () => {
  it('nunca passa de 3 pedidos em paralelo e executa todos, na ordem em que saem da fila', async () => {
    let ativos = 0;
    let pico = 0;
    const ordem: string[] = [];
    const fila = executarFila(tarefas(10), LIMITE_PARALELO, async (t) => {
      ordem.push(t.chave);
      ativos += 1; pico = Math.max(pico, ativos);
      await atraso(5);
      ativos -= 1;
    });
    await fila.concluida;
    expect(LIMITE_PARALELO).toBe(3);
    expect(pico).toBe(3);
    expect(ordem).toHaveLength(10);
    expect(ordem.slice(0, 3)).toEqual(['t0', 't1', 't2']);
  });

  it('cancelar impede novos pedidos (os que já voam terminam)', async () => {
    const iniciadas: string[] = [];
    const fila = executarFila(tarefas(9), 3, async (t) => { iniciadas.push(t.chave); await atraso(10); });
    await atraso(2);
    fila.cancelar();
    await fila.concluida;
    expect(iniciadas).toEqual(['t0', 't1', 't2']);
  });

  it('erro numa tarefa não interrompe as outras', async () => {
    const feitas: string[] = [];
    const fila = executarFila(tarefas(5), 3, async (t) => {
      if (t.chave === 't1') throw new Error('falhou');
      feitas.push(t.chave);
    });
    await fila.concluida;
    expect(feitas.sort()).toEqual(['t0', 't2', 't3', 't4']);
  });

  it('fila vazia termina sem erro', async () => {
    await expect(executarFila([], 3).concluida).resolves.toBeUndefined();
  });
});

describe('executarTarefa', () => {
  it('não refaz o que já está fresco no cache', async () => {
    gravarCache('x', 1);
    const buscar = vi.fn(async () => 2);
    await executarTarefa({ chave: 'x', buscar });
    expect(buscar).not.toHaveBeenCalled();
  });

  it('busca e grava no cache quando não há dado; erro de rede é silencioso', async () => {
    const ok = vi.fn(async () => 'dado');
    await executarTarefa({ chave: 'y', buscar: ok });
    expect(ok).toHaveBeenCalledTimes(1);
    await expect(executarTarefa({ chave: 'z', buscar: async () => { throw new Error('403'); } })).resolves.toBeUndefined();
  });

  it('deduplica: dois pedidos da mesma chave viram uma chamada', async () => {
    const buscar = vi.fn(async () => { await atraso(5); return 1; });
    await Promise.all([executarTarefa({ chave: 'w', buscar }), executarTarefa({ chave: 'w', buscar })]);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('invalidar durante o pedido não deixa o aquecimento gravar dado velho', async () => {
    const p = executarTarefa({ chave: 'employees:todos', buscar: async () => { await atraso(5); return ['velho']; } });
    invalidar('employees');
    await p;
    const { lerCache } = await import('../helpers/cacheDados');
    expect(lerCache('employees:todos')).toBeUndefined();
  });
});

describe('perfil: só o que o usuário pode abrir', () => {
  const chavesDo = (papel: string | undefined, rota = '/') => tarefasParaAquecer(papel, rota).map((t) => t.chave);

  it('RH comum: telas de equipe, férias, avisos, agenda, notificações, pesquisas, feedbacks e analytics', () => {
    const c = chavesDo('rh');
    for (const esperada of [chaves.colaboradores, chaves.ausencias, chaves.ausenciasPendentes, chaves.avisos, chaves.notificacoes, chaves.pesquisas('employees'), chaves.feedbacks, chaves.analytics]) expect(c).toContain(esperada);
  });

  it('colaborador (sem perfil de gestão): nada de Analytics, Feedbacks nem pendências para aprovar', () => {
    const c = chavesDo('colaborador');
    expect(c).not.toContain(chaves.analytics);
    expect(c).not.toContain(chaves.feedbacks);
    expect(c).not.toContain(chaves.ausenciasPendentes);
    expect(c).not.toContain(chaves.contagemPendentes);
    expect(c).toContain(chaves.avisos);
  });

  it('gestor aprova mas não vê Analytics nem Feedbacks', () => {
    const c = chavesDo('gestor');
    expect(c).toContain(chaves.ausenciasPendentes);
    expect(c).not.toContain(chaves.analytics);
    expect(c).not.toContain(chaves.feedbacks);
  });

  it('nunca repete chave e nunca pede dado de Admin (usuários da empresa) para quem não é super_admin', () => {
    for (const papel of ['rh', 'admin', 'gestor', 'colaborador', undefined]) {
      const c = chavesDo(papel);
      expect(new Set(c).size).toBe(c.length);
      expect(c.some((k) => k.startsWith('users'))).toBe(false);
    }
  });

  it('começa pela tela atual e depois pelo Dashboard', () => {
    const c = chavesDo('rh', '/feedbacks');
    expect(c[0]).toBe(chaves.feedbacks);
    expect(c.indexOf(chaves.proximosEventos(5))).toBeLessThan(c.indexOf(chaves.analytics));
  });

  it('quantidade de pedidos extras por login (RH): conta única e limitada', () => {
    expect(chavesDo('rh').length).toBeLessThanOrEqual(14);
  });

  it('hrefDoPathname e perfilPodeAbrir', () => {
    expect(hrefDoPathname('/')).toBe('/(tabs)');
    expect(hrefDoPathname('/colaboradores')).toBe('/(tabs)/colaboradores');
    expect(hrefDoPathname('/notificacoes')).toBe('/notificacoes');
    expect(hrefDoPathname('/login')).toBeNull();
    expect(perfilPodeAbrir('/(tabs)/analytics', 'colaborador')).toBe(false);
    expect(perfilPodeAbrir('/(tabs)/analytics', 'rh')).toBe(true);
    expect(perfilPodeAbrir('/notificacoes', 'colaborador')).toBe(true);
  });
});

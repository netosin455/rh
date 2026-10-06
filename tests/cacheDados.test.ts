// tests/cacheDados.test.ts — cache com revalidação: servir na hora, TTL, deduplicação, invalidação, sessão
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TTL_PADRAO_MS, aoInvalidar, assinar, atualizarCache, buscarComCache, chaveCasaComPrefixo, estaFresco, gravarCache,
  idadeDoCache, invalidar, lerCache, limpar, prefetch, temPedidoEmAndamento, versaoDoCache,
} from '../helpers/cacheDados';

beforeEach(() => limpar());

/** Promessa que o teste resolve na hora que quiser (simula API lenta). */
function adiavel<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((ok, nok) => { resolver = ok; rejeitar = nok; });
  return { promessa, resolver, rejeitar };
}

describe('leitura e frescor', () => {
  it('serve o dado gravado na hora', () => {
    gravarCache('employees:todos', ['Ana'], 1000);
    expect(lerCache<string[]>('employees:todos')?.dados).toEqual(['Ana']);
  });

  it('fresco até o TTL, velho depois (padrão 60 s)', () => {
    gravarCache('notices', [1], 1000);
    expect(TTL_PADRAO_MS).toBe(60_000);
    expect(estaFresco('notices', TTL_PADRAO_MS, 1000 + 59_999)).toBe(true);
    expect(estaFresco('notices', TTL_PADRAO_MS, 1000 + 60_000)).toBe(false);
    expect(idadeDoCache('notices', 4000)).toBe(3000);
    expect(idadeDoCache('nao-existe')).toBeNull();
  });

  it('atualizarCache muda o dado e mantém a idade (otimismo não "rejuvenesce")', () => {
    gravarCache('notices', [1, 2, 3], 500);
    atualizarCache<number[]>('notices', (l) => l.filter((n) => n !== 2));
    expect(lerCache<number[]>('notices')).toEqual({ dados: [1, 3], atualizadoEm: 500 });
    atualizarCache('sem-entrada', () => 1); // sem entrada: nada acontece
    expect(lerCache('sem-entrada')).toBeUndefined();
  });

  it('avisa quem assina a cada mudança', () => {
    const v0 = versaoDoCache();
    const ouvinte = vi.fn();
    const cancelar = assinar(ouvinte);
    gravarCache('a', 1);
    invalidar('a');
    expect(ouvinte).toHaveBeenCalledTimes(2);
    expect(versaoDoCache()).toBeGreaterThan(v0);
    cancelar();
    gravarCache('a', 2);
    expect(ouvinte).toHaveBeenCalledTimes(2);
  });
});

describe('buscarComCache', () => {
  it('grava o resultado e devolve o dado', async () => {
    await expect(buscarComCache('k', async () => 42)).resolves.toBe(42);
    expect(lerCache<number>('k')?.dados).toBe(42);
  });

  it('pedidos iguais em andamento viram um só (deduplicação)', async () => {
    const d = adiavel<number>();
    const buscar = vi.fn(() => d.promessa);
    const a = buscarComCache('k', buscar);
    const b = buscarComCache('k', buscar);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(temPedidoEmAndamento('k')).toBe(true);
    d.resolver(7);
    expect(await a).toBe(7);
    expect(await b).toBe(7);
    expect(temPedidoEmAndamento('k')).toBe(false);
  });

  it('erro não grava nada e é repassado; o próximo pedido tenta de novo', async () => {
    await expect(buscarComCache('k', async () => { throw new Error('falhou'); })).rejects.toThrow('falhou');
    expect(lerCache('k')).toBeUndefined();
    await expect(buscarComCache('k', async () => 'ok')).resolves.toBe('ok');
  });

  it('revalidação que falha MANTÉM o dado antigo em cache', async () => {
    gravarCache('k', 'antigo', 0);
    await expect(buscarComCache('k', async () => { throw new Error('rede'); })).rejects.toThrow('rede');
    expect(lerCache<string>('k')?.dados).toBe('antigo');
  });
});

describe('invalidação', () => {
  it('por prefixo, com fronteira ":"', () => {
    gravarCache('employees:todos', 1);
    gravarCache('employees', 1);
    gravarCache('employeesX', 1);
    gravarCache('absences:todos', 1);
    invalidar('employees');
    expect(lerCache('employees:todos')).toBeUndefined();
    expect(lerCache('employees')).toBeUndefined();
    expect(lerCache('employeesX')).toBeDefined();
    expect(lerCache('absences:todos')).toBeDefined();
    expect(chaveCasaComPrefixo('fechamento:2026-10', 'fechamento')).toBe(true);
    expect(chaveCasaComPrefixo('fechamentoX', 'fechamento')).toBe(false);
  });

  it('pedido que estava em andamento ANTES da invalidação não grava dado velho', async () => {
    const velho = adiavel<string>();
    const emVoo = buscarComCache('employees:todos', () => velho.promessa);
    invalidar('employees'); // uma escrita terminou enquanto o pedido voava
    velho.resolver('saldo-velho');
    await emVoo;
    expect(lerCache('employees:todos')).toBeUndefined();
    // E um pedido novo, depois da escrita, grava normalmente.
    await buscarComCache('employees:todos', async () => 'saldo-novo');
    expect(lerCache<string>('employees:todos')?.dados).toBe('saldo-novo');
  });

  it('um pedido antigo que termina depois não apaga o pedido novo da mesma chave', async () => {
    const velho = adiavel<string>();
    const novo = adiavel<string>();
    const p1 = buscarComCache('k', () => velho.promessa);
    invalidar('k');
    const p2 = buscarComCache('k', () => novo.promessa);
    velho.resolver('v');
    await p1;
    expect(temPedidoEmAndamento('k')).toBe(true);
    novo.resolver('n');
    await p2;
    expect(lerCache<string>('k')?.dados).toBe('n');
  });

  it('avisa quem registrou interesse no prefixo (ex.: contador de pendências)', () => {
    const fn = vi.fn();
    const cancelar = aoInvalidar('absences', fn);
    invalidar('employees');
    expect(fn).not.toHaveBeenCalled();
    invalidar('absences');
    expect(fn).toHaveBeenCalledTimes(1);
    cancelar();
    invalidar('absences');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('sessão: nada de uma sessão aparece na seguinte', () => {
  it('limpar() esquece tudo', () => {
    gravarCache('employees:todos', ['dado da empresa A']);
    gravarCache('fechamento:2026-10', { linhas: [] });
    limpar();
    expect(lerCache('employees:todos')).toBeUndefined();
    expect(lerCache('fechamento:2026-10')).toBeUndefined();
  });

  it('pedido em andamento durante o logout não grava depois (resposta tardia da sessão anterior)', async () => {
    const tardio = adiavel<string>();
    const emVoo = buscarComCache('employees:todos', () => tardio.promessa);
    limpar(); // logout / 401 / troca de usuário
    tardio.resolver('dado da empresa A');
    await emVoo;
    expect(lerCache('employees:todos')).toBeUndefined();
  });
});

describe('prefetch', () => {
  it('busca uma vez; com dado fresco, pedido em andamento ou dentro do TTL não busca de novo', async () => {
    const buscar = vi.fn(async () => 'x');
    prefetch('notices', buscar, 60_000, 1000);
    prefetch('notices', buscar, 60_000, 1001); // pedido em andamento
    expect(buscar).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 0));
    prefetch('notices', buscar, 60_000, Date.now()); // dado fresco
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('prefetch que falha é silencioso e não repete antes do TTL', async () => {
    const buscar = vi.fn(async () => { throw new Error('rede'); });
    prefetch('notices', buscar, 60_000, 1000);
    await new Promise((r) => setTimeout(r, 0));
    prefetch('notices', buscar, 60_000, 5000);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(lerCache('notices')).toBeUndefined();
  });

  it('depois de invalidado, o prefetch volta a valer', async () => {
    const buscar = vi.fn(async () => 'x');
    prefetch('notices', buscar, 60_000, 1000);
    await new Promise((r) => setTimeout(r, 0));
    invalidar('notices');
    prefetch('notices', buscar, 60_000, 2000);
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});

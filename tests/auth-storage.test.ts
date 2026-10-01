// tests/auth-storage.test.ts
// Storage corrompido não pode travar o app em "carregando": restaurarSessao nunca lança,
// sempre limpa o que é inválido e devolve null (o app cai no login).
import { describe, expect, it, vi } from 'vitest';
import { ArmazenamentoSessao, TOKEN_KEY, USER_KEY, restaurarSessao, tokenExpirado } from '../helpers/sessao';

const AGORA = Date.parse('2026-10-01T12:00:00Z');
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: unknown) => `${b64url({ alg: 'none' })}.${b64url(payload)}.assinatura`;
const TOKEN_VALIDO = jwt({ sub: 1, exp: Math.floor(AGORA / 1000) + 3600 });
const TOKEN_VENCIDO = jwt({ sub: 1, exp: Math.floor(AGORA / 1000) - 10 });
const USUARIO = JSON.stringify({ id: 1, company_id: 1, name: 'RH', email: 'rh@x.com', role: 'rh' });

function memoria(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  const storage: ArmazenamentoSessao = {
    getItem: async (k) => dados.get(k) ?? null,
    removeItem: async (k) => { dados.delete(k); },
  };
  return { storage, dados };
}

describe('tokenExpirado', () => {
  it('aceita base64url e respeita exp', () => {
    expect(tokenExpirado(TOKEN_VALIDO, AGORA)).toBe(false);
    expect(tokenExpirado(TOKEN_VENCIDO, AGORA)).toBe(true);
  });

  it('malformado, sem exp ou exp não numérico contam como vencido', () => {
    const ruins = ['', 'abc', 'a.b.c', `x.${b64url({ sub: 1 })}.y`, `x.${b64url({ exp: 'amanha' })}.y`, `x.${Buffer.from('isto nao e json').toString('base64url')}.y`];
    for (const ruim of ruins) expect(tokenExpirado(ruim, AGORA), ruim).toBe(true);
  });
});

describe('restaurarSessao', () => {
  it('sessão válida volta com token e usuário', async () => {
    const { storage } = memoria({ [TOKEN_KEY]: TOKEN_VALIDO, [USER_KEY]: USUARIO });
    await expect(restaurarSessao(storage, AGORA)).resolves.toMatchObject({ token: TOKEN_VALIDO, user: { id: 1, role: 'rh' } });
  });

  it('storage vazio: null, sem erro', async () => {
    const { storage } = memoria();
    await expect(restaurarSessao(storage, AGORA)).resolves.toBeNull();
  });

  it('JSON do usuário corrompido: não lança, limpa tudo e cai no login', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { storage, dados } = memoria({ [TOKEN_KEY]: TOKEN_VALIDO, [USER_KEY]: '{isso nao e json' });
    await expect(restaurarSessao(storage, AGORA)).resolves.toBeNull();
    expect(dados.size).toBe(0);
    aviso.mockRestore();
  });

  it('usuário com formato errado (JSON válido mas não é usuário): limpa', async () => {
    for (const bruto of ['123', 'null', '"texto"', '[]', '{"nome":"sem id"}']) {
      const { storage, dados } = memoria({ [TOKEN_KEY]: TOKEN_VALIDO, [USER_KEY]: bruto });
      await expect(restaurarSessao(storage, AGORA), bruto).resolves.toBeNull();
      expect(dados.size, bruto).toBe(0);
    }
  });

  it('token vencido ou malformado: limpa token e usuário', async () => {
    for (const token of [TOKEN_VENCIDO, 'lixo']) {
      const { storage, dados } = memoria({ [TOKEN_KEY]: token, [USER_KEY]: USUARIO });
      await expect(restaurarSessao(storage, AGORA)).resolves.toBeNull();
      expect(dados.size).toBe(0);
    }
  });

  it('só um dos dois itens salvo (sessão pela metade): limpa o que sobrou', async () => {
    for (const parcial of [{ [TOKEN_KEY]: TOKEN_VALIDO }, { [USER_KEY]: USUARIO }]) {
      const { storage, dados } = memoria(parcial);
      await expect(restaurarSessao(storage, AGORA)).resolves.toBeNull();
      expect(dados.size).toBe(0);
    }
  });

  it('o storage falhar ao LER não trava: resolve null e ainda tenta limpar', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const removeItem = vi.fn(async () => {});
    const storage: ArmazenamentoSessao = { getItem: async () => { throw new Error('disco indisponivel'); }, removeItem };
    await expect(restaurarSessao(storage, AGORA)).resolves.toBeNull();
    expect(removeItem).toHaveBeenCalledWith(TOKEN_KEY);
    expect(removeItem).toHaveBeenCalledWith(USER_KEY);
    aviso.mockRestore();
  });

  it('o storage falhar ao LIMPAR também não lança', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage: ArmazenamentoSessao = {
      getItem: async () => { throw new Error('leitura falhou'); },
      removeItem: async () => { throw new Error('escrita falhou'); },
    };
    await expect(restaurarSessao(storage, AGORA)).resolves.toBeNull();
    aviso.mockRestore();
  });

  it('o log de falha não carrega o conteúdo da sessão (sem PII)', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { storage } = memoria({ [TOKEN_KEY]: TOKEN_VALIDO, [USER_KEY]: '{"email":"rh@x.com" quebrado' });
    await restaurarSessao(storage, AGORA);
    const impresso = JSON.stringify(aviso.mock.calls);
    expect(impresso).not.toContain('rh@x.com');
    expect(impresso).not.toContain(TOKEN_VALIDO);
    aviso.mockRestore();
  });
});

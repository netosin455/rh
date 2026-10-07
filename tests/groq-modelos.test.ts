import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Groq from 'groq-sdk';
import { MODELOS_GROQ, limparTextoDoModelo, modeloIndisponivel, pedirAoGroq, reiniciarPreferenciaGroq } from '../api/_groq';

/** Erro como o do Groq em produção em 07/10/2026 (modelo aposentado). */
function erroModeloNaoExiste() {
  return Object.assign(new Error('404'), {
    status: 404,
    error: { error: { code: 'model_not_found', message: 'The model `llama-3.3-70b-versatile` does not exist' } },
  });
}

function groqFalso(criar: ReturnType<typeof vi.fn>): Groq {
  return { chat: { completions: { create: criar } } } as unknown as Groq;
}

const resposta = (texto: string) => ({ choices: [{ message: { content: texto } }] });
const pedido = { messages: [{ role: 'user' as const, content: 'oi' }], temperature: 0.4, max_tokens: 600 };

beforeEach(() => {
  reiniciarPreferenciaGroq();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('modeloIndisponivel', () => {
  it('reconhece o erro real do Groq (404 model_not_found)', () => {
    expect(modeloIndisponivel(erroModeloNaoExiste())).toBe(true);
  });
  it('reconhece modelo desativado por código, mesmo sem status 404', () => {
    expect(modeloIndisponivel({ status: 400, error: { error: { code: 'model_decommissioned' } } })).toBe(true);
  });
  it('NÃO trata chave inválida, limite de uso nem falha de rede como modelo indisponível', () => {
    expect(modeloIndisponivel({ status: 401 })).toBe(false);
    expect(modeloIndisponivel({ status: 429 })).toBe(false);
    expect(modeloIndisponivel({ status: 500 })).toBe(false);
    expect(modeloIndisponivel(new Error('fetch failed'))).toBe(false);
    expect(modeloIndisponivel(null)).toBe(false);
  });
});

describe('pedirAoGroq', () => {
  it('usa o primeiro modelo da lista e dá folga de tokens a modelo de raciocínio', async () => {
    const criar = vi.fn().mockResolvedValue(resposta('ok'));
    await pedirAoGroq(groqFalso(criar), pedido);
    const enviado = criar.mock.calls[0]![0] as Record<string, unknown>;
    expect(enviado.model).toBe(MODELOS_GROQ[0]!.id);
    expect(enviado.max_tokens).toBe(600 * MODELOS_GROQ[0]!.folgaDeTokens);
    expect(enviado.reasoning_effort).toBe('low');
    expect(enviado.temperature).toBe(0.4);
  });

  it('cai para o próximo modelo quando o primeiro não existe mais, e lembra qual funcionou', async () => {
    const criar = vi.fn()
      .mockRejectedValueOnce(erroModeloNaoExiste())
      .mockResolvedValue(resposta('veio do segundo'));
    const groq = groqFalso(criar);

    const r = await pedirAoGroq(groq, pedido);
    expect(r.choices[0]!.message.content).toBe('veio do segundo');
    expect(criar.mock.calls.map((c) => (c[0] as { model: string }).model)).toEqual([MODELOS_GROQ[0]!.id, MODELOS_GROQ[1]!.id]);

    // Próximo pedido já começa pelo modelo que funcionou (não tenta o morto de novo).
    await pedirAoGroq(groq, pedido);
    expect((criar.mock.calls[2]![0] as { model: string }).model).toBe(MODELOS_GROQ[1]!.id);
  });

  it('só repassa as ferramentas quando o pedido as traz', async () => {
    const criar = vi.fn().mockResolvedValue(resposta('ok'));
    await pedirAoGroq(groqFalso(criar), pedido);
    expect(criar.mock.calls[0]![0]).not.toHaveProperty('tools');
    const tools = [{ type: 'function', function: { name: 'x', description: 'x', parameters: {} } }] as unknown as Groq.Chat.ChatCompletionTool[];
    await pedirAoGroq(groqFalso(criar), { ...pedido, tools });
    expect((criar.mock.calls[1]![0] as { tools: unknown }).tools).toBe(tools);
  });

  it('chave inválida (401) é repassada na hora, sem trocar de modelo (não esconde o problema real)', async () => {
    const criar = vi.fn().mockRejectedValue(Object.assign(new Error('401'), { status: 401 }));
    await expect(pedirAoGroq(groqFalso(criar), pedido)).rejects.toMatchObject({ status: 401 });
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it('se TODOS os modelos saírem do ar, repassa o erro depois de tentar cada um uma vez', async () => {
    const criar = vi.fn().mockRejectedValue(erroModeloNaoExiste());
    await expect(pedirAoGroq(groqFalso(criar), pedido)).rejects.toMatchObject({ status: 404 });
    expect(criar).toHaveBeenCalledTimes(MODELOS_GROQ.length);
  });
});

describe('limparTextoDoModelo', () => {
  it('remove o raciocínio interno e os espaços nas pontas', () => {
    expect(limparTextoDoModelo('<think>pensando...\nvárias linhas</think>\n  Resposta final  ')).toBe('Resposta final');
  });
  it('texto nulo ou vazio vira string vazia (quem chama decide o plano B)', () => {
    expect(limparTextoDoModelo(null)).toBe('');
    expect(limparTextoDoModelo(undefined)).toBe('');
    expect(limparTextoDoModelo('<think>só pensou</think>')).toBe('');
  });
});

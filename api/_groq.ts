// ============================================================
// api/_groq.ts — SuperRH
// Chamada ao Groq com lista de modelos em ordem de preferência e queda automática para o próximo.
//
// Por quê: o Groq aposenta modelos (o llama-3.3-70b-versatile foi desligado em 16/08/2026 e os Insights, o
// Assistente de IA e o relatório semanal passaram a falhar com 404 "model_not_found"). Com uma lista, o app
// continua funcionando enquanto houver um modelo vivo, e o erro passa a aparecer só se TODOS saírem do ar.
// Arquivo com "_" no nome: não vira rota da Vercel.
// ============================================================

import type Groq from 'groq-sdk';

interface ConfigModelo {
  id: string;
  /** Campos extras aceitos só por esse modelo (o SDK repassa ao Groq mesmo sem tipagem). */
  extra: Record<string, unknown>;
  /** Modelos de raciocínio gastam parte de max_tokens "pensando": damos folga para a resposta não vir vazia. */
  folgaDeTokens: number;
}

/** Em ordem de preferência. Os dois primeiros são os substitutos recomendados pelo Groq. */
export const MODELOS_GROQ: readonly ConfigModelo[] = [
  { id: 'openai/gpt-oss-120b', extra: { reasoning_effort: 'low' }, folgaDeTokens: 3 },
  { id: 'qwen/qwen3.6-27b', extra: { reasoning_format: 'hidden' }, folgaDeTokens: 3 },
  { id: 'llama-3.3-70b-versatile', extra: {}, folgaDeTokens: 1 },
];

export interface PedidoGroq {
  messages: Groq.Chat.ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
  tools?: Groq.Chat.ChatCompletionTool[];
}

/** Índice do modelo que respondeu por último: evita tentar de novo, a cada pedido, os que já saíram do ar. */
let preferido = 0;

/** Só para testes: volta a tentar a lista desde o primeiro modelo. */
export function reiniciarPreferenciaGroq(): void {
  preferido = 0;
}

/** O modelo não existe, foi aposentado ou a conta não tem acesso a ele (vale tentar o próximo). */
export function modeloIndisponivel(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;
  const e = erro as { status?: unknown; code?: unknown; error?: { error?: { code?: unknown }; code?: unknown } };
  const codigo = e.error?.error?.code ?? e.error?.code ?? e.code;
  if (codigo === 'model_not_found' || codigo === 'model_decommissioned' || codigo === 'model_not_active') return true;
  return e.status === 404;
}

/** Tira o raciocínio interno (<think>...</think>) que alguns modelos deixam no texto. */
export function limparTextoDoModelo(texto: string | null | undefined): string {
  return (texto ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Pede uma resposta ao Groq. Se o modelo não existir mais, tenta o seguinte da lista.
 * Qualquer outro erro (chave inválida, limite, rede) é repassado: não adianta trocar de modelo.
 */
export async function pedirAoGroq(groq: Groq, pedido: PedidoGroq): Promise<Groq.Chat.ChatCompletion> {
  let ultimoErro: unknown;
  for (let i = 0; i < MODELOS_GROQ.length; i += 1) {
    const indice = (preferido + i) % MODELOS_GROQ.length;
    const modelo = MODELOS_GROQ[indice]!;
    try {
      const resposta = await groq.chat.completions.create({
        model: modelo.id,
        messages: pedido.messages,
        ...(pedido.temperature !== undefined ? { temperature: pedido.temperature } : {}),
        ...(pedido.max_tokens !== undefined ? { max_tokens: pedido.max_tokens * modelo.folgaDeTokens } : {}),
        ...(pedido.tools ? { tools: pedido.tools } : {}),
        ...modelo.extra,
      });
      preferido = indice;
      return resposta;
    } catch (erro: unknown) {
      if (!modeloIndisponivel(erro)) throw erro;
      ultimoErro = erro;
      console.warn({ level: 'warn', event: 'groq_modelo_indisponivel', modelo: modelo.id });
    }
  }
  throw ultimoErro;
}

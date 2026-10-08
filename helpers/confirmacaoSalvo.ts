// ============================================================
// helpers/confirmacaoSalvo.ts — SuperRH
// "Salvo" no próprio botão (fluidez F4). Depois que a API confirma o sucesso, a tela chama
// `await confirmarSalvo()` ANTES de fechar o modal/navegar: o botão de enviar (que está em "carregando")
// troca o conteúdo por um check + "Salvo" e a tela espera no máximo 450 ms (dial.salvoMs) para seguir.
//  - se nenhum botão está esperando (ou com "reduzir movimento"), não espera nada: o modal fecha na hora;
//  - em caso de ERRO a tela simplesmente não chama isto: nada muda, o erro aparece como sempre;
//  - o botão continua desabilitado o tempo todo (ele só sai de "carregando" quando a tela encerra o envio).
// ============================================================

import { duracaoDoSalvo } from './microinteracoes';

/** Cada botão em "carregando" se registra aqui; devolve se deve esperar (reduzMovimento) ou null se não aplicável. */
type Ouvinte = () => { reduzMovimento: boolean } | null;
const ouvintes = new Set<Ouvinte>();

/** Usado pelo componente Button enquanto está em "carregando". Devolve a função de cancelar. */
export function registrarBotaoDeSalvar(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => { ouvintes.delete(ouvinte); };
}

/** Mostra "Salvo" nos botões em envio e espera o tempo certo (0 se ninguém mostrou ou se for movimento reduzido). */
export async function confirmarSalvo(): Promise<void> {
  let espera = 0;
  for (const ouvinte of [...ouvintes]) {
    const resposta = ouvinte();
    if (resposta) espera = Math.max(espera, duracaoDoSalvo(resposta.reduzMovimento));
  }
  if (espera > 0) await new Promise<void>((resolver) => { setTimeout(resolver, espera); });
}

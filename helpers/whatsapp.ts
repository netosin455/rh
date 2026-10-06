// ============================================================
// helpers/whatsapp.ts — SuperRH
// Mensagens prontas e link do WhatsApp (https://wa.me). Sem React e sem rede.
// Regra de privacidade: a mensagem leva SÓ o link (e o primeiro nome de quem recebe, no feedback).
// Nunca o conteúdo do feedback, nota, resposta ou nome de terceiros.
// ============================================================

/**
 * Telefone brasileiro para o formato internacional do wa.me (só dígitos, com 55).
 * Aceita "(11) 98888-7777", "11988887777", "+55 11 98888-7777", "011 98888-7777", fixo com DDD.
 * Telefone inválido (curto, longo, DDD inexistente) devolve null: quem chama cai no wa.me sem número.
 */
export function normalizarTelefoneWhatsapp(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  let digitos = telefone.replace(/\D/g, '');
  // Zero de operadora/tronco na frente (ex.: 011 98888-7777).
  digitos = digitos.replace(/^0+/, '');
  // Já com o código do país.
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) digitos = digitos.slice(2);
  // Agora precisa ser DDD (2) + número (8 fixo ou 9 celular).
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  const ddd = Number(digitos.slice(0, 2));
  if (ddd < 11 || ddd > 99 || digitos[1] === '0') return null;
  const numero = digitos.slice(2);
  // Celular tem 9 dígitos e começa com 9; fixo tem 8 e não começa com 0 nem 1.
  if (numero.length === 9 && numero[0] !== '9') return null;
  if (numero.length === 8 && (numero[0] === '0' || numero[0] === '1')) return null;
  return `55${digitos}`;
}

/** Link do WhatsApp com a mensagem (url-encoded). Sem telefone válido: wa.me sem número, o RH escolhe o contato. */
export function urlWhatsapp(mensagem: string, telefone?: string | null): string {
  const numero = normalizarTelefoneWhatsapp(telefone);
  return `https://wa.me/${numero ?? ''}?text=${encodeURIComponent(mensagem)}`;
}

/** Primeiro nome, para cumprimentar. Vazio => null. */
function primeiroNome(nome: string | null | undefined): string | null {
  const primeiro = nome?.trim().split(/\s+/)[0];
  return primeiro ? primeiro : null;
}

export function mensagemPesquisa(link: string): string {
  return `Olá! Sua opinião é importante. Responda nossa pesquisa (leva 1 minuto): ${link}`;
}

export function mensagemNps(link: string): string {
  return `Olá! Como foi seu atendimento conosco? Avalie em 1 minuto: ${link}`;
}

/** Só o primeiro nome do destinatário e o link; o texto do feedback NUNCA entra. */
export function mensagemFeedback(nomeColaborador: string | null | undefined, link: string): string {
  const nome = primeiroNome(nomeColaborador);
  return `${nome ? `Olá, ${nome}.` : 'Olá.'} Há um feedback para você: ${link}`;
}

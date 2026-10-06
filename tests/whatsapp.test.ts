// tests/whatsapp.test.ts
import { describe, expect, it } from 'vitest';
import { mensagemFeedback, mensagemNps, mensagemPesquisa, normalizarTelefoneWhatsapp, urlWhatsapp } from '../helpers/whatsapp';

describe('normalizarTelefoneWhatsapp', () => {
  it('celular com e sem 55, mascarado ou não', () => {
    expect(normalizarTelefoneWhatsapp('(11) 98888-7777')).toBe('5511988887777');
    expect(normalizarTelefoneWhatsapp('11988887777')).toBe('5511988887777');
    expect(normalizarTelefoneWhatsapp('+55 11 98888-7777')).toBe('5511988887777');
    expect(normalizarTelefoneWhatsapp('5511988887777')).toBe('5511988887777');
    expect(normalizarTelefoneWhatsapp('011 98888-7777')).toBe('5511988887777');
  });

  it('fixo com DDD (8 dígitos)', () => {
    expect(normalizarTelefoneWhatsapp('(21) 3333-4444')).toBe('552133334444');
  });

  it('inválidos viram null', () => {
    for (const ruim of [null, undefined, '', 'abc', '12345', '98888-7777', '(00) 98888-7777', '(11) 88888-7777', '(11) 1333-4444', '1198888777788', '55119888877']) {
      expect(normalizarTelefoneWhatsapp(ruim)).toBeNull();
    }
  });
});

describe('urlWhatsapp', () => {
  it('sem número: wa.me/?text= com a mensagem codificada', () => {
    expect(urlWhatsapp('Olá! A&B = 100%?')).toBe(`https://wa.me/?text=${encodeURIComponent('Olá! A&B = 100%?')}`);
    expect(urlWhatsapp('x')).toBe('https://wa.me/?text=x');
  });

  it('com telefone válido usa o número; inválido cai no wa.me sem número', () => {
    expect(urlWhatsapp('oi', '(11) 98888-7777')).toBe('https://wa.me/5511988887777?text=oi');
    expect(urlWhatsapp('oi', '123')).toBe('https://wa.me/?text=oi');
  });

  it('o link da mensagem sobrevive ao encode (decodifica de volta igual)', () => {
    const link = 'https://super-rh.vercel.app/responder/5?a=1&b=2';
    const url = urlWhatsapp(mensagemPesquisa(link));
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(`Olá! Sua opinião é importante. Responda nossa pesquisa (leva 1 minuto): ${link}`);
  });
});

describe('mensagens prontas', () => {
  const link = 'https://exemplo.test/x';

  it('pesquisa e NPS levam só o texto fixo e o link', () => {
    expect(mensagemPesquisa(link)).toBe(`Olá! Sua opinião é importante. Responda nossa pesquisa (leva 1 minuto): ${link}`);
    expect(mensagemNps(link)).toBe(`Olá! Como foi seu atendimento conosco? Avalie em 1 minuto: ${link}`);
  });

  it('feedback usa só o primeiro nome do destinatário e nunca vaza conteúdo', () => {
    const msg = mensagemFeedback('  Ana Paula Souza ', link);
    expect(msg).toBe(`Olá, Ana. Há um feedback para você: ${link}`);
    expect(msg).not.toContain('Souza');
    expect(mensagemFeedback(null, link)).toBe(`Olá. Há um feedback para você: ${link}`);
  });
});

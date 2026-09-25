import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRecognitionEmail, sendEmail } from '../api/_email';

const originalApiKey = process.env.RESEND_API_KEY;
const originalFetch = global.fetch;

afterEach(() => {
  process.env.RESEND_API_KEY = originalApiKey;
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('email transacional', () => {
  it('ignora email vazio ou inválido sem chamar o Resend', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    global.fetch = vi.fn();

    await expect(sendEmail('', 'Assunto', '<p>Olá</p>')).resolves.toBe(false);
    await expect(sendEmail('invalido', 'Assunto', '<p>Olá</p>')).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('propaga resposta de erro do Resend para o chamador registrar sem mascará-la', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(sendEmail('colaborador@empresa.com', 'Assunto', '<p>Olá</p>')).rejects.toThrow('503');
  });

  it('escapa o conteúdo livre do reconhecimento no HTML', () => {
    const email = buildRecognitionEmail({
      employeeName: 'Ana',
      senderName: 'João',
      message: '<script>alert(1)</script>',
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});

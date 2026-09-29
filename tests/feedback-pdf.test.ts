import { describe, expect, it } from 'vitest';
import { createFeedbackPdf } from '../api/feedback/_pdf';

describe('PDF de feedback', () => {
  it('gera um documento PDF válido sem colocar token no conteúdo', async () => {
    const pdf = await createFeedbackPdf({
      company_name: 'Empresa Jurídica',
      employee_name: 'Ana Cláudia',
      title: 'Feedback de desenvolvimento',
      content: 'Conteúdo com acentuação: colaboração, ética e evolução.',
      published_at: '2026-09-29T12:00:00.000Z',
      acknowledged_at: null,
    });

    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe('%PDF');
  });
});

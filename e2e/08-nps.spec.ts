// Fluxo (h): NPS — criar campanha pelo modelo, responder como cliente (sem contato) e repetir.

import { entrarComoRh, expect, test } from './base';
import type { Page } from '@playwright/test';

/** Percorre o formulário público: nota 9 e, sem preencher nada opcional, até "Enviar respostas". */
async function responderComNota9(page: Page, id: number): Promise<void> {
  await page.goto(`/responder/${id}`);
  await expect(page.getByText('Pergunta 1 de 4')).toBeVisible();
  await page.getByRole('radio', { name: 'Nota 9', exact: true }).click();
  // Perguntas 2 a 4 são opcionais (botão "Pular"); depois da 4ª vem o passo do contato.
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Próxima pergunta' }).click();
  await expect(page.getByText('Último passo')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar respostas' }).click();
}

test('criar campanha pelo modelo, responder nota 9 sem contato e bloquear a segunda resposta', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/nps');
  await page.getByRole('button', { name: 'Nova campanha NPS' }).click();
  await expect(page).toHaveURL(/\/nps\/nova$/);
  await page.getByRole('button', { name: 'Criar campanha' }).click();

  await expect.poll(() => api.surveys.length).toBe(1);
  const criacao = api.escritasDe('POST', /^\/api\/surveys$/);
  expect(criacao).toHaveLength(1);
  const corpo = criacao[0].corpo as { title: string; audience: string; questions: { type: string; required: boolean }[] };
  expect(corpo.title).toBe('Satisfação do cliente');
  expect(corpo.audience).toBe('customers');
  expect(corpo.questions.map((q) => q.type)).toEqual(['nps', 'text', 'scale', 'scale']);
  expect(corpo.questions[0].required).toBe(true);
  await expect(page).toHaveURL(/\/nps$/);

  const pesquisa = api.surveys[0];
  const idNps = pesquisa.questions?.[0].id;

  // 1ª resposta: nota 9, sem marcar o consentimento de contato.
  await responderComNota9(page, pesquisa.id);
  await expect(page.getByText('Obrigado pela sua avaliação!')).toBeVisible();
  expect(api.respostasRecebidas).toHaveLength(1);
  const envio = api.respostasRecebidas[0].corpo;
  expect(envio).not.toHaveProperty('contact');
  expect(envio.answers).toEqual([{ question_id: idNps, score: 9 }]);
  expect(typeof envio.voter_token).toBe('string');

  // 2ª resposta do MESMO aparelho (mesmo voter_token no armazenamento): a API recusa e o app avisa.
  await responderComNota9(page, pesquisa.id);
  await expect(page.getByText('Você já respondeu esta pesquisa neste aparelho. Obrigado!')).toBeVisible();
  await expect(page.getByText('Obrigado pela sua avaliação!')).toBeHidden();
  expect(api.respostasRecebidas).toHaveLength(1);
});

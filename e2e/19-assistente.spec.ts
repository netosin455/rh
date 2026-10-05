// Fluxo (19): Assistente (IA) — resposta simulada e erro 502 sem quebrar a tela.

import { entrarComoRh, expect, test } from './base';

test('enviar mensagem e mostrar a resposta simulada', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/ia');
  await expect(page.getByText(/Sou o assistente do SuperRH/)).toBeVisible();

  const enviar = page.getByRole('button', { name: 'Enviar mensagem' });
  await expect(enviar).toBeDisabled();
  await page.getByLabel('Mensagem', { exact: true }).fill('Quem está de férias este mês?');
  await expect(enviar).toBeEnabled();
  await enviar.click();

  await expect(page.getByText('Resposta simulada do assistente.')).toBeVisible();
  const chat = api.escritasDe('POST', /^\/api\/chat$/);
  expect(chat).toHaveLength(1);
  const mensagens = (chat[0].corpo as { messages: { role: string; content: string }[] }).messages;
  expect(mensagens[mensagens.length - 1]).toEqual({ role: 'user', content: 'Quem está de férias este mês?' });
  // A caixa esvazia depois de enviar.
  await expect(page.getByLabel('Mensagem', { exact: true })).toHaveValue('');
});

test('IA fora do ar (502) mostra a mensagem de indisponibilidade e a tela continua usável', async ({ page, api }) => {
  api.chatIndisponivel = true;
  await entrarComoRh(page);
  await page.goto('/ia');
  await page.getByLabel('Mensagem', { exact: true }).fill('Olá?');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();

  await expect(page.getByText('Assistente temporariamente indisponível. Tente novamente em instantes.')).toBeVisible();

  // Voltando a funcionar, uma nova pergunta é respondida normalmente.
  api.chatIndisponivel = false;
  await page.getByLabel('Mensagem', { exact: true }).fill('E agora?');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(page.getByText('Resposta simulada do assistente.')).toBeVisible();
});

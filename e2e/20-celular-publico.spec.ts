// Fluxo (20, celular 390x844): páginas públicas — pesquisa e NPS com alvos de toque grandes e sem rolagem lateral.

import { expect, semRolagemHorizontal, test } from './base';

const ALVO_MINIMO = 44;

test('pesquisa pública no celular: escala com alvos >= 44 px e envio completo', async ({ page, api }) => {
  const s = api.semearPesquisa('Clima de outubro', 'employees', [
    { question: 'Como você avalia o ambiente?', type: 'scale', required: true },
    { question: 'Como prefere trabalhar?', type: 'choice', options: ['Remoto', 'Presencial'], required: true },
  ]);
  await page.goto(`/responder/${s.id}`);
  await expect(page.getByText('Pergunta 1 de 2')).toBeVisible();
  await semRolagemHorizontal(page);

  const notas = page.getByRole('radio', { name: /^[1-5] — / });
  await expect(notas).toHaveCount(5);
  for (const nota of await notas.all()) {
    const caixa = await nota.boundingBox();
    expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_MINIMO);
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_MINIMO);
  }

  await page.getByRole('radio', { name: /^5 — / }).click();
  await page.getByRole('button', { name: 'Próxima pergunta' }).click();
  await page.getByRole('radio', { name: 'Remoto', exact: true }).click();
  await semRolagemHorizontal(page);
  await page.getByRole('button', { name: 'Enviar respostas' }).click();
  await expect(page.getByText('Obrigado, sua resposta foi enviada')).toBeVisible();
  await semRolagemHorizontal(page);
  expect(api.respostasRecebidas).toHaveLength(1);
});

test('NPS público no celular: 11 botões (0 a 10) em 2 linhas, alvos >= 44 px, e envio com nota 9', async ({ page, api }) => {
  const s = api.semearPesquisa('Satisfação do cliente', 'customers', [
    { question: 'De 0 a 10, quanto você recomendaria nosso escritório?', type: 'nps', required: true },
    { question: 'Qual o motivo da nota?', type: 'text', required: false },
  ]);
  await page.goto(`/responder/${s.id}`);
  await expect(page.getByText('Pergunta 1 de 2')).toBeVisible();
  await semRolagemHorizontal(page);

  const botoes = page.getByRole('radio', { name: /^Nota \d+$/ });
  await expect(botoes).toHaveCount(11);
  const topos = new Set<number>();
  for (const botao of await botoes.all()) {
    const caixa = await botao.boundingBox();
    expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(ALVO_MINIMO);
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(ALVO_MINIMO);
    expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(390);
    topos.add(Math.round(caixa?.y ?? 0));
  }
  // Duas linhas (6 + 5): exatamente duas posições verticais diferentes.
  expect(topos.size).toBe(2);

  await page.getByRole('radio', { name: 'Nota 9', exact: true }).click();
  await page.getByRole('button', { name: 'Próxima pergunta' }).click(); // pergunta 2 (opcional)
  await page.getByRole('button', { name: 'Próxima pergunta' }).click(); // passo do contato
  await expect(page.getByText('Último passo').first()).toBeVisible();
  await semRolagemHorizontal(page);
  // O consentimento também é um alvo grande e o formulário de contato cabe na tela.
  const consentimento = await page.getByRole('checkbox', { name: /aceito ser contatado/ }).boundingBox();
  expect(consentimento?.height ?? 0).toBeGreaterThanOrEqual(ALVO_MINIMO);
  await page.getByRole('button', { name: 'Enviar respostas' }).click();

  await expect(page.getByText('Obrigado pela sua avaliação!')).toBeVisible();
  await semRolagemHorizontal(page);
  expect(api.respostasRecebidas[0].corpo).not.toHaveProperty('contact');
});

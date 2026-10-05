// Fluxo (g): Analytics — filtro de risco médio, abrir pessoa e voltar mantém ?risco=medio.

import { entrarComoRh, expect, test } from './base';

test('Risco médio lista só quem é médio (com motivo) e o filtro sobrevive ao abrir uma pessoa', async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/analytics');

  const linhas = page.getByRole('button', { name: /^Ver detalhes de / });
  // Sem filtro: alto + médio (Ana, Bruno e Carla).
  await expect(linhas).toHaveCount(3);

  await page.getByRole('button', { name: /^Risco médio:/ }).click();
  await expect(page).toHaveURL(/risco=medio/);
  await expect(page.getByText('Risco médio · 2 pessoas')).toBeVisible();
  await expect(linhas).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^Ver detalhes de Bruno Lima, risco médio\. 2 faltas em 90 dias/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Ver detalhes de Carla Dias, risco médio\. Pulso 3,2\/5/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ana Souza/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Risco médio:/ })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: /^Ver detalhes de Bruno Lima/ }).click();
  await expect(page).toHaveURL(/\/colaborador\/2$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/analytics\?.*risco=medio/);
  await expect(page.getByText('Risco médio · 2 pessoas')).toBeVisible();
  await expect(linhas).toHaveCount(2);

  // "Ver todos" limpa o filtro.
  await page.getByRole('button', { name: 'Ver todos os níveis de risco' }).click();
  await expect(page).not.toHaveURL(/risco=/);
  await expect(linhas).toHaveCount(3);
});

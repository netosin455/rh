// Fluxo (28, celular 390x844): Fechamento — a tabela rola DENTRO do cartão; a página não rola de lado.

import { entrarComoRh, expect, semRolagemHorizontal, test } from './base';

test('fechamento no celular: sem rolagem horizontal da página; tabela rola dentro do cartão', async ({ page, api }) => {
  api.employees[0].name = 'Ana Beatriz de Albuquerque Montenegro Souza'; // nome longo
  await entrarComoRh(page);
  await page.goto('/fechamento');
  await expect(page.getByRole('row').filter({ hasText: 'TOTAL' })).toBeVisible();
  await semRolagemHorizontal(page);

  // Os botões e o aviso cabem na tela de 390 px.
  for (const nome of ['Baixar CSV', 'Imprimir / PDF', 'Mês anterior', 'Próximo mês']) {
    const caixa = await page.getByRole('button', { name: nome }).boundingBox();
    expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(390);
  }

  // A tabela é mais larga que a tela, mas quem rola é o cartão (a última coluna fica fora da vista até rolar).
  const cabecalho = page.getByRole('columnheader', { name: 'Saldo do banco (h)' });
  const antes = await cabecalho.boundingBox();
  expect(antes?.x ?? 0).toBeGreaterThan(390 - 1);
  await cabecalho.scrollIntoViewIfNeeded();
  const depois = await cabecalho.boundingBox();
  expect((depois?.x ?? 9999) + (depois?.width ?? 0)).toBeLessThanOrEqual(390);
  await semRolagemHorizontal(page);

  // Troca de mês continua sem estourar a largura.
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'TOTAL' })).toBeVisible();
  await semRolagemHorizontal(page);
});

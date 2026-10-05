// Fluxo (c): Equipe — buscar, abrir o perfil, sidebar continua com "Equipe" ativo.

import { entrarComoRh, expect, itemAtivoDaSidebar, test } from './base';

test.beforeEach(async ({ page }) => {
  await entrarComoRh(page);
});

test('buscar, abrir o perfil e manter Equipe ativo na sidebar', async ({ page }) => {
  await page.goto('/colaboradores');
  await expect(page.getByRole('button', { name: /^Abrir perfil de / })).toHaveCount(5);
  await expect.poll(() => itemAtivoDaSidebar(page)).toEqual(['Abrir Equipe']);

  await page.getByLabel('Buscar colaborador por nome ou cargo').fill('bruno');
  await expect(page.getByRole('button', { name: /^Abrir perfil de / })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Abrir perfil de Bruno Lima' })).toBeVisible();

  await page.getByRole('button', { name: 'Abrir perfil de Bruno Lima' }).click();
  await expect(page).toHaveURL(/\/colaborador\/2$/);
  // A lista da Equipe continua montada por baixo (Stack): só conta o que está visível.
  await expect(page.getByText('Bruno Lima').filter({ visible: true }).first()).toBeVisible();
  // A sidebar não some e o item ativo continua sendo Equipe (rota de detalhe pertence a ele).
  await expect(page.getByRole('tab', { name: /^Abrir Equipe/ })).toBeVisible();
  await expect.poll(() => itemAtivoDaSidebar(page)).toEqual(['Abrir Equipe']);
});

// Regressão de um bug real que o próprio E2E achou: a busca da Equipe diferenciava acentos
// ("juridico" não achava "Jurídico"). Corrigido com normalizarTexto (mesmo do seletor do Lançar).
test('busca da Equipe ignora acento ("juridico" acha "Jurídico")', async ({ page }) => {
  await page.goto('/colaboradores');
  await expect(page.getByRole('button', { name: /^Abrir perfil de / })).toHaveCount(5);
  await page.getByLabel('Buscar colaborador por nome ou cargo').fill('juridico');
  await expect(page.getByRole('button', { name: 'Abrir perfil de Bruno Lima' })).toBeVisible({ timeout: 2_000 });
});

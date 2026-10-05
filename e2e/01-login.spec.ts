// Fluxo (a): login com senha errada e depois certa; Dashboard abre sem exceção JS
// (a exceção é conferida pelo fixture: `pageerror` derruba o teste).

import { CREDENCIAIS, expect, itemAtivoDaSidebar, loginPelaTela, test } from './base';

test('login errado mostra o erro e não cria sessão; login certo abre o Dashboard', async ({ page, api }) => {
  await loginPelaTela(page, CREDENCIAIS.usuario, 'senha-errada');
  await expect(page.getByRole('alert').filter({ hasText: 'Usuário ou senha incorretos' })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => window.localStorage.getItem('@superrh:token'))).toBeNull();

  // Certo: o usuário é normalizado (minúsculas/sem espaços) antes de ir para a API.
  await page.getByLabel('Usuário', { exact: true }).fill(`  ${CREDENCIAIS.usuario.toUpperCase()} `);
  await page.getByLabel('Senha', { exact: true }).fill(CREDENCIAIS.senha);
  await page.getByRole('button', { name: /^Entrar/ }).click();

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('tab', { name: /^Abrir Dashboard/ })).toBeVisible();
  await expect.poll(() => itemAtivoDaSidebar(page)).toEqual(['Abrir Dashboard']);
  expect(await page.evaluate(() => window.localStorage.getItem('@superrh:token'))).not.toBeNull();

  const logins = api.escritasDe('POST', /\/api\/auth\/login/);
  expect(logins.map((l) => (l.corpo as { username: string }).username)).toEqual([CREDENCIAIS.usuario, CREDENCIAIS.usuario]);
});

// Fluxo (b): sair da conta volta ao login e a sessão realmente some.

import { expect, loginPelaTela, test } from './base';

test('logout volta ao login e a sessão some (rota protegida não abre mais)', async ({ page }) => {
  await loginPelaTela(page);
  await expect(page.getByRole('tab', { name: /^Abrir Dashboard/ })).toBeVisible();

  // Na web a confirmação é window.confirm.
  page.once('dialog', (dialogo) => { void dialogo.accept(); });
  await page.getByRole('button', { name: 'Sair da conta' }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: /^Entrar/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => [window.localStorage.getItem('@superrh:token'), window.localStorage.getItem('@superrh:user')])).toEqual([null, null]);

  // Sem sessão, abrir uma tela protegida cai no login.
  await page.goto('/colaboradores');
  await expect(page).toHaveURL(/\/login/);
});

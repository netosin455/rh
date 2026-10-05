// Fluxo (i): 401 no meio do uso volta ao login SEM recarregar a página.

import { entrarComoRh, expect, test } from './base';

test('401 no meio do uso limpa a sessão e leva ao login sem recarregar', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/colaboradores');
  await expect(page.getByRole('button', { name: /^Abrir perfil de / })).toHaveCount(5);

  // Marcador na janela: se a página recarregasse, ele sumiria.
  await page.evaluate(() => { (window as unknown as { __semRecarga: boolean }).__semRecarga = true; });

  // A API passa a recusar o token; qualquer ação que busque dados dispara o 401.
  api.sessaoExpirada = true;
  await page.getByRole('tab', { name: /^Abrir Férias/ }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: /^Entrar/ })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __semRecarga?: boolean }).__semRecarga)).toBe(true);
  expect(await page.evaluate(() => [window.localStorage.getItem('@superrh:token'), window.localStorage.getItem('@superrh:user')])).toEqual([null, null]);
});

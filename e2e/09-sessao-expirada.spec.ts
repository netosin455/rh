// Fluxo (i): 401 no meio do uso volta ao login SEM recarregar a página.

import { entrarComoRh, expect, test } from './base';

test('401 no meio do uso limpa a sessão e leva ao login sem recarregar', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/colaboradores');
  await expect(page.getByRole('button', { name: /^Abrir perfil de / })).toHaveCount(5);

  // Marcador na janela: se a página recarregasse, ele sumiria.
  await page.evaluate(() => { (window as unknown as { __semRecarga: boolean }).__semRecarga = true; });

  // A API passa a recusar o token; qualquer ação que busque dados dispara o 401.
  // (Férias já foi aquecida em segundo plano e abre do cache sem chamada: usa Kudos, que ainda não foi buscada.)
  // O aquecimento do cache pode ainda estar buscando dados e levar o 401 ANTES do clique: o app já terá voltado
  // ao login e o botão do menu não existe mais. Vale qualquer chamada que pegue o 401; o que se prova é o resultado.
  api.sessaoExpirada = true;
  await page.getByRole('tab', { name: /^Abrir Kudos/ }).click({ timeout: 3_000 }).catch(() => undefined);

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: /^Entrar/ })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __semRecarga?: boolean }).__semRecarga)).toBe(true);
  expect(await page.evaluate(() => [window.localStorage.getItem('@superrh:token'), window.localStorage.getItem('@superrh:user')])).toEqual([null, null]);
});

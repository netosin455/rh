// Fluxo (17): Admin — só super_admin vê o menu e a tela; RH não vê nem consegue usar; criar usuário.

import { entrarComo, entrarComoRh, expect, itemAtivoDaSidebar, test, USUARIO_SUPER } from './base';

test('super_admin vê o item Admin, a lista e cria um usuário com payload exato', async ({ page, api }) => {
  await entrarComo(page, USUARIO_SUPER);
  await page.goto('/admin');
  await expect(page.getByRole('tab', { name: /^Abrir Admin/ })).toBeVisible();
  await expect.poll(() => itemAtivoDaSidebar(page)).toEqual(['Abrir Admin']);
  await expect(page.getByRole('button', { name: 'Editar Bruno Gestor' }).first()).toBeVisible();

  // Campos obrigatórios: erro e nada enviado.
  await page.getByRole('button', { name: /Nova conta/ }).click();
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByText('Informe o nome.')).toBeVisible();
  expect(api.escritasDe('POST', /users/)).toHaveLength(0);

  // O nível de acesso vem primeiro: clicar em um botão logo depois de digitar a senha e antes de salvar perde o clique no Chrome headless (ver relatório).
  await page.getByRole('button', { name: 'Selecionar: Gestor' }).click();
  await page.getByLabel('Nome *', { exact: true }).fill('Fernanda Lopes');
  await page.getByLabel('Email *', { exact: true }).fill('fernanda@exemplo.test');
  await page.getByLabel('Usuário *', { exact: true }).fill('Fernanda.Lopes');
  await page.getByLabel('Senha *', { exact: true }).fill('segredo123');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();

  await expect.poll(() => api.escritasDe('POST', /^\/api\/users$/).length).toBe(1);
  // O usuário é normalizado para minúsculas antes de ir para a API.
  expect(api.escritasDe('POST', /^\/api\/users$/)[0].corpo).toEqual({
    name: 'Fernanda Lopes', email: 'fernanda@exemplo.test', username: 'fernanda.lopes', password: 'segredo123', role: 'gestor',
  });
  await expect(page.getByRole('button', { name: 'Editar Fernanda Lopes' }).first()).toBeVisible();
});

test('RH não vê o item Admin e a rota direta mostra "Acesso restrito" sem buscar usuários', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/');
  await expect(page.getByRole('tab', { name: /^Abrir Dashboard/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Abrir Admin/ })).toHaveCount(0);

  await page.goto('/admin');
  await expect(page.getByText('Acesso restrito')).toBeVisible();
  await expect(page.getByRole('button', { name: /Nova conta/ })).toHaveCount(0);
  // A tela nem chama a API de usuários (seria um 403 à toa).
  expect(api.chamadas.filter((c) => /^GET \/api\/users\?page=/.test(c))).toHaveLength(0);
});

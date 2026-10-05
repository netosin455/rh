// ============================================================
// e2e/base.ts — SuperRH
// `test` com a API simulada já instalada e as proteções do E2E:
//  - requisição externa, endpoint sem simulação ou exceção JS => o teste FALHA ao terminar;
//  - cada teste recebe um estado novo (`api`), então a ordem de execução não importa.
// ============================================================

import { expect, test as base, type Page } from '@playwright/test';
import type { User } from '../tipos/modelos';
import { ApiSimulada, CREDENCIAIS, ORIGEM, USUARIO_RH, USUARIO_SUPER, gerarToken } from './apiSimulada';

export { expect, CREDENCIAIS, USUARIO_RH, USUARIO_SUPER };

type Fixtures = {
  api: ApiSimulada;
};

export const test = base.extend<Fixtures>({
  api: [async ({ context, page }, use) => {
    const api = new ApiSimulada();
    await api.instalar(context);
    page.on('pageerror', (erro) => api.errosJs.push(erro.message));
    // WebSocket para fora também é saída de rede.
    page.on('websocket', (ws) => {
      if (!ws.url().startsWith(ORIGEM.replace('http', 'ws'))) api.externas.push(`WEBSOCKET ${ws.url()}`);
    });

    await use(api);

    const problemas = api.problemas();
    if (problemas.length > 0) throw new Error(`O E2E encontrou problemas:\n- ${problemas.join('\n- ')}`);
  }, { auto: true }],
});

/**
 * Deixa o navegador já logado como RH, uma única vez por aba (sessionStorage), para que um
 * logout dentro do teste não seja desfeito por um reload ou nova navegação.
 */
export async function entrarComo(page: Page, usuario: User): Promise<void> {
  await page.addInitScript(({ token, user }) => {
    if (window.sessionStorage.getItem('__e2e_semeado')) return;
    window.sessionStorage.setItem('__e2e_semeado', '1');
    window.localStorage.setItem('@superrh:token', token);
    window.localStorage.setItem('@superrh:user', JSON.stringify(user));
  }, { token: gerarToken(usuario), user: usuario });
}

export async function entrarComoRh(page: Page): Promise<void> {
  await entrarComo(page, USUARIO_RH);
}

/** A página não pode rolar para o lado (nada vazando da largura da tela). */
export async function semRolagemHorizontal(page: Page): Promise<void> {
  const medidas = await page.evaluate(() => ({ janela: window.innerWidth, doc: document.documentElement.scrollWidth, corpo: document.body.scrollWidth }));
  expect(medidas.doc, `documentElement.scrollWidth (${medidas.doc}) maior que a janela (${medidas.janela})`).toBeLessThanOrEqual(medidas.janela);
  expect(medidas.corpo, `body.scrollWidth (${medidas.corpo}) maior que a janela (${medidas.janela})`).toBeLessThanOrEqual(medidas.janela);
}

/** Login real pela tela (credenciais fictícias da API simulada). Termina com o Dashboard aberto. */
export async function loginPelaTela(page: Page, usuario: string = CREDENCIAIS.usuario, senha: string = CREDENCIAIS.senha): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Usuário', { exact: true }).fill(usuario);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: /^Entrar/ }).click();
}

/** Item da sidebar (web larga) com o nome dado, ex.: "Equipe". */
export function itemDaSidebar(page: Page, titulo: string) {
  return page.getByRole('tab', { name: new RegExp(`^Abrir ${titulo}`) });
}

/** O item ativo da sidebar é o único com fundo de "item ativo" (cores.sidebar.itemAtivo = #272B35). */
export async function itemAtivoDaSidebar(page: Page): Promise<string[]> {
  const itens = await page.getByRole('tab', { name: /^Abrir / }).all();
  const ativos: string[] = [];
  for (const item of itens) {
    const fundo = await item.evaluate((el) => getComputedStyle(el).backgroundColor);
    if (fundo === 'rgb(39, 43, 53)') ativos.push((await item.getAttribute('aria-label')) ?? '');
  }
  return ativos;
}

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

/**
 * Responde às confirmações (window.confirm) do app e guarda o texto de cada uma.
 * `controle.aceitar` decide o clique seguinte (false = Cancelar); troque entre um passo e outro do teste.
 */
export function controlarConfirmacoes(page: Page): { aceitar: boolean; mensagens: string[] } {
  const controle = { aceitar: false, mensagens: [] as string[] };
  page.on('dialog', (dialogo) => {
    controle.mensagens.push(dialogo.message());
    void (controle.aceitar ? dialogo.accept() : dialogo.dismiss());
  });
  return controle;
}

/**
 * Troca window.open por um registro (nada abre de verdade): `urlsAbertas` devolve o que o app tentou abrir.
 * Chame ANTES do page.goto (usa addInitScript).
 */
export async function interceptarWindowOpen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const abertas: string[] = [];
    (window as unknown as { __abertas: string[] }).__abertas = abertas;
    window.open = ((url?: string | URL) => { abertas.push(String(url)); return { opener: null } as unknown as Window; }) as typeof window.open;
  });
}

export async function urlsAbertas(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __abertas?: string[] }).__abertas ?? []);
}

/**
 * Mede quanto tempo (ms) o conteúdo leva para aparecer DEPOIS da ação (um clique). Conta quando existem pelo menos
 * `minimo` elementos VISÍVEIS que casam com o seletor CSS. Usa performance.now() na própria página (sem o ida e volta do
 * Playwright). Chame com a ação que dispara a navegação.
 */
export async function medirAteConteudo(page: Page, acao: () => Promise<void>, seletorCss: string, minimo: number): Promise<number> {
  await page.evaluate(({ sel, min }) => {
    const w = window as unknown as { __medida: Promise<number> };
    w.__medida = new Promise<number>((resolve) => {
      let inicio = -1;
      const verificar = () => {
        // Só conta o que está VISÍVEL: telas anteriores da pilha continuam no DOM, escondidas.
        const visiveis = Array.from(document.querySelectorAll(sel)).filter((el) => el.getClientRects().length > 0).length;
        if (inicio >= 0 && visiveis >= min) { observador.disconnect(); resolve(performance.now() - inicio); }
      };
      const observador = new MutationObserver(verificar);
      observador.observe(document.body, { subtree: true, childList: true, attributes: true });
      document.addEventListener('click', () => { inicio = performance.now(); verificar(); }, { capture: true, once: true });
    });
  }, { sel: seletorCss, min: minimo });
  await acao();
  return page.evaluate(() => (window as unknown as { __medida: Promise<number> }).__medida);
}

/** Código que roda NA página: opacidade efetiva (produto das opacidades dos ancestrais) e se há transform de movimento. */
export const FUNCOES_DE_MOVIMENTO = `
  window.__opacidadeEfetiva = (el) => { let o = 1; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { o *= parseFloat(getComputedStyle(n).opacity); } return o; };
  window.__deslocamento = (el) => { let max = 0; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const t = getComputedStyle(n).transform; if (t && t !== 'none') { const m = new DOMMatrixReadOnly(t); max = Math.max(max, Math.abs(m.m42)); } } return max; };
`;

/**
 * Amostra, a cada quadro (requestAnimationFrame), quando os elementos do seletor ficam visíveis e quando todos
 * chegam a opacidade efetiva 1 e sem deslocamento. O relógio começa no clique (ou no carregamento da página).
 * Chame `iniciarAmostragem` ANTES da ação e `lerAmostragem` depois.
 */
export async function iniciarAmostragem(page: Page, seletor: string, minimo: number, aPartirDoClique: boolean, exigirAnimacao = false): Promise<void> {
  await page.evaluate(({ funcoes, sel, min, doClique, exigir }) => {
    // eslint-disable-next-line no-new-func
    new Function(funcoes)();
    const w = window as unknown as Record<string, unknown> & { __opacidadeEfetiva: (e: Element) => number; __deslocamento: (e: Element) => number };
    const resultado = { visivelMs: -1, opacoMs: -1, quadros: 0, opacidadesDoUltimo: [] as number[] };
    let viuIntermediario = false;
    let inicio = doClique ? -1 : performance.now();
    if (doClique) document.addEventListener('click', () => { inicio = performance.now(); }, { capture: true, once: true });
    const quadro = () => {
      if (inicio >= 0 && resultado.opacoMs < 0) {
        const els = Array.from(document.querySelectorAll(sel)).filter((e) => e.getClientRects().length > 0);
        resultado.quadros += 1;
        if (els.length >= min) {
          const agora = performance.now() - inicio;
          if (resultado.visivelMs < 0) resultado.visivelMs = agora;
          const ultimo = els[els.length - 1];
          resultado.opacidadesDoUltimo.push(Math.round(w.__opacidadeEfetiva(ultimo) * 100) / 100);
          const ultimaOp = resultado.opacidadesDoUltimo[resultado.opacidadesDoUltimo.length - 1];
          if (ultimaOp < 0.99) viuIntermediario = true;
          // No 1º quadro da entrada a animação ainda não começou (tudo opaco): só vale "opaco" depois de ver o movimento (ou 400 ms).
          if (els.every((e) => w.__opacidadeEfetiva(e) >= 0.999 && w.__deslocamento(e) < 0.5) && (!exigir || viuIntermediario || agora - resultado.visivelMs > 400)) resultado.opacoMs = agora;
        }
      }
      if (resultado.opacoMs < 0 && performance.now() - Math.max(inicio, 0) < 5000) requestAnimationFrame(quadro); else (w as Record<string, unknown>).__amostra = resultado;
    };
    requestAnimationFrame(quadro);
    (w as Record<string, unknown>).__amostra = resultado;
  }, { funcoes: FUNCOES_DE_MOVIMENTO, sel: seletor, min: minimo, doClique: aPartirDoClique, exigir: exigirAnimacao });
}

export async function lerAmostragem(page: Page): Promise<{ visivelMs: number; opacoMs: number; quadros: number; opacidadesDoUltimo: number[] }> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __amostra: { opacoMs: number } }).__amostra.opacoMs), { timeout: 6_000 }).toBeGreaterThanOrEqual(0);
  return page.evaluate(() => (window as unknown as { __amostra: { visivelMs: number; opacoMs: number; quadros: number; opacidadesDoUltimo: number[] } }).__amostra);
}

/** Igual a `iniciarAmostragem`, mas liga ANTES da navegação (mede a 1ª carga da página). Chame antes do page.goto. */
export async function amostrarNoCarregamento(page: Page, seletor: string, minimo: number, exigirAnimacao = false): Promise<void> {
  await page.addInitScript(({ funcoes, sel, min, exigir }) => {
    // eslint-disable-next-line no-new-func
    new Function(funcoes)();
    const w = window as unknown as Record<string, unknown> & { __opacidadeEfetiva: (e: Element) => number; __deslocamento: (e: Element) => number };
    const resultado = { visivelMs: -1, opacoMs: -1, quadros: 0, opacidadesDoUltimo: [] as number[] };
    let viuIntermediario = false;
    const inicio = performance.now();
    w.__amostra = resultado;
    const quadro = () => {
      if (resultado.opacoMs < 0) {
        const els = Array.from(document.querySelectorAll(sel)).filter((e) => e.getClientRects().length > 0);
        resultado.quadros += 1;
        if (els.length >= min) {
          const agora = performance.now() - inicio;
          if (resultado.visivelMs < 0) resultado.visivelMs = agora;
          resultado.opacidadesDoUltimo.push(Math.round(w.__opacidadeEfetiva(els[els.length - 1]) * 100) / 100);
          const ultimaOp = resultado.opacidadesDoUltimo[resultado.opacidadesDoUltimo.length - 1];
          if (ultimaOp < 0.99) viuIntermediario = true;
          // No 1º quadro da entrada a animação ainda não começou (tudo opaco): só vale "opaco" depois de ver o movimento (ou 400 ms).
          if (els.every((e) => w.__opacidadeEfetiva(e) >= 0.999 && w.__deslocamento(e) < 0.5) && (!exigir || viuIntermediario || agora - resultado.visivelMs > 400)) resultado.opacoMs = agora;
        }
        if (resultado.opacoMs < 0 && performance.now() - inicio < 8000) requestAnimationFrame(quadro);
      }
    };
    requestAnimationFrame(quadro);
  }, { funcoes: FUNCOES_DE_MOVIMENTO, sel: seletor, min: minimo, exigir: exigirAnimacao });
}

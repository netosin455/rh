// Fluxo (31, projeto "movimento"): entrada animada de lista, clique no 1º frame, revisita sem atraso, troca de aba sem opacidade presa.
// Roda com animações de verdade (reducedMotion: 'no-preference'); o resto da suíte roda com movimento reduzido.

import { amostrarNoCarregamento, entrarComoRh, expect, FUNCOES_DE_MOVIMENTO, iniciarAmostragem, itemDaSidebar, lerAmostragem, test } from './base';

const LANCAR = '[aria-label^="Lançar falta, folga"]';

test.describe('1ª carga (vem do esqueleto)', () => {
  test('a lista da Equipe entra escalonada (≤ 8 px, 30 ms de intervalo) e termina opaca e sem transform', async ({ page, api }, info) => {
    api.atrasar(/^\/api\/employees\?/, 400, 'GET');
    await entrarComoRh(page);
    await amostrarNoCarregamento(page, LANCAR, 5, true);
    await page.goto('/colaboradores');
    const a = await lerAmostragem(page);

    info.annotations.push({ type: 'tempo', description: `Equipe 1ª carga: linhas visíveis→todas opacas em ${Math.round(a.opacoMs - a.visivelMs)} ms (visível em ${Math.round(a.visivelMs)} ms, opaca em ${Math.round(a.opacoMs)} ms)` });
    // Houve animação de verdade (valores intermediários) e ela terminou: opaco e sem deslocamento.
    expect(a.opacidadesDoUltimo.some((o) => o > 0 && o < 0.99), `opacidades do último item: ${a.opacidadesDoUltimo.join(',')}`).toBe(true);
    expect(a.opacoMs - a.visivelMs, 'a entrada da lista passou do esperado').toBeLessThan(600);
    const final = await page.evaluate(({ funcoes, sel }) => {
      // eslint-disable-next-line no-new-func
      new Function(funcoes)();
      const w = window as unknown as { __opacidadeEfetiva: (e: Element) => number; __deslocamento: (e: Element) => number };
      return Array.from(document.querySelectorAll(sel)).map((e) => ({ o: w.__opacidadeEfetiva(e), t: w.__deslocamento(e) }));
    }, { funcoes: FUNCOES_DE_MOVIMENTO, sel: LANCAR });
    expect(final).toHaveLength(5);
    for (const item of final) { expect(item.o).toBeGreaterThanOrEqual(0.999); expect(item.t).toBeLessThan(0.5); }
  });

  test('o item é interativo desde o 1º quadro: nenhum ancestral bloqueia o toque e o clique funciona sem esperar a animação', async ({ page, api }) => {
    api.atrasar(/^\/api\/employees\?/, 400, 'GET');
    await entrarComoRh(page);
    // No 1º quadro em que o último item (o que anima por mais tempo) existe, ele ainda está transparente: nesse
    // instante conferimos o CSS de toque de toda a cadeia de ancestrais (pointer-events/visibility).
    await page.addInitScript(({ funcoes }) => {
      // eslint-disable-next-line no-new-func
      new Function(funcoes)();
      const w = window as unknown as { __opacidadeEfetiva: (e: Element) => number; __primeiroQuadro: { opacidade: number; bloqueios: string[]; liberadoEmMs: number } | null };
      w.__primeiroQuadro = null;
      let primeiro = 0;
      const bloqueiosDe = (el: Element): string[] => {
        const lista: string[] = [];
        // Os valores computados do próprio item já são os efetivos (herdados, com os overrides dos filhos).
        const cs = getComputedStyle(el);
        if (cs.pointerEvents === 'none') lista.push('pointer-events:none');
        if (cs.visibility !== 'visible') lista.push('visibility:' + cs.visibility);
        return lista;
      };
      const quadro = (agora: number) => {
        // Pode haver uma instância oculta da mesma tela (pilha): vale a que está livre.
        const itens = Array.from(document.querySelectorAll('[aria-label="Abrir perfil de Elisa Prado"]')).filter((e) => e.getClientRects().length > 0);
        if (itens.length > 0) {
          if (!primeiro) primeiro = agora;
          const livre = itens.find((e) => bloqueiosDe(e).length === 0);
          if (!w.__primeiroQuadro) w.__primeiroQuadro = { opacidade: w.__opacidadeEfetiva(livre ?? itens[0]), bloqueios: bloqueiosDe(itens[0]), liberadoEmMs: -1 };
          if (livre) { w.__primeiroQuadro.liberadoEmMs = agora - primeiro; return; }
          if (agora - primeiro > 1000) return;
        }
        requestAnimationFrame(quadro);
      };
      requestAnimationFrame(quadro);
    }, { funcoes: FUNCOES_DE_MOVIMENTO });
    await page.goto('/colaboradores');
    // Espera o amostrador concluir (libera o toque ou desiste em 1 s) ANTES de clicar, para não encerrar a página no meio da medição.
    await page.waitForFunction(() => {
      const q = (window as unknown as { __primeiroQuadro: { liberadoEmMs: number } | null }).__primeiroQuadro;
      return q !== null && q.liberadoEmMs >= 0;
    }, undefined, { timeout: 5_000 });
    const q = await page.evaluate(() => (window as unknown as { __primeiroQuadro: { opacidade: number; bloqueios: string[]; liberadoEmMs: number } | null }).__primeiroQuadro);
    // force: o Playwright NÃO espera a animação terminar (nenhum "elemento estável") — clica já.
    await page.getByRole('button', { name: 'Abrir perfil de Elisa Prado' }).click({ force: true, timeout: 2_000 });
    await expect(page).toHaveURL(/\/colaborador\/5$/);
    // A cena da aba só vira "focada" (sem visibility:hidden) no quadro seguinte ao 1º render: tolerado até 100 ms; depois disso o toque tem de estar livre.
    expect(q?.liberadoEmMs ?? -1, 'toque liberado tarde ou nunca').toBeGreaterThanOrEqual(0);
    expect(q?.liberadoEmMs ?? 999, 'toque bloqueado por mais de 100 ms').toBeLessThan(100);
    expect(q?.opacidade ?? 1, 'o item já estava opaco no 1º quadro (a animação não rodou)').toBeLessThan(0.99);
  });
});

test.describe('revisita com cache (nada de atraso de entrada)', () => {
  test('tela de pilha (Pesquisas): completa e visível em < 120 ms, sem escalonar os itens', async ({ page, api }, info) => {
    for (const nome of ['Clima A', 'Clima B', 'Clima C', 'Clima D', 'Clima E']) api.semearPesquisa(nome, 'employees', [{ question: 'x', type: 'scale', required: true }]);
    api.atrasar(/^\/api\/surveys\?/, 500, 'GET');
    await entrarComoRh(page);
    await page.goto('/pesquisas');
    await expect(page.getByRole('button', { name: 'Ver resultados de Clima E' })).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).length), { timeout: 5_000 }).toBe(0);
    await itemDaSidebar(page, 'Dashboard').click();
    await expect(page.getByText('Equipe hoje')).toBeVisible();

    await iniciarAmostragem(page, '[aria-label^="Ver resultados de"]', 5, true, true);
    await itemDaSidebar(page, 'Pesquisas').click();
    const r = await lerAmostragem(page);
    info.annotations.push({ type: 'tempo', description: `Revisita Pesquisas (cache): visível em ${Math.round(r.visivelMs)} ms, totalmente opaca em ${Math.round(r.opacoMs)} ms` });
    expect(r.visivelMs, `visível em ${Math.round(r.visivelMs)} ms`).toBeLessThan(120);
    // Só o fade de 120 ms da tela: sem o escalonamento (que levaria ~340 ms).
    expect(r.opacoMs, `opaca em ${Math.round(r.opacoMs)} ms`).toBeLessThan(260);
  });

  test('tela de aba (Equipe): volta ao foco completa em < 120 ms e opaca logo depois do fade de 120 ms', async ({ page, api }, info) => {
    await entrarComoRh(page);
    await page.goto('/colaboradores');
    await expect(page.locator(LANCAR)).toHaveCount(5);
    await itemDaSidebar(page, 'Dashboard').click();
    await expect(page.getByText('Equipe hoje')).toBeVisible();
    await page.waitForTimeout(400);
    const chamadas = api.contarChamadas('GET', '/api/employees?');

    await iniciarAmostragem(page, LANCAR, 5, true, true);
    await itemDaSidebar(page, 'Equipe').click();
    const r = await lerAmostragem(page);
    info.annotations.push({ type: 'tempo', description: `Revisita Equipe (aba, cache): visível em ${Math.round(r.visivelMs)} ms, opaca em ${Math.round(r.opacoMs)} ms` });
    expect(r.visivelMs).toBeLessThan(120);
    expect(r.opacoMs).toBeLessThan(260);
    expect(api.contarChamadas('GET', '/api/employees?')).toBe(chamadas); // dado fresco: nenhuma chamada
  });
});

test('trocar de aba e voltar rápido nunca deixa a tela com opacidade intermediária presa', async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/');
  await expect(page.getByText('Equipe hoje')).toBeVisible();
  // Troca sem esperar nada entre os cliques.
  for (const alvo of ['Férias', 'Equipe', 'Agenda', 'Dashboard', 'Férias', 'Dashboard']) await itemDaSidebar(page, alvo).click({ noWaitAfter: true });
  await page.waitForTimeout(900);
  const estado = await page.evaluate(({ funcoes }) => {
    // eslint-disable-next-line no-new-func
    new Function(funcoes)();
    const w = window as unknown as { __opacidadeEfetiva: (e: Element) => number; __deslocamento: (e: Element) => number };
    const alvo = Array.from(document.querySelectorAll('div')).find((d) => d.textContent === 'Equipe hoje' && d.getClientRects().length > 0);
    return alvo ? { o: w.__opacidadeEfetiva(alvo), t: w.__deslocamento(alvo) } : null;
  }, { funcoes: FUNCOES_DE_MOVIMENTO });
  expect(estado).not.toBeNull();
  expect(estado?.o).toBeGreaterThanOrEqual(0.999);
  expect(estado?.t ?? 1).toBeLessThan(0.5);
});

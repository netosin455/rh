// Fluxo (33, projeto "movimento"): salto de layout (CLS) e custo (long tasks) nas telas de lista, na 1ª carga e na revisita.
// A mesma medição roda também com movimento reduzido, que é a referência de "sem as animações da F2".

import { entrarComoRh, expect, itemDaSidebar, test } from './base';
import type { Page } from '@playwright/test';

const TELAS: { nome: string; rota: string; menu: string; pronto: (page: Page) => Promise<void> }[] = [
  { nome: 'Equipe', rota: '/colaboradores', menu: 'Equipe', pronto: (p) => expect(p.locator('[aria-label^="Lançar falta, folga"]')).toHaveCount(5) },
  { nome: 'Férias', rota: '/ferias', menu: 'Férias', pronto: (p) => expect(p.getByText('Aguardando aprovação')).toBeVisible() },
  { nome: 'Dashboard', rota: '/', menu: 'Dashboard', pronto: (p) => expect(p.getByText('Equipe hoje')).toBeVisible() },
  { nome: 'Feedbacks', rota: '/feedbacks', menu: 'Feedbacks', pronto: (p) => expect(p.getByText('Conversa de acompanhamento').filter({ visible: true }).first()).toBeVisible() },
];

async function instalarObservadores(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __clsSemInput: number; __longTasks: number; __longTasksMs: number };
    w.__cls = 0; w.__clsSemInput = 0; w.__longTasks = 0; w.__longTasksMs = 0;
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        w.__cls += e.value;
        if (!e.hadRecentInput) w.__clsSemInput += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((lista) => { for (const e of lista.getEntries()) { w.__longTasks += 1; w.__longTasksMs += e.duration; } }).observe({ type: 'longtask', buffered: true });
  });
}

async function ler(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __cls: number; __clsSemInput: number; __longTasks: number; __longTasksMs: number };
    return { cls: w.__cls, clsSemInput: w.__clsSemInput, longTasks: w.__longTasks, longTasksMs: Math.round(w.__longTasksMs) };
  });
}

for (const modo of ['no-preference', 'reduce'] as const) {
  test.describe(modo === 'reduce' ? 'referência: movimento reduzido' : 'com movimento', () => {
    test.use({ reducedMotion: modo });

    for (const tela of TELAS) {
      test(`${tela.nome}: CLS < 0,01 na 1ª carga e na revisita`, async ({ page, api }, info) => {
        api.semearFeedback({ employee_id: 1, title: 'Conversa de acompanhamento', content: 'Texto.', status: 'published' });
        api.atrasar(/^\/api\//, 150, 'GET'); // dá tempo de o esqueleto aparecer, como numa rede de verdade
        await entrarComoRh(page);
        await instalarObservadores(page);
        await page.goto(tela.rota);
        await tela.pronto(page);
        await page.waitForTimeout(900); // deixa a entrada animada terminar
        const primeira = await ler(page);

        // Revisita: sai para outra tela do menu e volta pelo menu (dado em cache).
        await itemDaSidebar(page, tela.menu === 'Dashboard' ? 'Equipe' : 'Dashboard').click();
        await page.waitForTimeout(500);
        await itemDaSidebar(page, tela.menu).click();
        await tela.pronto(page);
        await page.waitForTimeout(900);
        const revisita = await ler(page);

        info.annotations.push({
          type: 'medicao',
          description: `${modo} | ${tela.nome}: CLS 1ª carga ${primeira.clsSemInput.toFixed(4)} (total ${primeira.cls.toFixed(4)}), até a revisita ${revisita.cls.toFixed(4)} | long tasks ${revisita.longTasks} (${revisita.longTasksMs} ms)`,
        });
        // Só a rodada COM movimento é critério; a de movimento reduzido fica como referência (valores nas anotações).
        if (modo === 'no-preference') {
          expect(primeira.clsSemInput, `CLS da 1ª carga de ${tela.nome}`).toBeLessThan(0.01);
          expect(revisita.cls, `CLS acumulado até a revisita de ${tela.nome} (conta inclusive o que ocorreu logo após o clique)`).toBeLessThan(0.01);
        }
      });
    }
  });
}

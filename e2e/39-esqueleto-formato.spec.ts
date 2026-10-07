// Fluxo (39): esqueleto no formato do conteúdo (fluidez F3). Com a API lenta, mede a posição e a altura das peças-chave
// do ESQUELETO e depois as das peças reais: a troca não pode saltar (tolerância de poucos pixels).

import type { Page } from '@playwright/test';
import { entrarComoRh, expect, test } from './base';

interface Retangulo { topo: number; altura: number; esquerda: number; largura: number }

/** Retângulo (visível) do primeiro elemento que casa com o seletor; `pai` sobe N níveis (o botão/rótulo está dentro do cartão). */
async function retangulo(page: Page, seletor: string, pai = 0): Promise<Retangulo> {
  return page.evaluate(({ sel, subir }) => {
    const el = Array.from(document.querySelectorAll(sel)).find((e) => e.getClientRects().length > 0);
    if (!el) throw new Error(`não achei ${sel}`);
    let alvo: Element = el;
    for (let i = 0; i < subir; i++) alvo = alvo.parentElement ?? alvo;
    const r = alvo.getBoundingClientRect();
    return { topo: r.top, altura: r.height, esquerda: r.left, largura: r.width };
  }, { sel: seletor, subir: pai });
}

interface Caso {
  nome: string;
  rota: string;
  atrasar: RegExp;
  /** Esqueleto: seletor da peça. Real: seletor da peça equivalente (+ níveis acima). */
  esqueleto: string;
  real: string;
  realPai?: number;
  semear?: (api: import('./apiSimulada').ApiSimulada) => void;
  /** true = não compara a posição vertical (a tela real pode ter seções condicionais acima, como "Aguardando aprovação"). */
  semTopo?: boolean;
}

const CASOS: Caso[] = [
  { nome: 'Equipe (1ª linha)', rota: '/colaboradores', atrasar: /^\/api\/employees\?/, esqueleto: '[data-testid="esq-linha"]', real: '[aria-label^="Abrir perfil de"]', realPai: 2 },
  { nome: 'Férias (indicadores)', rota: '/ferias', atrasar: /^\/api\/absences\?/, esqueleto: '[data-testid="esq-indicador"]', real: '[aria-label^="Registros"]', realPai: 1, semTopo: true },
  { nome: 'Avisos (1º cartão)', rota: '/avisos', atrasar: /^\/api\/notices/, esqueleto: '[data-testid="esq-cartao-texto"]', real: '[aria-label^="Expandir aviso"], [aria-label^="Recolher aviso"]', realPai: 1 },
  { nome: 'Dashboard (indicadores)', rota: '/', atrasar: /^\/api\/employees\?/, esqueleto: '[data-testid="esq-indicador"]', real: '[aria-label^="Equipe hoje:"]', realPai: 0 },
  {
    nome: 'Pesquisas (1º cartão)', rota: '/pesquisas', atrasar: /^\/api\/surveys\?/, esqueleto: '[data-testid="esq-cartao-texto"]', real: '[aria-label^="Ver resultados de"]', realPai: 1,
    semear: (api) => { api.semearPesquisa('Clima de outubro', 'employees', [{ question: 'Como está?', type: 'scale', required: true }]); },
  },
];

for (const caso of CASOS) {
  test(`${caso.nome}: o esqueleto tem a mesma posição e altura do conteúdo`, async ({ page, api }, info) => {
    caso.semear?.(api);
    api.atrasar(caso.atrasar, 1200, 'GET');
    await entrarComoRh(page);
    await page.goto(caso.rota);
    await expect(page.locator(caso.esqueleto).first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500); // fade de entrada do esqueleto
    const esq = await retangulo(page, caso.esqueleto);

    await expect(page.locator(`${caso.real}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(caso.esqueleto)).toHaveCount(0, { timeout: 5_000 }); // crossfade terminou
    await page.waitForTimeout(300);
    const real = await retangulo(page, caso.real, caso.realPai);

    const dTopo = Math.round(real.topo - esq.topo);
    const dAltura = Math.round(real.altura - esq.altura);
    const dLarg = Math.round(real.largura - esq.largura);
    info.annotations.push({ type: 'medicao', description: `${caso.nome}: topo ${esq.topo.toFixed(0)}→${real.topo.toFixed(0)} (${dTopo >= 0 ? '+' : ''}${dTopo}), altura ${esq.altura.toFixed(0)}→${real.altura.toFixed(0)} (${dAltura >= 0 ? '+' : ''}${dAltura}), largura ${dLarg >= 0 ? '+' : ''}${dLarg}` });
    if (!caso.semTopo) expect(Math.abs(dTopo), `posição vertical: ${dTopo}px`).toBeLessThanOrEqual(12);
    expect(Math.abs(dAltura), `altura: ${dAltura}px`).toBeLessThanOrEqual(14);
    expect(Math.abs(dLarg), `largura: ${dLarg}px`).toBeLessThanOrEqual(24);
  });
}

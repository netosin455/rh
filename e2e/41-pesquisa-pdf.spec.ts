// Fluxo (41): "Baixar PDF" nos resultados da pesquisa. O relatório é a folha HTML impressa (como o Fechamento): capturamos o
// HTML escrito na janela em vez de abrir a impressão. Anônimo: nunca contém contato, token nem id de participação.

import type { Page } from '@playwright/test';
import type { ApiSimulada } from './apiSimulada';
import { entrarComoRh, expect, itemDaSidebar, test } from './base';

/** Intercepta window.open: guarda o HTML escrito na folha em vez de imprimir. */
async function capturarFolha(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __html: string };
    w.__html = '';
    window.open = (() => ({ document: { write: (h: string) => { w.__html = h; }, close: () => undefined }, focus: () => undefined, print: () => undefined })) as unknown as typeof window.open;
  });
}

const lerFolha = (page: Page) => page.evaluate(() => (window as unknown as { __html?: string }).__html ?? '');

const TEXTOS = ['Gosto muito da equipe.', 'Linha 1\nLinha 2 com <b>negrito</b> e <script>alert(1)</script>', 'Faltam recursos no setor.', 'Tudo bem, obrigado!'];

function semearPesquisaCompleta(api: ApiSimulada) {
  const s = api.semearPesquisa('Pesquisa de Pulso - Outubro 2026', 'employees', [
    { question: 'Como você avalia o clima?', type: 'scale', required: true },
    { question: 'Qual benefício é mais importante?', type: 'choice', options: ['Vale-refeição', 'Plano de saúde'], required: true },
    { question: 'Você recomendaria a empresa?', type: 'nps', required: true },
    { question: 'Algo a acrescentar?', type: 'text', required: false },
  ]);
  const [escala, escolha, nps, aberta] = (s.questions ?? []).map((q) => q.id);
  const notas = [5, 5, 4, 3, 5, 2];
  const opcoes = ['Vale-refeição', 'Vale-refeição', 'Plano de saúde', 'Vale-refeição', 'Plano de saúde', 'Vale-refeição'];
  const promocao = [10, 9, 8, 3, 10, 10];
  notas.forEach((n, i) => {
    const respostas = [{ question_id: escala, score: n }, { question_id: escolha, choice: opcoes[i] }, { question_id: nps, score: promocao[i] }];
    if (i < TEXTOS.length) respostas.push({ question_id: aberta, text: TEXTOS[i] } as never);
    api.semearResposta(s.id, respostas);
  });
  return s;
}

test('pesquisa de colaboradores: o PDF traz título, participação com %, barras certas e TODAS as respostas abertas', async ({ page, api }) => {
  const s = semearPesquisaCompleta(api);
  await entrarComoRh(page);
  await page.goto('/');
  await expect(page.getByText('Equipe hoje')).toBeVisible({ timeout: 10_000 });
  // Navegando pelo app o cache de colaboradores já existe: o relatório pode mostrar "X de N ativos".
  await itemDaSidebar(page, 'Equipe').click();
  await expect(page.locator('[aria-label^="Lançar falta, folga"]')).toHaveCount(5);
  const ativos = api.employees.filter((e) => e.status === 'ativo').length;
  await itemDaSidebar(page, 'Pesquisas').click();
  await page.getByRole('button', { name: `Ver resultados de ${s.title}`, exact: true }).first().click();
  await expect(page.getByText('Como você avalia o clima?')).toBeVisible({ timeout: 10_000 });
  await capturarFolha(page);
  await page.getByRole('button', { name: 'Baixar PDF' }).click();
  await expect.poll(() => lerFolha(page)).toContain('Pesquisa de Pulso - Outubro 2026');
  const html = await lerFolha(page);

  // Cabeçalho e participação
  expect(html).toContain('Colaboradores');
  expect(html).toContain('Sem data de encerramento');
  expect(html).toContain(`<strong>6</strong> de <strong>${ativos}</strong> colaboradores ativos (${Math.round((6 / ativos) * 100)}%)`);
  expect(html).toContain('<title>pesquisa-de-pulso-outubro-2026-');
  // Escala: média 4,0 e barras (3 de 6 = 50%)
  expect(html).toContain('<strong>4,0</strong>');
  expect(html).toContain('5 — Ótimo');
  expect(html).toContain('3 · 50%');
  // Escolha: 4 de 6 = 67% e 2 de 6 = 33%
  expect(html).toContain('Vale-refeição');
  expect(html).toContain('4 · 67%');
  expect(html).toContain('2 · 33%');
  // NPS: +50 (4 promotores, 1 neutro, 1 detrator) e aviso de poucas respostas
  expect(html).toContain('+50');
  expect(html).toContain('Poucas respostas (6)');
  // Aberta: TODAS as respostas, com quebra de linha preservada e HTML escapado
  expect(html.match(/class="resposta"/g)).toHaveLength(TEXTOS.length);
  expect(html).toContain('Gosto muito da equipe.');
  expect(html).toContain('Linha 1\nLinha 2 com &lt;b&gt;negrito&lt;/b&gt; e &lt;script&gt;alert(1)&lt;/script&gt;');
  expect(html).not.toContain('<script>alert(1)</script>');
  expect(html).toContain('Faltam recursos no setor.');
  expect(html).toContain('Tudo bem, obrigado!');
  // Rodapé e ordem das perguntas
  expect(html).toContain('Respostas anônimas');
  expect(html.indexOf('1. Como você avalia o clima?')).toBeLessThan(html.indexOf('2. Qual benefício'));
  expect(html.indexOf('3. Você recomendaria')).toBeLessThan(html.indexOf('4. Algo a acrescentar?'));
});

test('sem a lista de colaboradores em cache o PDF mostra só o total, sem inventar porcentagem', async ({ page, api }) => {
  const s = semearPesquisaCompleta(api);
  api.atrasar(/^\/api\/employees\?/, 8_000, 'GET'); // a lista de ativos não chega a tempo
  await entrarComoRh(page);
  await page.goto(`/pesquisas/${s.id}`);
  await expect(page.getByText('Como você avalia o clima?')).toBeVisible({ timeout: 10_000 });
  await capturarFolha(page);
  await page.getByRole('button', { name: 'Baixar PDF' }).click();
  await expect.poll(() => lerFolha(page)).toContain('Respostas anônimas');
  const html = await lerFolha(page);
  expect(html).toContain('<strong>6</strong> participações');
  expect(html).not.toContain('colaboradores ativos');
  expect(html).not.toMatch(/\d+%\)/);
});

test('campanha de NPS com contato: o PDF não vaza nome, telefone, e-mail nem a seção "Retornar contato"', async ({ page, api }) => {
  const s = api.semearPesquisa('Satisfação do cliente', 'customers', [{ question: 'De 0 a 10, quanto recomendaria?', type: 'nps', required: true }, { question: 'Comentário', type: 'text', required: false }]);
  const [nps, aberta] = (s.questions ?? []).map((q) => q.id);
  api.semearResposta(s.id, [{ question_id: nps, score: 3 }, { question_id: aberta, text: 'Demorou para atender.' }]);
  api.semearResposta(s.id, [{ question_id: nps, score: 10 }]);
  api.semearContato(s.id, { name: 'Cliente Sigiloso', phone: '11 97777-6666', email: 'sigiloso@cliente.test', score: 3, comment: 'Peço retorno urgente' });
  await entrarComoRh(page);
  await page.goto(`/nps/${s.id}`);
  // A tela mostra o contato (é a área de retorno do RH)...
  await expect(page.getByText('Cliente Sigiloso')).toBeVisible({ timeout: 10_000 });
  await capturarFolha(page);
  await page.getByRole('button', { name: 'Baixar PDF' }).click();
  await expect.poll(() => lerFolha(page)).toContain('Satisfação do cliente');
  const html = await lerFolha(page);
  // ...mas o relatório não.
  for (const proibido of ['Cliente Sigiloso', '97777-6666', 'sigiloso@cliente.test', 'Peço retorno urgente', 'Retornar contato', 'contato']) expect(html, `vazou: ${proibido}`).not.toContain(proibido);
  expect(html).toContain('Clientes');
  expect(html).toContain('Demorou para atender.');
  expect(html).toContain('Respostas anônimas');
});

test('o botão Baixar PDF fica ao lado de Editar e Duplicar, com nome acessível', async ({ page, api }) => {
  const s = semearPesquisaCompleta(api);
  await entrarComoRh(page);
  await page.goto(`/pesquisas/${s.id}`);
  await expect(page.getByRole('button', { name: 'Editar pesquisa' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Baixar PDF do relatório da pesquisa/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Duplicar pesquisa' })).toBeVisible();
});

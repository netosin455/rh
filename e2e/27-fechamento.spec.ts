// Fluxo (27): Fechamento do mês — seletor de mês, tabela e totais, aviso do saldo, CSV, erro com retry e permissão.

import { readFile } from 'node:fs/promises';
import { entrarComo, entrarComoRh, expect, test, USUARIO_SUPER } from './base';
import { hojeIso, type ApiSimulada } from './apiSimulada';

const ROTULOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const rotulo = (mes: string) => { const [a, m] = mes.split('-').map(Number); return `${ROTULOS[m - 1].charAt(0).toUpperCase()}${ROTULOS[m - 1].slice(1)} de ${a}`; };
const soma = (mes: string, delta: number) => { const [a, m] = mes.split('-').map(Number); const i = a * 12 + m - 1 + delta; return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`; };

const MES = hojeIso().slice(0, 7);
const ANTERIOR = soma(MES, -1);

/** Ana: 2 faltas de dia inteiro + 4,5h de falta + 4h de folga; Bruno: 10 dias de férias; Carla: 3 dias de licença. */
function semearMesAnterior(api: ApiSimulada) {
  api.absences = [];
  api.employees[0].name = 'Ana "Zé"; Souza'; // nome com aspas e ponto e vírgula: o CSV precisa escapar
  api.employees[0].folga_hours = 10;
  api.semearAusencia({ employee_id: 1, type: 'falta', start_date: `${ANTERIOR}-05`, end_date: `${ANTERIOR}-06` });
  api.semearAusencia({ employee_id: 1, type: 'falta', start_date: `${ANTERIOR}-12`, hours: 4.5 });
  api.semearAusencia({ employee_id: 1, type: 'folga', start_date: `${ANTERIOR}-15`, hours: 4 });
  api.semearAusencia({ employee_id: 2, type: 'ferias', start_date: `${ANTERIOR}-10`, end_date: `${ANTERIOR}-19` });
  api.semearAusencia({ employee_id: 3, type: 'licenca_medica', start_date: `${ANTERIOR}-20`, end_date: `${ANTERIOR}-22` });
}

test('começa no mês atual, muda de mês pelas setas e a chamada leva o month certo', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/fechamento');
  await expect(page.getByRole('heading', { name: rotulo(MES) })).toBeVisible();
  await expect.poll(() => api.chamadas.includes(`GET /api/analytics?view=fechamento&month=${MES}`)).toBe(true);

  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await expect(page.getByRole('heading', { name: rotulo(ANTERIOR) })).toBeVisible();
  await expect.poll(() => api.chamadas.includes(`GET /api/analytics?view=fechamento&month=${ANTERIOR}`)).toBe(true);

  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await expect(page.getByRole('heading', { name: rotulo(soma(MES, 1)) })).toBeVisible();
  await expect.poll(() => api.chamadas.includes(`GET /api/analytics?view=fechamento&month=${soma(MES, 1)}`)).toBe(true);
});

test('tabela por colaborador, zeros como "-", linha TOTAL e aviso do saldo atual', async ({ page, api }) => {
  semearMesAnterior(api);
  await entrarComoRh(page);
  await page.goto('/fechamento');
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await expect(page.getByRole('heading', { name: rotulo(ANTERIOR) })).toBeVisible();

  await expect(page.getByText('O saldo do banco de horas é o saldo ATUAL, não o de fim do mês.')).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveText(['Colaborador', 'Departamento', 'Faltas (dias)', 'Faltas (h)', 'Folgas (h)', 'Férias (dias)', 'Licenças (dias)', 'Saldo do banco (h)']);

  const ana = page.getByRole('row').filter({ hasText: 'Ana "Zé"; Souza' });
  await expect(ana.getByRole('cell')).toHaveText(['Ana "Zé"; Souza', 'Jurídico', '2', '4,5', '4', '-', '-', '10']);
  const bruno = page.getByRole('row').filter({ hasText: 'Bruno Lima' });
  await expect(bruno.getByRole('cell')).toHaveText(['Bruno Lima', 'Jurídico', '-', '-', '-', '10', '-', '8']);
  // Saldos: Ana 10 + Bruno 8 + Carla 8 + Diego 8 + Elisa 8 = 42
  const total = page.getByRole('row').filter({ hasText: 'TOTAL' });
  await expect(total.getByRole('cell')).toHaveText([' ', '2', '4,5', '4', '10', '3', '42']);
  await expect(total.getByRole('rowheader')).toHaveText('TOTAL');

  // O filtro por nome (sem acento) reduz as linhas e o TOTAL acompanha.
  await page.getByLabel('Buscar colaborador').fill('bruno');
  await expect(page.getByRole('row').filter({ hasText: 'Ana' })).toHaveCount(0);
  await expect(total.getByRole('cell')).toHaveText([' ', '-', '-', '-', '10', '-', '8']);
});

test('Baixar CSV: arquivo fechamento-AAAA-MM.csv com BOM, ponto e vírgula e vírgula decimal', async ({ page, api }) => {
  semearMesAnterior(api);
  await entrarComoRh(page);
  await page.goto('/fechamento');
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Bruno Lima' })).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar CSV' }).click()]);
  expect(download.suggestedFilename()).toBe(`fechamento-${ANTERIOR}.csv`);
  const bytes = await readFile(await download.path());
  // BOM UTF-8 nos três primeiros bytes (o Excel brasileiro reconhece os acentos).
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const linhas = bytes.toString('utf8').slice(1).split('\r\n');
  expect(linhas[0]).toBe(`Fechamento de ${rotulo(ANTERIOR)}`);
  expect(linhas[1]).toBe('Colaborador;Departamento;Faltas (dias);Faltas (horas);Folgas (horas);Férias (dias);Licenças (dias);Saldo do banco (horas)');
  expect(linhas[2]).toBe('"Ana ""Zé""; Souza";Jurídico;2;4,5;4;0;0;10');
  expect(linhas[3]).toBe('Bruno Lima;Jurídico;0;0;0;10;0;8');
  expect(linhas[4]).toBe('Carla Dias;Jurídico;0;0;0;0;3;8');
  expect(linhas[linhas.length - 3]).toBe('TOTAL;;2;4,5;4;10;3;42');
  expect(linhas[linhas.length - 2]).toBe('O saldo do banco de horas é o saldo ATUAL, não o de fim do mês.');
});

test('Imprimir / PDF abre a folha limpa só com a tabela', async ({ page, api, context }) => {
  semearMesAnterior(api);
  await entrarComoRh(page);
  await page.goto('/fechamento');
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Bruno Lima' })).toBeVisible();
  // window.open("") da folha: capturamos o HTML escrito nela em vez de abrir a impressão.
  await page.evaluate(() => {
    const w = window as unknown as { __html: string };
    window.open = (() => ({ document: { write: (h: string) => { w.__html = h; }, close: () => undefined }, focus: () => undefined, print: () => undefined })) as unknown as typeof window.open;
  });
  await page.getByRole('button', { name: 'Imprimir / PDF' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __html?: string }).__html ?? '')).toContain('Fechamento de');
  const html = await page.evaluate(() => (window as unknown as { __html: string }).__html);
  expect(html).toContain('Bruno Lima');
  expect(html).toContain('TOTAL');
  expect(html).toContain('O saldo do banco de horas é o saldo ATUAL, não o de fim do mês.');
  // Nome com aspas é escapado (não vira HTML solto).
  expect(html).toContain('Ana &quot;Zé&quot;; Souza');
  void context;
});

test('erro da API mostra "Tentar de novo" e a segunda tentativa carrega', async ({ page, api }) => {
  api.falhasDoFechamento = 1;
  await entrarComoRh(page);
  await page.goto('/fechamento');
  await expect(page.getByText(`Não foi possível carregar o fechamento de ${rotulo(MES)}.`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baixar CSV' })).toBeDisabled();

  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'TOTAL' })).toBeVisible();
  await expect(page.getByText(/Não foi possível carregar o fechamento/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Baixar CSV' })).toBeEnabled();
});

test('sem colaboradores o estado vazio aparece e os botões ficam desabilitados', async ({ page, api }) => {
  api.employees = [];
  await entrarComoRh(page);
  await page.goto('/fechamento');
  await expect(page.getByText('Sem colaboradores neste mês')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Imprimir / PDF' })).toBeDisabled();
});

test('super_admin abre o Fechamento pelo item do menu', async ({ page }) => {
  await entrarComo(page, USUARIO_SUPER);
  await page.goto('/');
  await page.getByRole('tab', { name: /^Abrir Fechamento/ }).click();
  await expect(page).toHaveURL(/\/fechamento$/);
  await expect(page.getByRole('heading', { name: rotulo(MES) })).toBeVisible();
});

test('papel sem permissão não vê o item e a rota mostra "Acesso restrito"', async ({ page, api }) => {
  await entrarComo(page, { ...USUARIO_SUPER, role: 'gestor', name: 'Gestor Teste' });
  await page.goto('/fechamento');
  await expect(page.getByText('Acesso restrito')).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Abrir Fechamento/ })).toHaveCount(0);
  expect(api.chamadas.filter((c) => c.includes('view=fechamento'))).toHaveLength(0);
});

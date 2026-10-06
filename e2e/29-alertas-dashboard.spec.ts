// Fluxo (29): alertas novos no Dashboard — experiência acabando, banco de horas alto, faltas recentes.

import { entrarComoRh, expect, test } from './base';
import type { ApiSimulada } from './apiSimulada';

function semearAlertas(api: ApiSimulada) {
  api.alertas = [
    { type: 'experiencia_acabando', severity: 'media', title: 'Experiência acaba em 7 dias', description: 'Carla Dias completa 90 dias de empresa.', route: 'colaborador/3', icon: 'hourglass-outline' },
    { type: 'banco_horas_alto', severity: 'media', title: 'Banco de horas alto', description: '2 pessoas acima de 40h.', route: 'colaboradores', icon: 'time-outline' },
    { type: 'faltas_recentes', severity: 'alta', title: '3 faltas nos últimos 7 dias', description: 'Bruno Lima precisa de atenção.', route: 'colaborador/2', icon: 'alert-circle-outline' },
  ];
}

test.beforeEach(async ({ page }) => {
  await entrarComoRh(page);
});

test('os 3 alertas novos aparecem em "Precisa de atenção"; a gravidade alta vem primeiro', async ({ page, api }) => {
  semearAlertas(api);
  await page.goto('/');
  const itens = page.getByRole('button', { name: /^(Experiência acaba|Banco de horas alto|3 faltas nos últimos)/ });
  await expect(itens).toHaveCount(3);
  // Urgente (alta) antes dos importantes.
  await expect(itens.first()).toHaveAccessibleName(/^3 faltas nos últimos 7 dias\. Bruno Lima precisa de atenção\./);
  await expect(page.getByRole('button', { name: /^Experiência acaba em 7 dias\. Carla Dias/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Banco de horas alto\. 2 pessoas/ })).toBeVisible();
});

test('clicar em cada alerta leva à rota que a API mandou', async ({ page, api }) => {
  semearAlertas(api);
  const casos: { nome: RegExp; url: RegExp }[] = [
    { nome: /^Experiência acaba em 7 dias/, url: /\/colaborador\/3$/ },
    { nome: /^Banco de horas alto/, url: /\/colaboradores$/ },
    { nome: /^3 faltas nos últimos/, url: /\/colaborador\/2$/ },
  ];
  for (const caso of casos) {
    await page.goto('/');
    await page.getByRole('button', { name: caso.nome }).click();
    await expect(page).toHaveURL(caso.url);
  }
});

test('o alerta de risco de saída continua indo para a lista de risco alto', async ({ page, api }) => {
  api.alertas = [{ type: 'turnover_risk', severity: 'alta', title: '1 colaborador com risco alto de saída', description: 'Ver quem é.', route: 'analytics', icon: 'trending-down-outline' }];
  await page.goto('/');
  await page.getByRole('button', { name: /^1 colaborador com risco alto de saída/ }).click();
  await expect(page).toHaveURL(/\/analytics\?risco=alto$/);
});

test('tipo desconhecido, ícone inválido e rota vazia nunca quebram a tela', async ({ page, api }) => {
  api.alertas = [
    { type: 'tipo_do_futuro' as never, severity: 'urgente-demais' as never, title: 'Alerta do futuro', description: 'Sem rota e com ícone que não existe.', route: '', icon: 'icone-que-nao-existe' },
    { type: 'faltas_recentes', severity: 'media', title: 'Sem ícone nem descrição', description: undefined as never, route: 'colaboradores', icon: '' },
  ];
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Alerta do futuro/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Sem ícone nem descrição/ })).toBeVisible();
  // Sem rota: cai nas notificações.
  await page.getByRole('button', { name: /^Alerta do futuro/ }).click();
  await expect(page).toHaveURL(/\/notificacoes$/);
});

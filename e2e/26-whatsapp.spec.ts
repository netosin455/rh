// Fluxo (26): Enviar no WhatsApp — URL aberta com a mensagem certa; telefone do colaborador só no feedback;
// nada do conteúdo do feedback vaza. window.open é interceptado: nenhuma aba abre de verdade.

import { entrarComoRh, expect, interceptarWindowOpen, test, urlsAbertas } from './base';
import { ORIGEM } from './apiSimulada';

const texto = (url: string) => decodeURIComponent(url.split('?text=')[1] ?? '');

test.beforeEach(async ({ page }) => {
  await interceptarWindowOpen(page);
  await entrarComoRh(page);
});

test('pesquisa de colaboradores: wa.me sem número com a mensagem de pesquisa', async ({ page, api }) => {
  const s = api.semearPesquisa('Clima de outubro', 'employees', [{ question: 'Como está?', type: 'scale', required: true }]);
  await page.goto('/pesquisas');
  await page.getByRole('button', { name: 'Enviar no WhatsApp: Clima de outubro' }).click();

  const link = `${ORIGEM}/responder/${s.id}`;
  expect(await urlsAbertas(page)).toEqual([`https://wa.me/?text=${encodeURIComponent(`Olá! Sua opinião é importante. Responda nossa pesquisa (leva 1 minuto): ${link}`)}`]);
});

test('campanha NPS: lista, resultados e QR code usam a mensagem de cliente', async ({ page, api }) => {
  const s = api.semearPesquisa('Satisfação do cliente', 'customers', [{ question: 'Nota?', type: 'nps', required: true }]);
  const esperado = `https://wa.me/?text=${encodeURIComponent(`Olá! Como foi seu atendimento conosco? Avalie em 1 minuto: ${ORIGEM}/responder/${s.id}`)}`;

  await page.goto('/nps');
  await page.getByRole('button', { name: 'Enviar no WhatsApp: Satisfação do cliente' }).click();
  expect(await urlsAbertas(page)).toEqual([esperado]);

  // Cada navegação zera o registro: confere cada tela logo depois do clique.
  await page.goto(`/nps/${s.id}`);
  await page.getByRole('button', { name: 'Enviar no WhatsApp', exact: true }).click();
  expect(await urlsAbertas(page)).toEqual([esperado]);

  await page.getByRole('button', { name: 'Mostrar QR code da campanha' }).click();
  await page.getByRole('button', { name: 'Enviar no WhatsApp', exact: true }).last().click();
  expect(await urlsAbertas(page)).toEqual([esperado, esperado]);
});

test('feedback: usa o telefone do colaborador e NÃO vaza título nem conteúdo', async ({ page, api }) => {
  const f = api.semearFeedback({ employee_id: 1, title: 'TITULO-SECRETO', content: 'CONTEUDO-SECRETO sobre desempenho', status: 'published', note: 'NOTA-SECRETA' });
  await page.goto(`/feedbacks/${f.id}`);
  await expect(page.getByText('WhatsApp do colaborador: (11) 98888-7777')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar no WhatsApp', exact: true }).click();

  const [url] = await urlsAbertas(page);
  const link = `${ORIGEM}/feedback/${f.public_token}`;
  expect(url).toBe(`https://wa.me/5511988887777?text=${encodeURIComponent(`Olá, Ana. Há um feedback para você: ${link}`)}`);
  for (const proibido of ['SECRETO', 'SECRETA', 'desempenho', 'Souza', 'Advogada']) expect(texto(url)).not.toContain(proibido);
});

test('feedback: sem telefone ou com telefone inválido cai no wa.me sem número', async ({ page, api }) => {
  api.employees[2].phone = '123'; // Carla: telefone inválido
  const semTelefone = api.semearFeedback({ employee_id: 2, title: 'A', content: 'x', status: 'published' }); // Bruno: sem telefone
  const invalido = api.semearFeedback({ employee_id: 3, title: 'B', content: 'y', status: 'published' });

  await page.goto(`/feedbacks/${semTelefone.id}`);
  await expect(page.getByText(`${ORIGEM}/feedback/${semTelefone.public_token}`)).toBeVisible();
  await expect.poll(() => api.chamadas.includes('GET /api/employees/2')).toBe(true);
  await page.getByRole('button', { name: 'Enviar no WhatsApp', exact: true }).click();
  expect((await urlsAbertas(page))[0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
  expect(texto((await urlsAbertas(page))[0])).toContain('Olá, Bruno.');

  await page.goto(`/feedbacks/${invalido.id}`);
  await expect(page.getByText(`${ORIGEM}/feedback/${invalido.public_token}`)).toBeVisible();
  await expect.poll(() => api.chamadas.filter((c) => c === 'GET /api/employees/3').length).toBe(1);
  await expect(page.getByText(/WhatsApp do colaborador/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Enviar no WhatsApp', exact: true }).click();
  expect((await urlsAbertas(page))[0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
});

test('lista de feedbacks também tem o botão (sem número, só nome e link)', async ({ page, api }) => {
  const f = api.semearFeedback({ employee_id: 1, title: 'Conversa', content: 'CONTEUDO-SECRETO', status: 'published' });
  await page.goto('/feedbacks');
  await page.getByRole('button', { name: 'Enviar no WhatsApp: Conversa' }).click();
  const [url] = await urlsAbertas(page);
  expect(url).toBe(`https://wa.me/?text=${encodeURIComponent(`Olá, Ana. Há um feedback para você: ${ORIGEM}/feedback/${f.public_token}`)}`);
  expect(texto(url)).not.toContain('SECRETO');
});

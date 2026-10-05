// Fluxo (22): duplicar, encerrar agora e excluir pesquisa (com a contagem de respostas no aviso).

import { controlarConfirmacoes, entrarComoRh, expect, test } from './base';
import { hojeIso, type ApiSimulada } from './apiSimulada';

function semearClima(api: ApiSimulada, respostas = 0) {
  const s = api.semearPesquisa('Clima de outubro', 'employees', [
    { question: 'Como está o clima?', type: 'scale', required: true },
    { question: 'Onde prefere trabalhar?', type: 'choice', options: ['Remoto', 'Presencial'], required: false },
  ]);
  s.response_count = respostas;
  return s;
}

test.beforeEach(async ({ page }) => {
  await entrarComoRh(page);
});

test('duplicar cria uma cópia "Cópia de ..." sem ids e abre o editor dela', async ({ page, api }) => {
  const s = semearClima(api, 12);
  await page.goto('/pesquisas');
  await page.getByRole('button', { name: 'Duplicar Clima de outubro' }).click();

  await expect.poll(() => api.escritasDe('POST', /^\/api\/surveys$/).length).toBe(1);
  expect(api.escritasDe('POST', /^\/api\/surveys$/)[0].corpo).toEqual({
    title: 'Cópia de Clima de outubro',
    expires_at: null,
    questions: [
      { question: 'Como está o clima?', type: 'scale', required: true },
      { question: 'Onde prefere trabalhar?', type: 'choice', options: ['Remoto', 'Presencial'], required: false },
    ],
  });
  // A cópia é nova (sem respostas): o editor abre livre, sem banner de bloqueio.
  await expect(page).toHaveURL(new RegExp(`/pesquisas/editar/${s.id + 1}$`));
  await expect(page.getByLabel('Título da pesquisa')).toHaveValue('Cópia de Clima de outubro');
  await expect(page.getByText(/já tem .* respostas?/)).toHaveCount(0);
});

test('encerrar agora pede confirmação e envia PUT {expires_at: hoje}', async ({ page, api }) => {
  const s = semearClima(api);
  const confirmacoes = controlarConfirmacoes(page);
  await page.goto('/pesquisas');
  const encerrar = page.getByRole('button', { name: 'Encerrar agora Clima de outubro' });

  await encerrar.click(); // cancelar
  expect(api.escritasDe('PUT', /surveys/)).toHaveLength(0);
  expect(confirmacoes.mensagens[0]).toContain('Clima de outubro');

  confirmacoes.aceitar = true;
  await encerrar.click();
  await expect.poll(() => api.escritasDe('PUT', /^\/api\/surveys\/1$/).length).toBe(1);
  expect(api.escritasDe('PUT', /^\/api\/surveys\/1$/)[0].corpo).toEqual({ expires_at: hojeIso() });
  expect(s.expires_at).toBe(hojeIso());
  // Já encerrada: o botão some e o cartão mostra "Encerrada".
  await expect(page.getByRole('button', { name: 'Encerrar agora Clima de outubro' })).toHaveCount(0);
  await expect(page.getByText('Encerrada')).toBeVisible();
});

test('excluir avisa a consequência com a contagem; cancelar não apaga', async ({ page, api }) => {
  semearClima(api, 21);
  const confirmacoes = controlarConfirmacoes(page);
  await page.goto('/pesquisas');
  const excluir = page.getByRole('button', { name: 'Excluir Clima de outubro' });

  await excluir.click();
  expect(confirmacoes.mensagens[0]).toBe('Excluir "Clima de outubro"?\n\nIsso apaga a pesquisa e as 21 respostas. Não dá para desfazer.');
  expect(api.escritasDe('DELETE', /surveys/)).toHaveLength(0);

  confirmacoes.aceitar = true;
  await excluir.click();
  await expect.poll(() => api.escritasDe('DELETE', /^\/api\/surveys\/1$/).length).toBe(1);
  await expect(page.getByText('Nenhuma pesquisa criada')).toBeVisible();
});

test('campanha NPS: o aviso de exclusão fala em "campanha" e usa o singular', async ({ page, api }) => {
  const s = api.semearPesquisa('Satisfação', 'customers', [{ question: 'Nota?', type: 'nps', required: true }]);
  s.response_count = 1;
  const confirmacoes = controlarConfirmacoes(page);
  await page.goto('/nps');
  await page.getByRole('button', { name: 'Excluir Satisfação' }).click();
  expect(confirmacoes.mensagens[0]).toBe('Excluir "Satisfação"?\n\nIsso apaga a campanha e a resposta. Não dá para desfazer.');
});

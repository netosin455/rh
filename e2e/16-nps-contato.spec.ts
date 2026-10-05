// Fluxo (16): NPS parte 2 — Retornar contato, resposta com consentimento (LGPD) e QR code.

import { entrarComoRh, expect, test } from './base';
import { ORIGEM, type ApiSimulada } from './apiSimulada';
import type { Page } from '@playwright/test';

/** Campanha no formato do modelo "Satisfação do cliente": NPS obrigatório e 3 perguntas opcionais. */
function semearCampanha(api: ApiSimulada) {
  return api.semearPesquisa('Satisfação do cliente', 'customers', [
    { question: 'De 0 a 10, quanto você recomendaria nosso escritório?', type: 'nps', required: true },
    { question: 'Qual o principal motivo da sua nota?', type: 'text', required: false },
    { question: 'Como você avalia o atendimento?', type: 'scale', required: false },
    { question: 'Como você avalia a clareza das informações?', type: 'scale', required: false },
  ]);
}

/** Responde nota 3 e vai até o último passo (contato). */
async function ateOPassoDeContato(page: Page, id: number): Promise<void> {
  await page.goto(`/responder/${id}`);
  await page.getByRole('radio', { name: 'Nota 3', exact: true }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Próxima pergunta' }).click();
  await expect(page.getByText('Último passo').first()).toBeVisible();
}

const CONSENTIMENTO = 'Sim, aceito ser contatado sobre esta avaliação';

test('Retornar contato: detrator aparece, marcar como contatado e apagar contato (com confirmação)', async ({ page, api }) => {
  const campanha = semearCampanha(api);
  const joao = api.semearContato(campanha.id, { name: 'João Pereira', phone: '(11) 98888-7777', score: 3, comment: 'Demora no retorno' });
  api.semearContato(campanha.id, { name: 'Maria Souza', email: 'maria@exemplo.test', score: 10 });
  await entrarComoRh(page);
  await page.goto(`/nps/${campanha.id}`);

  await expect(page.getByText('Retornar contato', { exact: true })).toBeVisible();
  const cartaoJoao = page.getByLabel('Contato de João Pereira', { exact: true });
  await expect(cartaoJoao).toContainText('Telefone: (11) 98888-7777');
  await expect(cartaoJoao).toContainText('Demora no retorno');
  // Quem deu nota alta fica em "Outros clientes que pediram contato".
  await expect(page.getByText('Outros clientes que pediram contato')).toBeVisible();
  await expect(page.getByLabel('Contato de Maria Souza', { exact: true })).toContainText('E-mail: maria@exemplo.test');

  await page.getByRole('button', { name: 'Marcar João Pereira como contatado' }).click();
  await expect.poll(() => api.escritasDe('PATCH', /\?contact=/).length).toBe(1);
  const marcar = api.escritasDe('PATCH', /\?contact=/)[0];
  expect(marcar.caminho).toBe(`/api/surveys/${campanha.id}?contact=${joao.submission_id}`);
  expect(marcar.corpo).toEqual({ contacted: true });
  await expect(cartaoJoao.getByLabel('Já contatado')).toBeVisible();

  // Apagar: cancelar não apaga; confirmar apaga só os dados de contato.
  page.once('dialog', (d) => { void d.dismiss(); });
  await page.getByRole('button', { name: 'Apagar o contato de João Pereira' }).click();
  expect(api.escritasDe('DELETE', /\?contact=/)).toHaveLength(0);
  await expect(cartaoJoao).toBeVisible();

  page.once('dialog', (d) => { expect(d.message()).toContain('Apagar nome, telefone e e-mail'); void d.accept(); });
  await page.getByRole('button', { name: 'Apagar o contato de João Pereira' }).click();
  await expect.poll(() => api.escritasDe('DELETE', /\?contact=/).length).toBe(1);
  expect(api.escritasDe('DELETE', /\?contact=/)[0].caminho).toBe(`/api/surveys/${campanha.id}?contact=${joao.submission_id}`);
  await expect(cartaoJoao).toHaveCount(0);
  await expect(page.getByText('Nenhum detrator pediu contato por enquanto.')).toBeVisible();
});

test('responder nota 3 COM consentimento envia contact{name,phone,consent:true} e o RH vê o contato', async ({ page, api }) => {
  const campanha = semearCampanha(api);
  await entrarComoRh(page);
  await ateOPassoDeContato(page, campanha.id);

  await page.getByRole('checkbox', { name: CONSENTIMENTO }).click();
  await page.getByLabel('Seu nome', { exact: true }).fill('Pedro Alves');
  await page.getByLabel('Seu telefone', { exact: true }).fill('(11) 99999-1234');
  await page.getByRole('button', { name: 'Enviar respostas' }).click();

  await expect(page.getByText('Obrigado pela sua avaliação!')).toBeVisible();
  expect(api.respostasRecebidas).toHaveLength(1);
  const corpo = api.respostasRecebidas[0].corpo;
  expect(corpo.contact).toEqual({ name: 'Pedro Alves', phone: '(11) 99999-1234', consent: true });
  expect(corpo.answers).toEqual([{ question_id: campanha.questions?.[0].id, score: 3 }]);

  await page.goto(`/nps/${campanha.id}`);
  const cartao = page.getByLabel('Contato de Pedro Alves', { exact: true });
  await expect(cartao).toContainText('Telefone: (11) 99999-1234');
  await expect(cartao).toContainText('3');
});

test('consentimento sem dados mostra erro nos campos e nada é enviado; desmarcar apaga o digitado', async ({ page, api }) => {
  const campanha = semearCampanha(api);
  await ateOPassoDeContato(page, campanha.id);

  // Os campos só aceitam digitação com o consentimento marcado.
  await expect(page.getByLabel('Seu nome', { exact: true })).toBeEditable({ editable: false });
  const consentimento = page.getByRole('checkbox', { name: CONSENTIMENTO });
  await consentimento.click();
  await expect(page.getByLabel('Seu nome', { exact: true })).toBeEditable();

  await page.getByRole('button', { name: 'Enviar respostas' }).click();
  await expect(page.getByText('Como podemos te chamar?', { exact: true })).toBeVisible();
  await expect(page.getByText('Informe um telefone ou um e-mail.')).toBeVisible();
  expect(api.respostasRecebidas).toHaveLength(0);

  // Desmarcar apaga o que foi digitado e some com os erros.
  await page.getByLabel('Seu nome', { exact: true }).fill('Ana');
  await page.getByLabel('Seu telefone', { exact: true }).fill('11987654321');
  await consentimento.click();
  await expect(page.getByLabel('Seu nome', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Seu telefone', { exact: true })).toHaveValue('');
  await expect(page.getByText('Informe um telefone ou um e-mail.')).toHaveCount(0);
  await expect(page.getByLabel('Seu nome', { exact: true })).toBeEditable({ editable: false });

  // Sem consentimento, nenhum dado pessoal sai: o corpo não tem `contact`.
  await page.getByRole('button', { name: 'Enviar respostas' }).click();
  await expect(page.getByText('Obrigado pela sua avaliação!')).toBeVisible();
  expect(api.respostasRecebidas[0].corpo).not.toHaveProperty('contact');
});

test('QR code abre o modal e mostra o link público da campanha', async ({ page, context, api }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGEM });
  const campanha = semearCampanha(api);
  await entrarComoRh(page);
  await page.goto(`/nps/${campanha.id}`);

  await page.getByRole('button', { name: 'Mostrar QR code da campanha' }).click();
  const link = `${ORIGEM}/responder/${campanha.id}`;
  await expect(page.getByText('QR code da pesquisa', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR code da pesquisa' })).toBeVisible();
  await expect(page.getByText(link)).toBeVisible();

  await page.getByRole('button', { name: 'Copiar link da pesquisa' }).click();
  await expect(page.getByText('Link copiado.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
});

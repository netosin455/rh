// Fluxo (15): Pesquisas de colaboradores — editor com 10 perguntas, erros, prévia sem gravar,
// resposta pública (uma pergunta por tela) e resultados por pergunta.

import { entrarComoRh, expect, test } from './base';

type TipoPergunta = 'scale' | 'choice' | 'text';
const ROTULO_TIPO: Record<TipoPergunta, string> = { scale: 'Escala 1 a 5', choice: 'Escolha', text: 'Aberta' };

/** Pergunta i (1 a 10): escala, escolha e aberta em rodízio. */
function tipoDaPergunta(i: number): TipoPergunta {
  return i % 3 === 1 ? 'scale' : i % 3 === 2 ? 'choice' : 'text';
}

test('criar pesquisa com 10 perguntas mistas; o 10º limite desabilita o botão', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/pesquisas/nova');
  await expect(page.getByText('1 de 10 perguntas')).toBeVisible();

  const adicionar = page.getByRole('button', { name: 'Adicionar pergunta', exact: true });
  for (let i = 2; i <= 10; i++) await adicionar.click();
  await expect(page.getByText('10 de 10 perguntas')).toBeVisible();
  await expect(adicionar).toBeDisabled();
  await expect(page.getByText('Limite de 10 perguntas atingido.')).toBeVisible();

  await page.getByLabel('Título da pesquisa').fill('Clima da equipe');
  for (let i = 1; i <= 10; i++) {
    const tipo = tipoDaPergunta(i);
    const cartao = page.getByLabel(`Pergunta ${i} de 10`, { exact: true });
    if (tipo !== 'scale') await cartao.getByRole('radio', { name: ROTULO_TIPO[tipo], exact: true }).click();
    await page.getByLabel(`Texto da pergunta ${i}`, { exact: true }).fill(`Pergunta de teste ${i}`);
    if (tipo === 'choice') {
      await page.getByLabel(`Opção 1 da pergunta ${i}`, { exact: true }).fill('Sim');
      await page.getByLabel(`Opção 2 da pergunta ${i}`, { exact: true }).fill('Não');
    }
  }
  await page.getByRole('button', { name: 'Criar pesquisa', exact: true }).click();

  await expect.poll(() => api.escritasDe('POST', /^\/api\/surveys$/).length).toBe(1);
  const esperado = Array.from({ length: 10 }, (_, k) => {
    const i = k + 1;
    const tipo = tipoDaPergunta(i);
    return { question: `Pergunta de teste ${i}`, type: tipo, ...(tipo === 'choice' ? { options: ['Sim', 'Não'] } : {}), required: true };
  });
  expect(api.escritasDe('POST', /^\/api\/surveys$/)[0].corpo).toEqual({ title: 'Clima da equipe', expires_at: null, questions: esperado });
  await expect(page).toHaveURL(/\/pesquisas$/);
});

test('salvar vazio mostra os erros nos campos e NÃO envia', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/pesquisas/nova');
  await page.getByRole('button', { name: 'Criar pesquisa', exact: true }).click();

  await expect(page.getByText('Dê um título para a pesquisa')).toBeVisible();
  await expect(page.getByText('Escreva a pergunta', { exact: true })).toBeVisible();
  await expect(page.getByText('Corrija 2 campos marcados.')).toBeVisible();
  expect(api.escritasDe('POST', /surveys/)).toHaveLength(0);

  // Pergunta de escolha com opções vazias também é recusada, sem enviar nada.
  await page.getByLabel('Título da pesquisa').fill('Teste');
  await page.getByLabel('Texto da pergunta 1').fill('Qual o melhor horário?');
  await page.getByRole('radio', { name: 'Escolha', exact: true }).click();
  await page.getByRole('button', { name: 'Criar pesquisa', exact: true }).click();
  await expect(page.getByText('Coloque pelo menos 2 opções')).toBeVisible();
  expect(api.escritasDe('POST', /surveys/)).toHaveLength(0);
});

test('a prévia percorre a pesquisa sem gravar nada', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/pesquisas/nova');
  await page.getByLabel('Título da pesquisa').fill('Prévia');
  await page.getByLabel('Texto da pergunta 1').fill('Como foi a semana?');
  await page.getByRole('button', { name: /Ver como o colaborador vai ver/ }).click();

  await expect(page.getByText('Prévia: nada é enviado.')).toBeVisible();
  await page.getByRole('radio', { name: /^4 — Bom/ }).click();
  await page.getByRole('button', { name: 'Enviar respostas' }).click();
  await expect(page.getByText('Fim da prévia')).toBeVisible();
  await expect(page.getByText(/Nada foi enviado nem gravado/)).toBeVisible();
  await page.getByRole('button', { name: /Voltar a editar/ }).click();

  expect(api.escritas).toHaveLength(0);
  expect(api.surveys).toHaveLength(0);
});

test('responder pela tela pública: obrigatória bloqueia, Voltar guarda a resposta, resultados por pergunta', async ({ page, api }) => {
  const s = api.semearPesquisa('Clima de outubro', 'employees', [
    { question: 'Como você avalia o ambiente?', type: 'scale', required: true },
    { question: 'Como prefere trabalhar?', type: 'choice', options: ['Remoto', 'Presencial'], required: true },
    { question: 'Algo a acrescentar?', type: 'text', required: false },
  ]);
  const [q1, q2, q3] = s.questions ?? [];
  await entrarComoRh(page);
  await page.goto(`/responder/${s.id}`);

  await expect(page.getByText('Pergunta 1 de 3')).toBeVisible();
  // Obrigatória sem resposta: não avança.
  await page.getByRole('button', { name: 'Próxima pergunta' }).click();
  await expect(page.getByText('Escolha uma resposta para continuar.')).toBeVisible();
  await expect(page.getByText('Pergunta 1 de 3')).toBeVisible();

  await page.getByRole('radio', { name: /^4 — Bom/ }).click();
  await page.getByRole('button', { name: 'Próxima pergunta' }).click();
  await expect(page.getByText('Pergunta 2 de 3')).toBeVisible();

  // Voltar não perde a resposta anterior.
  await page.getByRole('button', { name: 'Voltar para a pergunta anterior' }).click();
  await expect(page.getByText('Pergunta 1 de 3')).toBeVisible();
  await expect(page.getByRole('radio', { name: /^4 — Bom/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Próxima pergunta' }).click();

  await page.getByRole('radio', { name: 'Presencial', exact: true }).click();
  await page.getByRole('button', { name: 'Próxima pergunta' }).click();
  await expect(page.getByText('Pergunta 3 de 3')).toBeVisible();
  await page.getByLabel('Sua resposta').fill('Tudo bem por aqui.');
  await page.getByRole('button', { name: 'Enviar respostas' }).click();

  await expect(page.getByText('Obrigado, sua resposta foi enviada')).toBeVisible();
  expect(api.respostasRecebidas).toHaveLength(1);
  expect(api.respostasRecebidas[0].corpo.answers).toEqual([
    { question_id: q1.id, score: 4 },
    { question_id: q2.id, choice: 'Presencial' },
    { question_id: q3.id, text: 'Tudo bem por aqui.' },
  ]);

  // Resultados por pergunta, como o RH vê.
  await page.goto(`/pesquisas/${s.id}`);
  await expect(page.getByText('4,0', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Presencial: 1 de 1')).toBeVisible();
  await expect(page.getByLabel('Remoto: 0 de 1')).toBeVisible();
  await expect(page.getByText('Tudo bem por aqui.')).toBeVisible();
  await expect(page.getByLabel('Participações. 1. Pessoas que enviaram a pesquisa').first()).toBeVisible();
});

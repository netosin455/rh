// Fluxo (30): Fluidez F1 — cache com revalidação, saldo nunca velho, sessão isolada, otimismo com rollback e prefetch.
// A API simulada atrasa/falha endpoints de propósito para mostrar o que a tela faz ENQUANTO espera.

import { CREDENCIAIS, controlarConfirmacoes, entrarComoRh, expect, itemDaSidebar, loginPelaTela, medirAteConteudo, test } from './base';
import { CREDENCIAIS_OUTRO } from './apiSimulada';

const LINHAS_DA_EQUIPE = '[aria-label^="Lançar falta, folga"]';

test.describe('revisita sem esqueleto', () => {
  test('Pesquisas → Dashboard → Pesquisas (tela que remonta): conteúdo na hora, sem esqueleto, mesmo com a API em 2 s', async ({ page, api }, info) => {
    api.semearPesquisa('Clima de outubro', 'employees', [{ question: 'Como está?', type: 'scale', required: true }]);
    api.atrasar(/^\/api\/surveys\?/, 2000, 'GET');
    await entrarComoRh(page);

    // 1ª visita (sem cache): espera a API — é o comportamento de ANTES da mudança, em TODA visita.
    const inicio = Date.now();
    await page.goto('/pesquisas');
    await expect(page.getByRole('button', { name: 'Ver resultados de Clima de outubro' })).toBeVisible({ timeout: 10_000 });
    const frio = Date.now() - inicio;

    await itemDaSidebar(page, 'Dashboard').click();
    await expect(page.getByText('Equipe hoje')).toBeVisible();
    // Ao sair, a tela de Pesquisas fica escondida na pilha; a revisita monta uma tela NOVA (antes: esqueleto + chamada).
    await expect(page.locator('[aria-label^="Ver resultados de"]:visible')).toHaveCount(0);

    const chamadasAntes = api.contarChamadas('GET', '/api/surveys?');
    const revisita = await medirAteConteudo(page, () => itemDaSidebar(page, 'Pesquisas').click(), '[aria-label^="Ver resultados de"]', 1);
    info.annotations.push({ type: 'tempo', description: `Pesquisas — ANTES da mudança (toda visita, API 2 s): ${frio} ms | DEPOIS (revisita com cache): ${Math.round(revisita)} ms` });
    expect(revisita, `revisita levou ${Math.round(revisita)} ms`).toBeLessThan(400);
    expect(revisita).toBeLessThan(frio / 5);
    // Dado fresco (dentro do TTL): nenhuma chamada nova.
    expect(api.contarChamadas('GET', '/api/surveys?')).toBe(chamadasAntes);
  });

  test('Pesquisas: com o TTL vencido, mostra o dado antigo na hora e atualiza por baixo (API 2 s)', async ({ page, api }) => {
    await page.clock.install();
    const s = api.semearPesquisa('Clima de outubro', 'employees', [{ question: 'Como está?', type: 'scale', required: true }]);
    api.atrasar(/^\/api\/surveys\?/, 2000, 'GET');
    await entrarComoRh(page);
    await page.goto('/pesquisas');
    await expect(page.getByRole('button', { name: 'Ver resultados de Clima de outubro', exact: true })).toBeVisible({ timeout: 10_000 });
    await itemDaSidebar(page, 'Dashboard').click();
    await expect(page.getByText('Equipe hoje')).toBeVisible();

    s.title = 'Clima de outubro (revisado)';
    await page.clock.fastForward(61_000);
    await itemDaSidebar(page, 'Pesquisas').click();
    // Na hora (bem antes dos 2 s da API): o dado antigo, sem esqueleto.
    await expect(page.getByRole('button', { name: 'Ver resultados de Clima de outubro', exact: true })).toBeVisible({ timeout: 700 });
    await expect(page.getByRole('button', { name: 'Ver resultados de Clima de outubro (revisado)' })).toBeVisible({ timeout: 8_000 });
  });

  test('Equipe (aba): ao voltar depois do TTL, a lista continua na tela e é atualizada por baixo', async ({ page, api }) => {
    await page.clock.install();
    api.atrasar(/^\/api\/employees\?/, 2000, 'GET');
    await entrarComoRh(page);
    await page.goto('/colaboradores');
    await expect(page.locator(LINHAS_DA_EQUIPE)).toHaveCount(5, { timeout: 10_000 });
    await itemDaSidebar(page, 'Dashboard').click();
    await expect(page.getByText('Equipe hoje')).toBeVisible();

    api.employees[0].name = 'Ana Souza (atualizada)';
    await page.clock.fastForward(61_000);
    const chamadasAntes = api.contarChamadas('GET', '/api/employees?');
    await itemDaSidebar(page, 'Equipe').click();
    await expect(page.locator(LINHAS_DA_EQUIPE)).toHaveCount(5, { timeout: 700 }); // a lista não some
    await expect(page.getByText('Ana Souza (atualizada)').first()).toBeVisible({ timeout: 8_000 });
    expect(api.contarChamadas('GET', '/api/employees?')).toBeGreaterThan(chamadasAntes);
  });

  test('dentro do TTL a revisita não refaz a chamada', async ({ page, api }) => {
    await entrarComoRh(page);
    await page.goto('/colaboradores');
    await expect(page.locator(LINHAS_DA_EQUIPE)).toHaveCount(5);
    await itemDaSidebar(page, 'Dashboard').click();
    await expect(page.getByText('Equipe hoje')).toBeVisible();
    const antes = api.contarChamadas('GET', '/api/employees?');
    await itemDaSidebar(page, 'Equipe').click();
    await expect(page.locator(LINHAS_DA_EQUIPE)).toHaveCount(5);
    expect(api.contarChamadas('GET', '/api/employees?')).toBe(antes);
  });

  test('revalidação que falha mantém a lista antiga e mostra só um aviso discreto', async ({ page, api }) => {
    await page.clock.install();
    await entrarComoRh(page);
    await page.goto('/colaboradores');
    await expect(page.locator(LINHAS_DA_EQUIPE)).toHaveCount(5);
    await itemDaSidebar(page, 'Dashboard').click();
    await expect(page.getByText('Equipe hoje')).toBeVisible();

    await page.clock.fastForward(61_000);
    api.falharProximas('GET', /^\/api\/employees\?/, 5);
    await itemDaSidebar(page, 'Equipe').click();
    await expect(page.locator(LINHAS_DA_EQUIPE)).toHaveCount(5); // conteúdo continua
    await expect(page.getByText('Não foi possível atualizar. Mostrando o que já estava na tela.')).toBeVisible();
    await expect(page.getByText('Não foi possível carregar os colaboradores.')).toHaveCount(0); // sem tela de erro
  });
});

test('lançar folga: o saldo NUNCA aparece velho, nem por um instante', async ({ page, api }) => {
  // 6 s: folga para o Playwright reabrir o modal e conferir antes de a lista nova chegar, mesmo com a máquina lenta.
  api.atrasar(/^\/api\/employees\?/, 6000, 'GET');
  await entrarComoRh(page);
  await page.goto('/colaboradores');
  await expect(page.locator(LINHAS_DA_EQUIPE)).toHaveCount(5, { timeout: 10_000 });

  // Ana começa com 10h no banco. Lança 4h de folga (a API passa a 6h; a lista nova demora 6 s).
  await page.getByRole('button', { name: /para Ana Souza$/ }).click();
  await page.getByRole('radio', { name: 'Folga', exact: true }).click();
  await expect(page.getByText('10h agora')).toBeVisible();
  await page.getByRole('radio', { name: '4h', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect.poll(() => api.escritasDe('POST', /^\/api\/absences$/).length).toBe(1);
  await expect(page.getByRole('button', { name: 'Salvar lançamento' })).toBeHidden();

  // Reabre logo em seguida: enquanto o saldo novo não chegou, NÃO mostra 10h e não deixa salvar.
  await page.getByRole('button', { name: /para Ana Souza$/ }).click();
  await page.getByRole('radio', { name: 'Folga', exact: true }).click();
  await expect(page.getByText('Atualizando saldo…')).toBeVisible();
  await expect(page.getByText(/10h/)).toHaveCount(0);
  await page.getByRole('radio', { name: '2h', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvar lançamento' })).toBeDisabled();

  // Quando a lista nova chega, o saldo certo (6h) aparece.
  await expect(page.getByText('6h → fica 4h')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText(/10h/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Salvar lançamento' })).toBeEnabled();
});

test('lançar folga e abrir Férias: sem esqueleto velho, saldo certo ao editar', async ({ page, api }) => {
  api.absences = [];
  api.atrasar(/^\/api\/employees\?/, 1500, 'GET');
  await entrarComoRh(page);
  await page.goto('/colaboradores');
  await expect(page.locator(LINHAS_DA_EQUIPE)).toHaveCount(5, { timeout: 10_000 });
  await page.getByRole('button', { name: /para Ana Souza$/ }).click();
  await page.getByRole('radio', { name: 'Folga', exact: true }).click();
  await page.getByRole('radio', { name: '4h', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect.poll(() => api.escritasDe('POST', /^\/api\/absences$/).length).toBe(1);

  await itemDaSidebar(page, 'Férias').click();
  await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByText('6h de banco de horas disponível')).toBeVisible();
  await expect(page.getByText('10h de banco de horas disponível')).toHaveCount(0);
});

test('logout e login com OUTRO usuário nunca mostra dados do anterior', async ({ page, api }) => {
  api.atrasar(/^\/api\/employees\?/, 1500, 'GET');
  await loginPelaTela(page, CREDENCIAIS.usuario, CREDENCIAIS.senha);
  await itemDaSidebar(page, 'Equipe').click();
  await expect(page.getByRole('button', { name: /^Abrir perfil de Ana Souza/ })).toBeVisible({ timeout: 10_000 });

  const confirmacoes = controlarConfirmacoes(page);
  confirmacoes.aceitar = true;
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL(/\/login/);

  // Outra empresa no mesmo computador: os dados são outros.
  api.employees.forEach((e, i) => { e.name = `Pessoa Nova ${i + 1}`; });
  // Vigia a página inteira: o nome antigo não pode aparecer em NENHUM momento depois do login do outro usuário.
  await page.evaluate(() => {
    const w = window as unknown as { __velhos: number };
    w.__velhos = 0;
    new MutationObserver(() => { if (document.body.innerText.includes('Ana Souza')) w.__velhos += 1; }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  // Login pela própria tela (sem recarregar a página: o vigia acima precisa continuar valendo).
  await page.getByLabel('Usuário', { exact: true }).fill(CREDENCIAIS_OUTRO.usuario);
  await page.getByLabel('Senha', { exact: true }).fill(CREDENCIAIS_OUTRO.senha);
  await page.getByRole('button', { name: /^Entrar/ }).click();
  await itemDaSidebar(page, 'Equipe').click();
  await expect(page.getByRole('button', { name: /^Abrir perfil de Pessoa Nova 1/ })).toBeVisible({ timeout: 10_000 });
  expect(await page.evaluate(() => (window as unknown as { __velhos: number }).__velhos)).toBe(0);
  await expect(page.getByText('Ana Souza')).toHaveCount(0);
});

test.describe('otimismo com rollback', () => {
  test('aprovar pendente: sai da fila na hora, antes da resposta da API', async ({ page, api }) => {
    api.atrasar(/^\/api\/absences\/1$/, 2000, 'PATCH');
    await entrarComoRh(page);
    await page.goto('/ferias');
    await expect(page.getByText('Aguardando aprovação')).toBeVisible();

    await page.getByRole('button', { name: /Aprovar/ }).click();
    await expect(page.getByText('Aguardando aprovação')).toBeHidden({ timeout: 700 });
    // A API ainda não respondeu: o efeito veio ANTES da resposta.
    expect(api.concluidas).not.toContain('PATCH /api/absences/1');
    await expect(page.getByText('Solicitação aprovada!')).toBeVisible({ timeout: 8_000 });
    expect(api.escritasDe('PATCH', /^\/api\/absences\/1$/)[0].corpo).toEqual({ approved: true });
  });

  test('aprovar com a API falhando (500): o item volta e aparece o aviso', async ({ page, api }) => {
    api.atrasar(/^\/api\/absences\/1$/, 1000, 'PATCH');
    api.falharProximas('PATCH', /^\/api\/absences\/1$/, 1);
    await entrarComoRh(page);
    await page.goto('/ferias');
    await page.getByRole('button', { name: /Aprovar/ }).click();
    await expect(page.getByText('Aguardando aprovação')).toBeHidden({ timeout: 700 });

    await expect(page.getByText('Erro interno simulado')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Aguardando aprovação')).toBeVisible();
    await expect(page.getByRole('button', { name: /Aprovar/ })).toBeVisible();
    expect(api.absences.find((a) => a.id === 1)?.status).toBe('pendente');
  });

  test('excluir pesquisa: sai da lista na hora; se a API falhar, volta e avisa', async ({ page, api }) => {
    api.semearPesquisa('Clima de outubro', 'employees', [{ question: 'Como está?', type: 'scale', required: true }]);
    api.atrasar(/^\/api\/surveys\/1$/, 1500, 'DELETE');
    api.falharProximas('DELETE', /^\/api\/surveys\/1$/, 1);
    const confirmacoes = controlarConfirmacoes(page);
    confirmacoes.aceitar = true;
    await entrarComoRh(page);
    await page.goto('/pesquisas');
    await expect(page.getByRole('button', { name: 'Excluir Clima de outubro' })).toBeVisible();

    await page.getByRole('button', { name: 'Excluir Clima de outubro' }).click();
    await expect(page.getByText('Nenhuma pesquisa criada')).toBeVisible({ timeout: 700 });
    expect(api.concluidas).not.toContain('DELETE /api/surveys/1');

    // Rollback exato: a pesquisa volta e o aviso aparece.
    await expect(page.getByText('Erro interno simulado')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: 'Excluir Clima de outubro' })).toBeVisible();
    expect(api.surveys).toHaveLength(1);

    // Tentando de novo (agora a API responde), a exclusão se confirma.
    await page.getByRole('button', { name: 'Excluir Clima de outubro' }).click();
    await expect(page.getByText('Nenhuma pesquisa criada')).toBeVisible({ timeout: 700 });
    await expect.poll(() => api.surveys.length, { timeout: 8_000 }).toBe(0);
  });

  test('excluir aviso: sai na hora; com falha volta', async ({ page, api }) => {
    api.atrasar(/^\/api\/notices\/1$/, 1500, 'DELETE');
    api.falharProximas('DELETE', /^\/api\/notices\/1$/, 1);
    const confirmacoes = controlarConfirmacoes(page);
    confirmacoes.aceitar = true;
    await entrarComoRh(page);
    await page.goto('/avisos');
    await expect(page.getByText('Recesso de fim de ano').first()).toBeVisible();
    await page.getByRole('button', { name: /Excluir$/ }).click();
    await expect(page.getByText('Nenhum aviso publicado')).toBeVisible({ timeout: 700 });
    await expect(page.getByText('Erro interno simulado')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Recesso de fim de ano').first()).toBeVisible();
  });

  test('excluir feedback: volta para a lista na hora sem ele; com a API falhando, ele reaparece e avisa', async ({ page, api }) => {
    api.semearFeedback({ employee_id: 1, title: 'Conversa de acompanhamento', content: 'Texto.', status: 'published' });
    api.atrasar(/^\/api\/feedbacks\/1$/, 1500, 'DELETE');
    api.falharProximas('DELETE', /^\/api\/feedbacks\/1$/, 1);
    const confirmacoes = controlarConfirmacoes(page);
    confirmacoes.aceitar = true;
    await entrarComoRh(page);
    await page.goto('/feedbacks');
    await expect(page.getByText('Conversa de acompanhamento').first()).toBeVisible();
    await page.getByRole('button', { name: 'Mais', exact: true }).click(); // abre o detalhe pelo app (o cache da lista continua)
    await page.getByRole('button', { name: /Mais ações/ }).click();
    await page.getByRole('button', { name: 'Excluir feedback' }).click();

    await expect(page).toHaveURL(/\/feedbacks$/, { timeout: 700 });
    await expect(page.getByText('Nenhum feedback criado').filter({ visible: true })).toBeVisible({ timeout: 700 });
    expect(api.concluidas).not.toContain('DELETE /api/feedbacks/1');
    // Falhou: o feedback volta para a lista e o aviso aparece.
    await expect(page.getByText('Erro interno simulado')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Conversa de acompanhamento').filter({ visible: true }).first()).toBeVisible();
    expect(api.feedbacks).toHaveLength(1);
  });

  test('marcar notificação como lida: muda na hora, antes da resposta', async ({ page, api }) => {
    api.atrasar(/^\/api\/users\?notifications=1/, 1500, 'PATCH');
    await entrarComoRh(page);
    await page.goto('/notificacoes');
    await expect(page.getByRole('button', { name: /Férias aprovadas, não lida/ })).toBeVisible();
    await page.getByRole('button', { name: /Férias aprovadas, não lida/ }).click();
    await expect(page.getByRole('button', { name: 'Férias aprovadas' })).toBeVisible({ timeout: 700 });
    expect(api.concluidas.filter((c) => c.startsWith('PATCH /api/users?notifications=1'))).toHaveLength(0);
  });
});

test('prefetch: passar o mouse no menu faz 1 chamada e a tela abre sem esqueleto', async ({ page, api }, info) => {
  api.atrasar(/^\/api\/notices/, 800, 'GET');
  await entrarComoRh(page);
  await page.goto('/colaboradores');
  await expect(page.locator(LINHAS_DA_EQUIPE)).toHaveCount(5);
  expect(api.contarChamadas('GET', '/api/notices')).toBe(0);

  const itemAvisos = itemDaSidebar(page, 'Avisos');
  await itemAvisos.hover();
  await expect.poll(() => api.contarChamadas('GET', '/api/notices')).toBe(1);
  await expect.poll(() => api.concluidas.some((c) => c.startsWith('GET /api/notices'))).toBe(true);

  // Passar o mouse de novo (ou focar) não repete a chamada.
  await page.getByRole('tab', { name: /^Abrir Equipe/ }).hover();
  await itemAvisos.hover();
  expect(api.contarChamadas('GET', '/api/notices')).toBe(1);

  const ms = await medirAteConteudo(page, () => itemAvisos.click(), '[aria-label^="Expandir aviso"]', 1);
  info.annotations.push({ type: 'tempo', description: `Avisos aberta depois do prefetch: ${Math.round(ms)} ms` });
  expect(ms, `abrir Avisos levou ${Math.round(ms)} ms`).toBeLessThan(400);
  expect(api.contarChamadas('GET', '/api/notices')).toBe(1); // dado fresco: a tela não buscou de novo
});

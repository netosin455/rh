# Bugs Found — SuperRH

> Registro de todos os bugs identificados durante as revisões técnicas.
> Status: RESOLVIDO = corrigido e em produção. ABERTO = pendente de correção.

---

## Revisão 2026-09-25 (RH-002 + RH-003)

### [BUG-011] Ausências aceitavam datas e períodos inválidos
- **Arquivo:** `api/_lib.ts:170-181`, `helpers/datas.ts:6-21`
- **Impacto:** ALTO. Datas inexistentes eram normalizadas pelo JavaScript e períodos invertidos podiam produzir duração/saldo incorretos.
- **Correção aplicada:** Validação ISO civil estrita, contagem inclusiva independente de fuso e rejeição de término anterior ao início.
- **Regressão:** `tests/absence-dates.test.ts`, `tests/absence-rules.test.ts`.
- **Status:** RESOLVIDO

### [BUG-012] Reaprovação de ausência descontava saldo novamente
- **Arquivo:** `api/_lib.ts:331-390`
- **Impacto:** CRÍTICO. Chamadas repetidas de aprovação podiam debitar férias ou banco de horas mais de uma vez; débito e lançamento não eram atômicos.
- **Correção aplicada:** Só há transição de `pendente`; criação autoaprovada e aprovação usam CTE que debita o saldo e grava a ausência na mesma instrução.
- **Regressão:** `tests/absence-rules.test.ts`.
- **Status:** RESOLVIDO

### [BUG-013] Colaborador acessava ausências de colegas
- **Arquivo:** `api/absences/index.ts:112-132`, `api/_lib.ts:197-201`
- **Impacto:** ALTO. Motivos e anexos de ausências, inclusive licenças, podiam ficar acessíveis dentro do tenant; usuário comum também podia solicitar em nome de outra pessoa.
- **Correção aplicada:** Colaborador fica limitado ao próprio cadastro para leitura e criação; RH/admin/adm/gestor preservam visão operacional.
- **Regressão:** `tests/absence-rules.test.ts`.
- **Status:** RESOLVIDO

### [BUG-014] Edição/exclusão de ausência aprovada burlava o saldo
- **Arquivo:** `api/absences/index.ts:28-105`
- **Impacto:** ALTO. PATCH aceitava valores sem validação e DELETE removia registros aprovados sem restaurar saldo.
- **Correção aplicada:** Apenas pendentes podem ser editados/excluídos; edição valida tipo, datas, horas e sobreposição.
- **Status:** RESOLVIDO

### [BUG-015] Reconhecimento não notificava o colaborador
- **Arquivo:** `api/recognitions/index.ts:127-165`, `api/_email.ts`
- **Impacto:** MÉDIO. O destinatário do Kudos não era avisado; um erro de transporte poderia acoplar email à criação.
- **Correção aplicada:** Entidade escolhida: **reconhecimentos**. Email é enviado após persistência, para usuário ligado ao colaborador da mesma `company_id` do JWT; inválido/vazio é ignorado e falhas do Resend são logadas sem reverter o registro.
- **Regressão:** `tests/email.test.ts`, `tests/recognitions.test.ts`.
- **Status:** RESOLVIDO

### [BUG-016] Onboarding e pesquisa aceitavam referências de outro tenant
- **Arquivo:** `api/onboarding/index.ts:78-108,175-178`, `api/surveys/index.ts:89,130,155,173-193`
- **Impacto:** ALTO. Qualquer papel podia concluir etapa de outro responsável; limpeza de onboarding e `target_dept` não garantiam empresa em todos os pontos.
- **Correção aplicada:** Etapa exige papel responsável (ou gestão); limpeza e departamento-alvo filtram `company_id`, e JOINs de departamento também foram restringidos.
- **Regressão:** `tests/onboarding.test.ts`, `tests/surveys.test.ts`.
- **Status:** RESOLVIDO

### [BUG-017] Agenda usava UTC para “próximos eventos”
- **Arquivo:** `api/events/index.ts:80-89`
- **Impacto:** MÉDIO. Entre 21h e 23h59 BRT, podia ocultar evento do próprio dia.
- **Correção aplicada:** Data calculada no PostgreSQL em `America/Sao_Paulo`.
- **Regressão:** `tests/events.test.ts`.
- **Status:** RESOLVIDO

### [BUG-018] Ações de tela não davam feedback coerente
- **Arquivo:** `app/(tabs)/admin.tsx:125-140`, `app/(tabs)/avisos.tsx:133-145`, `app/notificacoes.tsx:39-75`, `app/(tabs)/ferias.tsx:92-99`
- **Impacto:** MÉDIO. `window.confirm` quebrava em mobile; estado de notificação era atualizado mesmo com falha de API; carregamentos falhos eram silenciosos.
- **Correção aplicada:** `confirmAction` e Toasts; estado local só muda após resposta da API.
- **Status:** RESOLVIDO

### Itens abertos — exigem decisão ou escopo adicional

#### [BUG-019] Aviso global é marcado como lido para toda a empresa
- **Arquivo:** `api/users/index.ts:30-32`
- **Impacto:** MÉDIO. `notifications.user_id IS NULL` usa uma única coluna `read`; uma leitura afeta todos os usuários.
- **Correção sugerida:** Tabela de leituras por usuário, como `notification_reads(notification_id, user_id, read_at)`. Exige migration e aprovação do Carlo.

#### [BUG-020] Alguns efeitos colaterais ainda engolem erro sem log
- **Arquivo:** `api/_lib.ts:280,299,403`; `api/employees/index.ts:74`
- **Impacto:** BAIXO/MÉDIO. Incidentes de notificação e histórico salarial podem não ser diagnosticados.
- **Correção sugerida:** Log estruturado nos `catch`; decidir se histórico salarial deve ser transacional.

#### [BUG-021] Relações de colaborador aceitam IDs de outro tenant
- **Arquivo:** `api/employees/index.ts:84,88,181-182`
- **Impacto:** ALTO. `department_id` e `manager_id` não são validados por empresa antes de POST/PUT.
- **Correção sugerida:** Validar ambas as referências por `ctx.company_id` e restringir JOINs. Não exige migration.

#### [BUG-022] Evento aceita/exibe processo jurídico de outro tenant
- **Arquivo:** `api/events/index.ts:52,86,97,106,115,140`
- **Impacto:** ALTO. `case_id` não é validado por empresa e os JOINs não conferem tenant.
- **Correção sugerida:** Validar `case_id` e adicionar `c.company_id = e.company_id` aos JOINs. Fluxo jurídico ficou fora desta mudança RH.

#### [BUG-023] Restauração de sessão pode deixar app carregando indefinidamente
- **Arquivo:** `contextos/Autenticacao.tsx:37-58`
- **Impacto:** MÉDIO. Erro de AsyncStorage/JSON impede `setLoading(false)`.
- **Correção sugerida:** `try/catch/finally`, limpeza de credenciais corrompidas e encerramento garantido do loading.

#### [BUG-024] Métricas do dashboard falham silenciosamente
- **Arquivo:** `app/(tabs)/index.tsx:105-118,322`
- **Impacto:** BAIXO/MÉDIO. Contadores podem ficar desatualizados sem sinalizar indisponibilidade.
- **Correção sugerida:** Registrar contexto e exibir estado degradado/Toast em ações manuais.

---

## Revisão 2026-05-08 (Security Review + Final Review)

### [BUG-001] Cross-tenant injection em POST /api/absences
- **Arquivo:** `api/absences/index.ts`
- **Impacto:** CRÍTICO
- **Descrição:** O `employee_id` enviado no corpo da requisição não era validado contra o `company_id` do usuário autenticado. Um usuário poderia criar ausências para colaboradores de outra empresa.
- **Correção:** Adicionada subquery que valida se `employee_id` pertence ao `company_id` antes do INSERT.
- **Status:** RESOLVIDO

---

### [BUG-002] Prompt injection no chat IA
- **Arquivo:** `api/chat.ts`
- **Impacto:** CRÍTICO
- **Descrição:** O campo `role` das mensagens do usuário não era validado. Mensagens com `role: "system"` poderiam sobrescrever o system prompt da IA.
- **Correção:** Filtro explícito para aceitar apenas `role: "user"` ou `role: "assistant"`.
- **Status:** RESOLVIDO

---

### [BUG-003] Enum `type` sem validação em POST /api/absences
- **Arquivo:** `api/absences/index.ts`
- **Impacto:** MÉDIO
- **Descrição:** O campo `type` era inserido diretamente no banco sem validação. Valores fora do enum causavam erro 500 (constraint violation exposto).
- **Correção:** Validação explícita pré-INSERT com lista de valores aceitos.
- **Status:** RESOLVIDO

---

### [BUG-004] CORS_ORIGIN sem aviso quando não configurado
- **Arquivo:** `api/_lib.ts`
- **Impacto:** MÉDIO
- **Descrição:** Quando `CORS_ORIGIN` não estava configurado, a rota aceitava qualquer origem sem log ou warning.
- **Correção:** Log de warning adicionado ao iniciar sem `CORS_ORIGIN`.
- **Status:** RESOLVIDO

---

### [BUG-005] PATCH /api/notices/:id sem validação de boolean
- **Arquivo:** `api/notices/[id].ts`
- **Impacto:** MÉDIO
- **Descrição:** O campo `pinned` era enviado ao banco sem verificar se era boolean. Strings como `"true"` causavam violação de constraint no PostgreSQL.
- **Correção:** Validação `typeof pinned !== 'boolean'` antes do UPDATE.
- **Status:** RESOLVIDO

---

### [BUG-006] PUT /api/users/:id aceita string vazia após trim
- **Arquivo:** `api/users/[id].ts`
- **Impacto:** BAIXO
- **Descrição:** `COALESCE(trim(name), name)` com string vazia retornava a string vazia em vez de manter o valor anterior.
- **Correção:** Validação explícita: se `name?.trim()` for vazio string, retorna 400.
- **Status:** RESOLVIDO

---

### [BUG-007] Tela admin.tsx acessível por rota direta sem guard
- **Arquivo:** `app/(tabs)/admin.tsx`
- **Impacto:** BAIXO
- **Descrição:** A tela de admin era protegida apenas na API, mas não na UI. Qualquer usuário que conhecesse a rota conseguia renderizar a tela (mesmo que sem dados).
- **Correção:** Guard de role adicionado na tela com redirect para home.
- **Status:** RESOLVIDO

---

### [BUG-008] Import não utilizado em api/notices
- **Arquivo:** `api/notices/index.ts`
- **Impacto:** BAIXO (qualidade)
- **Descrição:** Import de símbolo não utilizado deixado no arquivo.
- **Correção:** Import removido.
- **Status:** RESOLVIDO

---

## Revisão 2026-05-18 (Análise de Qualidade)

### [BUG-009] Erros silenciosos em api/chat.ts — `.catch(() => [])`
- **Arquivo:** `api/chat.ts` linhas ~59, ~73, ~87
- **Impacto:** BAIXO (observabilidade)
- **Descrição:** Queries opcionais de enriquecimento de contexto da IA usavam `.catch(() => [])` sem nenhum log. Falhas no banco eram completamente silenciosas — impossível diagnosticar em produção.
- **Correção:** `.catch()` atualizado para logar o erro com timestamp antes de retornar array vazio.
- **Status:** RESOLVIDO

---

### [BUG-010] Erros silenciosos em api/cron.ts — `.catch(() => [...])`
- **Arquivo:** `api/cron.ts` linhas ~146, ~154
- **Impacto:** BAIXO (observabilidade)
- **Descrição:** Queries de `buildWeeklyContext()` silenciavam erros de banco sem log, tornando falhas no relatório semanal impossíveis de rastrear.
- **Correção:** `.catch()` atualizado para logar o erro com contexto (company_id, nome da query) antes de retornar valor padrão.
- **Status:** RESOLVIDO

---

## Bugs Abertos

Nenhum bug aberto no momento.

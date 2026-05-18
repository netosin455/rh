# Bugs Found — SuperRH

> Registro de todos os bugs identificados durante as revisões técnicas.
> Status: RESOLVIDO = corrigido e em produção. ABERTO = pendente de correção.

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

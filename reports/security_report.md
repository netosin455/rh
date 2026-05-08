# Security Report — SuperRH — 2026-05-08

## Nota Geral
6/10 — Base sólida (bcrypt, JWT, parameterized queries), mas com falhas críticas de isolamento multitenancy e ausência de rate limiting.

---

## Vulnerabilidades Encontradas

### [CRÍTICO] Cross-tenant injection em POST /api/absences
**Arquivo:** `api/absences/index.ts` — linha 44  
**Descrição:** O `employee_id` enviado no body é inserido diretamente sem verificar se esse funcionário pertence à `company_id` do usuário autenticado. Um usuário malicioso pode criar ausências para funcionários de outras empresas conhecendo apenas o ID.  
**Correção aplicada:** Adicionada subquery que valida `employee_id` contra `company_id` antes do INSERT.

---

### [CRÍTICO] Prompt injection no chat IA
**Arquivo:** `api/chat.ts` — linha 58  
**Descrição:** O campo `role` das mensagens enviadas pelo cliente não é validado. Um usuário pode enviar `role: "system"` e injetar instruções no sistema prompt da IA, bypassando as restrições definidas.  
**Correção aplicada:** Filtro para aceitar apenas `role: "user"` ou `role: "assistant"` nas mensagens do cliente.

---

### [MÉDIO] Enum sem validação em POST /api/absences
**Arquivo:** `api/absences/index.ts` — linha 36  
**Descrição:** O campo `type` é inserido sem validar se é um dos valores permitidos. Um valor inválido causa erro 500 (DB constraint) ao invés de 400, expondo comportamento interno.  
**Correção aplicada:** Validação explícita do enum antes do INSERT.

---

### [MÉDIO] CORS_ORIGIN não configurado no ambiente de produção
**Arquivo:** `api/_lib.ts` — linha 27  
**Descrição:** Se `CORS_ORIGIN` não estiver definido no `.env` do Vercel, o header `Access-Control-Allow-Origin` não é enviado. Isso bloqueia o app web em produção mas também indica que a variável pode estar ausente sem aviso visível.  
**Correção aplicada:** Log de warning na inicialização se `CORS_ORIGIN` não estiver definido.

---

### [MÉDIO] Sem paginação nas listagens
**Arquivos:** `api/employees/index.ts`, `api/absences/index.ts`, `api/events/index.ts`  
**Descrição:** Todas as queries de listagem retornam registros ilimitados. Uma empresa com muitos registros pode gerar respostas enormes, degradando performance ou sendo usada como vetor de abuso.  
**Status:** Não corrigido nesta sprint — recomendado para próxima iteração com `LIMIT`/`OFFSET`.

---

### [BAIXO] Sem rate limiting no login
**Arquivo:** `api/auth/login.ts`  
**Descrição:** Nenhum mecanismo impede tentativas ilimitadas de login. Permite ataques de força bruta contra senhas.  
**Status:** Não corrigido — depende de infraestrutura (Vercel Edge Middleware ou Upstash Redis). Recomendado para próxima iteração.

---

### [BAIXO] JWT sem revogação (7 dias)
**Arquivo:** `api/_lib.ts` — linha 41  
**Descrição:** Tokens expiram em 7 dias sem mecanismo de blacklist. Token comprometido permanece válido até expirar.  
**Status:** Aceito como trade-off para MVP. Mitigação: reduzir para 24h na próxima iteração.

---

### [BAIXO] Import não utilizado em notices
**Arquivo:** `api/notices/index.ts` — linha 6  
**Descrição:** `IS_ADMIN` importado mas não usado.  
**Correção aplicada:** Import removido.

---

## Verificações OK

- ✅ Senhas com bcrypt (hash seguro)
- ✅ JWT assinado com secret do ambiente
- ✅ Queries com parâmetros (sem SQL injection via template literals do Neon)
- ✅ `.env` no `.gitignore` — credenciais não commitadas
- ✅ Autenticação obrigatória em todas as rotas exceto login
- ✅ RBAC implementado (CAN_MANAGE_EMPLOYEES, CAN_APPROVE_ABSENCES)
- ✅ Stack traces não expostos ao usuário final
- ✅ `password_hash` não retornado nas respostas

---

## Correções Aplicadas Neste Report
1. Cross-tenant injection em absences — CORRIGIDO
2. Prompt injection no chat — CORRIGIDO
3. Validação de enum em absences — CORRIGIDO
4. Import não utilizado em notices — CORRIGIDO

## Recomendações Futuras
- Implementar rate limiting no login (Upstash Redis + Vercel Middleware)
- Adicionar paginação em todas as listagens
- Reduzir expiração do JWT de 7d para 24h
- Configurar `CORS_ORIGIN` explicitamente no dashboard do Vercel

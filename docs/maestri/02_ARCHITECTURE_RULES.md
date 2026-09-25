# Regras de arquitetura

Detalhes e diagramas: `../architecture.md`.

1. **Camadas:** `app/` (UI) → `conexoes/` (HTTP) → `api/` (auth, RBAC, validação) → Neon. Nenhuma camada pula a seguinte; tela nunca faz SQL.
2. **Multitenancy:** `company_id` só de `ctx.company_id` (JWT). Toda query de tabela com `company_id` filtra por ele. Cross-tenant = 403/404, com teste.
3. **RBAC centralizado** em `api/_lib.ts` (`CAN_MANAGE_EMPLOYEES`, `CAN_APPROVE_ABSENCES`, `IS_ADMIN`). Não recriar checagem de role solta em endpoint.
4. **Efeitos colaterais** (email, push, cron): helper próprio em `api/`, chamado depois da operação principal, com try/catch. Falha é logada e não desfaz nem bloqueia o principal.
5. **IA (Groq):** entra por um construtor de contexto que minimiza dados. Nunca serializar linhas completas de `employees`.
6. **Dados pessoais:** mínimo necessário em resposta, email e log. Destinatário de email sempre da mesma empresa de quem originou o evento.
7. **Tema:** cores e tipografia só via `estilo/cores.ts`; sem cor hardcoded em tela.
8. **Confirmações de UI:** `helpers/confirm.ts`, nunca `Alert.alert` (mudo na web).
9. **Banco:** mudança de schema só por migration numerada em `banco/migrations/` com rollback descrito.

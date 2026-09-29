# Regras de arquitetura

Detalhes e diagramas: `docs/architecture.md`.

1. **Camadas:** `app/` (UI) → `conexoes/` (HTTP) → `api/` (auth, RBAC, validação) → Neon. Nenhuma camada pula a seguinte; tela nunca faz SQL.
2. **Multitenancy:** `company_id` só de `ctx.company_id` (JWT). Toda query de tabela com `company_id` filtra por ele. Cross-tenant = 403/404, com teste.
3. **RBAC centralizado** em `api/_lib.ts` (`CAN_MANAGE_EMPLOYEES`, `CAN_APPROVE_ABSENCES`, `IS_ADMIN`). Não recriar checagem de role solta em endpoint.
4. **Efeitos colaterais** (email, push, cron): helper próprio em `api/`, chamado depois da operação principal, com try/catch. Falha é logada e não desfaz nem bloqueia o principal.
5. **IA (Groq):** entra por um construtor de contexto que minimiza dados. Nunca serializar linhas completas de `employees`.
6. **Dados pessoais:** mínimo necessário em resposta, email e log. Destinatário de email sempre da mesma empresa de quem originou o evento.
7. **Tema:** cores e tipografia só via `estilo/cores.ts`; sem cor hardcoded em tela.
8. **Confirmações de UI:** `helpers/confirm.ts`, nunca `Alert.alert` (mudo na web).
9. **Banco:** mudança de schema só por migration numerada em `banco/migrations/` com rollback descrito.

## Fronteiras por pasta

| Pasta | Responsabilidade | Não faz |
|---|---|---|
| `app/` | UI e rotas (Expo Router) | SQL; regra de negócio pesada |
| `componentes/` | Componentes visuais compartilhados | Regra de domínio pesada; acesso a banco |
| `conexoes/` | Clientes HTTP front → API | Regra de permissão (a API revalida) |
| `contextos/` | Estado global (ex.: Autenticação) | Lógica de tela |
| `api/` | Vercel Functions: auth, RBAC, validação, integrações | Conter UI |
| `banco/` | Schema e migrations | Conhecer apresentação; mudar sem migration |
| `helpers/` | Lógica reutilizável | Depender de tela específica |
| `tipos/` | Contratos TypeScript | Lógica |
| `estilo/` | Tokens visuais | Regra de negócio |
| `tests/` | Vitest | Tocar dado real |

Regras curtas: **UI não faz SQL. API não contém UI. `company_id` vem do JWT. Componentes não carregam regra pesada. Migration é obrigatória para qualquer mudança de schema.** Não duplicar componente existente; regra comum vira helper.

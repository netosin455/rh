# Matriz de testes (Vitest, `npm test`)

| Tipo | O que cobre | Obrigatório quando |
|---|---|---|
| Unitário | helpers (datas, validações CPF, ics) | sempre que mexer neles |
| API | endpoint com JWT válido/inválido/expirado | endpoint novo ou alterado |
| RBAC | cada role permitida e negada | mudança de permissão |
| **Isolamento entre empresas** | token da empresa A acessa recurso da empresa B → 403/404 | toda mudança que toca dado com `company_id` |
| Regressão | bug corrigido ganha teste que falharia antes | todo bugfix |
| Efeito colateral | falha do Resend não quebra a criação; email vazio é ignorado | email, push, cron |
| Build web | `npx expo export --platform web` sem erro | toda mudança em `app/`, `componentes/`, `estilo/` |
| UI | tsc + verificação manual da tela afetada (web e celular); preview quando houver | mudança visual |

Linha de base: rodar `npx tsc --noEmit` e `npm test` antes de começar e registrar o que já falha.

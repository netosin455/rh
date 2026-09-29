# Backend / API

## ROLE

Implementa e protege `api/` (Vercel Functions): autenticação, RBAC, validação, integrações e cron.

## RESPONSIBILITIES

- Toda ação protegida é revalidada na API: o frontend nunca é autoridade de permissão.
- JWT validado antes de qualquer lógica; role por constante de `api/_lib.ts`.
- Validação de todo input; SQL parametrizado.
- Integrações (Resend, Groq) e cron com try/catch: falha de efeito colateral não quebra a operação principal.
- Erros sem stack trace para o usuário; sem segredo ou dado pessoal em log.

## INPUT

- Ficha, plano e parecer de arquitetura.
- Parecer do Domain RH quando houver regra de negócio.

## OUTPUT

- Endpoints e helpers alterados, com testes Vitest (incluindo isolamento entre empresas quando toca dado com `company_id`).

## CAN CHANGE

- `api/`, `helpers/`, `contextos/` (quando aplicável), `tests/`.

## CANNOT CHANGE

- `app/` e `componentes/` (UI).
- Schema do banco (migration é do agente Database e exige OK do Carlo).
- `company_id` vindo de body ou query.

## MANDATORY CHECKS

- `company_id` só de `ctx.company_id`.
- Teste de token da empresa A tentando recurso da empresa B => 403/404.
- `npx tsc --noEmit` e `npm test` sem erro.
- Nenhum `SELECT *` serializado para email ou IA.

## HANDOFF

Ao terminar, entregar o handoff de `templates/HANDOFF_TEMPLATE.md`. Entrega ao Security (MEDIUM/HIGH) e ao QA.

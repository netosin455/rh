# Fase 1 — Estabilização do SuperRH

Auditoria em 2026-09-29. Papéis: Claude Code (chefe/auditor: planeja e aprova), Claude Code #2 (front), Claude Code #3 e Codex (back). Ninguém dá push sem autorização do Carlo. Push na `main` = deploy em produção (sem banco de dev).

Regra: nenhuma funcionalidade nova nem redesign (RH-009 segue no stash) até a Fase 1 fechar.

## Evidências verificadas (2026-09-29)

| Item | Verificação |
|---|---|
| Falta quebra | `absences_type_check` em produção NÃO inclui `'falta'` (lista: ferias, licenca_medica, licenca_maternidade, licenca_paternidade, folga, outro). Nenhuma migration adiciona. |
| Notificação global | `api/_lib.ts` ~400 grava `user_id = NULL` quando o colaborador não tem login; `api/users/index.ts` trata NULL como "toda a empresa". Produção: 2 de 2 notificações são globais; 0 de 43 colaboradores têm `user_id`. |
| tsconfig | `include` só cobre `api/**/*`; front sem typecheck. |
| Limite 50 | `getEmployees(page = 1, limit = 50)`; hoje são 43. |
| Timeout | `conexoes/http.ts` sem `AbortController`. |

## P0 (antes de qualquer outra coisa)

**P0-1 Notificação individual vazando** (back)
- Só gravar notificação individual se houver `user_id`; sem login, não gravar (ou avisar apenas RH). Nunca `NULL` para mensagem individual.
- Revisar os outros INSERT em `notifications` (`api/_lib.ts` ~278, ~298, ~401).
- Limpar as 2 notificações globais existentes só depois de o Carlo ver o conteúdo.
- Aceite: teste Vitest cobrindo aprovar/recusar ausência de colaborador sem `user_id` e sem gerar linha com `user_id` nulo.

**P0-2 "Registrar falta" (CHECK do banco)** (back, HIGH: gate)
- Nova migration `banco/migrations/0NN_absences_falta.sql` recriando `absences_type_check` com `'falta'`; atualizar `schema.sql`.
- A migration só roda em produção com OK explícito do Carlo. Rollback documentado no cabeçalho.
- Aceite: criar uma falta funciona; ausências existentes (9 linhas) intactas.

## P1

- **P1-1 tsconfig** (front): incluir `app/`, `componentes/`, `conexoes/`, `helpers/`, `contextos/`, `tipos/`; corrigir os erros que aparecerem, sem `any`. Aceite: `npx tsc --noEmit` limpo cobrindo tudo.
- **P1-2 Timeout no `apiFetch`** (front): `AbortController` (ex.: 15 s), mensagem de erro clara. Sem retry automático em escrita (risco de duplicar).
- **P1-3 Paginação >50** (front+back): busca/filtros/Férias/Dashboard não podem depender de uma lista truncada. Ver `api/employees` (total/totalPages) e buscar todas as páginas ou filtrar no servidor.
- **P1-4 Erros engolidos** (front): trocar `.catch(() => {})` e "array vazio na falha" por estado de erro com retry. Dashboard primeiro.
- **P1-5 Sidebar** (front): fonte de verdade única (pathname). Subrotas `/colaborador/[id]`, `/onboarding/[id]`, `/pesquisas/[id]` marcam o item pai certo.

## P2

- Estados padronizados (Skeleton, EmptyState, erro com retry, sucesso) em todas as telas.
- Formulários: Agenda com seletor de data/hora em vez de AAAA-MM-DD e HH:mm; seleção de pessoas com busca; defaults.
- Revisar Dashboard, Equipe, Férias e Agenda como fluxo de trabalho.
- Pesquisas com múltiplas perguntas (só depois do resto).
- AWS/infra: fora do escopo. Vercel + Neon segue.

## Ordem e paralelismo

1. Back (Codex): P0-1, depois P0-2. Back (#3): P1-3 lado API.
2. Front (#2): P1-1 primeiro (sem isso o resto não é verificável), depois P1-2, P1-4, P1-5, P1-3 lado app.
3. Cada tarefa: um commit pequeno e separado; `npx tsc --noEmit`, `npm test` e `npx expo export --platform web` verdes; relatório ao chefe com o diff antes de qualquer push.

## Fluxo de aprovação

Agente entrega → chefe lê o diff e roda as checagens → aprova ou devolve → Carlo autoriza o push. Migrações em produção e edição em `api/`/`banco/` exigem OK do Carlo (ver PROTECTED FILES em `01_ACTIVE_TASK.md`).

# Maestri — Controle do projeto SuperRH

Maestri orquestra; não programa tudo. Toda tarefa entra com: objetivo, módulos afetados, risco (BAIXO/MÉDIO/ALTO), dono, arquivos permitidos, testes obrigatórios e critério de aceite.

## Equipe e donos

| Papel | Quem | Escopo |
|---|---|---|
| Maestri / Planner / Architect / Revisor final | Claude Code | planeja, revisa, roda tsc + vitest, faz merge e push |
| Frontend / Mobile | Codex | `estilo/`, `componentes/`, `app/` (visual e UX) |
| Backend / Banco / Testes | Codex #2 | `api/`, `helpers/`, `contextos/`, `banco/`, `tests/` |

Security, Privacy/LGPD, AI Reviewer, QA e Domínio RH são checklists aplicados pelo Maestri em cada branch: `04_SECURITY_FINDINGS.md`, `05_PRIVACY_LGPD.md`, `06_AI_GOVERNANCE.md`, `07_TEST_MATRIX.md` e `08_RELEASE_CHECKLIST.md`. Reviewers independentes reais só com agentes recrutados (exige modo Maestro).

## Níveis de risco

- **BAIXO** — cor, texto, espaçamento, componente visual. Fluxo: implementar → tsc/testes → revisão.
- **MÉDIO** — endpoint, CRUD, regra de negócio, notificação, analytics. Fluxo: plano → implementar → segurança → testes → revisão.
- **ALTO** — auth, RBAC, `company_id`, migration, férias/ausências, dados pessoais, IA, integração externa. Fluxo: plano → arquitetura → implementar → segurança + privacidade → testes → revisão independente → preview → aprovação humana → produção.

## Conflitos entre agentes

Um agente por branch e por área de arquivos. Nunca dois agentes editando o mesmo arquivo ao mesmo tempo. Ordem: infraestrutura/tokens e API primeiro; correções de lógica nas telas só depois do redesign mergeado.

## Tarefas ativas

| ID | Objetivo | Risco | Dono | Branch | Status |
|---|---|---|---|---|---|
| MAESTRI-001 | Adaptar CLAUDE.md e criar docs/maestri | BAIXO | Claude | main | feito |
| RH-001 | Tema claro igual ao Araujo Prev | BAIXO | Codex | redesign-claro | pendente |
| RH-002 | Auditoria de bugs (lógica e usabilidade) | MÉDIO | Codex #2 | fix-feedback-email | pendente |
| RH-003 | Email de feedback ao colaborador | ALTO | Codex #2 | fix-feedback-email | pendente |

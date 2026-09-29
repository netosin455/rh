# Workflow MEDIUM (risco médio)

**Quando:** CRUD, endpoint, regra de negócio, filtro, relatório, notificação, integração interna, analytics.

```
Maestri → Planner → Architect → Builder → Security → QA → Reviewer
```

| Etapa | Quem | Saída |
|---|---|---|
| 1. Ficha | `agents/MAESTRI.md` | Ficha completa em `core/01_ACTIVE_TASK.md` |
| 2. Plano | `agents/PLANNER.md` | Arquivos, ordem, testes, rollback |
| 3. Arquitetura | `agents/ARCHITECT.md` | Onde a mudança mora; contratos |
| 4. Implementar | `agents/BACKEND_API.md` e/ou `agents/FRONTEND_MOBILE.md` | Código e testes |
| 5. Segurança | `agents/SECURITY.md` | PASS/FAIL; teste de isolamento entre empresas quando há `company_id` |
| 6. QA | `agents/QA.md` | tsc, Vitest, build, teste manual |
| 7. Revisão | `agents/FINAL_REVIEWER.md` | Veredito |

Regras:
- 5 a 7 etapas.
- Se surgir dado pessoal, `company_id` novo, migration, IA ou integração externa: reclassificar para HIGH (`workflows/HIGH_RISK.md`).
- Efeito colateral (email, push, cron) com try/catch: falha não quebra a operação principal.
- Release: `workflows/RELEASE.md`.

# Maestri — SuperRH

O Maestri é a camada central de orquestração do trabalho neste projeto: decide **o que** será feito, **com que risco**, **por quem**, **com quais skills**, **em quais arquivos** e **com quais gates**. Ele **não é o programador principal**. Toda tarefa relevante entra por ele antes de qualquer edição.

> Não confundir com o app Maestri (canvas de agentes) nem com as skills `maestri-*` do Claude Code: aqui Maestri é o processo descrito nesta pasta.

Caminhos deste índice são relativos a `docs/maestri/`.

## Fluxo

```
USUÁRIO
  ↓
MAESTRI                 agents/MAESTRI.md
  ↓
TASK CLASSIFIER         agents/TASK_CLASSIFIER.md
  ↓
RISK WORKFLOW           workflows/  (LOW, MEDIUM, HIGH, UI_REDESIGN, MOTION, DATABASE_CHANGE, AI_CHANGE)
  ↓
AGENTS                  agents/
  ↓
SKILLS                  skills/     (preflight antes de UI e motion)
  ↓
IMPLEMENTATION
  ↓
QA                      agents/QA.md, quality/
  ↓
FINAL REVIEW            agents/FINAL_REVIEWER.md
  ↓
HUMAN APPROVAL          Carlo autoriza
  ↓
RELEASE                 workflows/RELEASE.md  (push em main só com autorização explícita)
```

Antes de editar, o Maestri responde: pedido, escopo, risco, partes afetadas, agentes, skills, arquivos permitidos, arquivos protegidos, testes e critério de aceite, e grava isso em `core/01_ACTIVE_TASK.md`.

## Pastas

| Pasta | Conteúdo |
|---|---|
| [`core/`](core/) | Estado e regras do projeto: `00_PROJECT_CONTROL`, `01_ACTIVE_TASK` (só a tarefa corrente), `02_ARCHITECTURE_RULES`, `03_DECISION_LOG`, `BACKLOG` (tarefas combinadas e ainda não iniciadas) e `PLAN_FEEDBACK_SURVEYS_NAV` (plano de Pesquisas, Feedbacks e sidebar) |
| [`agents/`](agents/) | Um papel por arquivo: MAESTRI, TASK_CLASSIFIER, PLANNER, ARCHITECT, DOMAIN_RH, FRONTEND_MOBILE, BACKEND_API, DATABASE, SECURITY, PRIVACY_LGPD, AI_REVIEWER, PERFORMANCE, QA, FINAL_REVIEWER |
| [`workflows/`](workflows/) | Rotas: LOW_RISK, MEDIUM_RISK, HIGH_RISK, UI_REDESIGN, MOTION, DATABASE_CHANGE, AI_CHANGE, RELEASE |
| [`skills/`](skills/) | SKILLS_POLICY (regra geral e precedência), UI_SKILLS, MOTION_SKILLS |
| [`domains/`](domains/) | SECURITY_FINDINGS, PRIVACY_LGPD, AI_GOVERNANCE, RH_RULES |
| [`quality/`](quality/) | TEST_MATRIX, RELEASE_CHECKLIST, DEFINITION_OF_DONE, MANUAL_TEST_CHECKLIST |
| [`design/`](design/) | UI_AUDIT, DESIGN_BRIEF (históricos), **SUPERRH_UI_V3 (vigente)**, DESIGN_TOKENS, MOTION_SYSTEM, `history/` (planos antigos) |
| [`templates/`](templates/) | ACTIVE_TASK, HANDOFF, DECISION, REVIEW, RELEASE_REPORT |

## Escolha rápida de rota

| Tarefa | Rota |
|---|---|
| Cor, texto, componente visual | `workflows/LOW_RISK.md` |
| Redesign, "deixa a tela bonita" | `workflows/UI_REDESIGN.md` |
| Animação, feedback | `workflows/MOTION.md` |
| Endpoint, CRUD, notificação, analytics | `workflows/MEDIUM_RISK.md` |
| Auth, RBAC, `company_id`, dados pessoais, férias, IA, Resend | `workflows/HIGH_RISK.md` |
| Mudança de schema | `workflows/DATABASE_CHANGE.md` |
| Groq, prompts, insights | `workflows/AI_CHANGE.md` |
| Publicar em produção | `workflows/RELEASE.md` |

## Regras que valem em qualquer rota

1. **Push em `main` ou deploy de produção nunca é decisão de agente:** exige autorização explícita do Carlo.
2. **`company_id` vem do JWT**, nunca de body, query ou frontend; empresa A nunca acessa dado da empresa B.
3. **Tarefa visual** não toca `api/`, `banco/`, auth, JWT, queries, `conexoes/` funcionais nem regras de negócio. Precisou tocar? Parar e reclassificar.
4. **Honestidade:** "skill usada" só se carregada; "testado" só se executado; "produção validada" só com teste real; "sem regressão" nunca só porque o build passou.
5. **Menor conjunto suficiente de agentes.** Não transformar tarefa simples em burocracia.
6. **Handoff padronizado** ao fim de cada etapa (`templates/HANDOFF_TEMPLATE.md`).
7. **Precedência:** pedido do usuário > regras do projeto > Maestri > arquitetura > Impeccable > motion (Emil) > Taste (referência).

O `CLAUDE.md` da raiz é a constituição curta e aponta para este índice.

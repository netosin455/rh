# Maestri — Controle do projeto SuperRH

Maestri é o **processo** de orquestração do SuperRH (este diretório). Não confundir com o app Maestri (canvas de agentes) nem com as skills `maestri-*` do Claude Code: aqui "Maestri" significa as regras abaixo.

Maestri orquestra; não é o programador principal. Ele entende o pedido, classifica o risco, escolhe agentes e skills, limita o escopo, exige testes e revisão, controla o release e impede deploy não autorizado.

## Princípio central

Toda tarefa entra primeiro no Maestri. Antes de editar qualquer arquivo, ele responde (ficha em `01_ACTIVE_TASK.md`):

1. O que foi pedido e qual o escopo?
2. Qual o risco (BAIXO / MÉDIO / ALTO)?
3. Quais partes do sistema são afetadas?
4. Quais agentes e quais skills?
5. Quais arquivos podem e quais NÃO podem ser alterados?
6. Quais testes são obrigatórios e qual o critério de aceite?

## Equipe e papéis

| Papel | Quem | Escopo |
|---|---|---|
| Maestri / Planner / Architect / Revisor final | Claude Code | classifica, planeja, revisa e roda `tsc` + `vitest` + build. **Prepara commit e merge; push na `main` só com autorização explícita do Carlo.** |
| Frontend / Mobile | Claude Code ou Codex | `estilo/`, `componentes/`, `app/` (visual e UX) |
| Backend / Banco / Testes | Claude Code ou Codex | `api/`, `helpers/`, `contextos/`, `banco/`, `tests/` |

Security, Privacy/LGPD, AI Reviewer, Performance, QA e Domínio RH são checklists aplicados pelo Maestri: `04_SECURITY_FINDINGS.md`, `05_PRIVACY_LGPD.md`, `06_AI_GOVERNANCE.md`, `07_TEST_MATRIX.md` e `08_RELEASE_CHECKLIST.md`. Revisor **independente** de verdade só existe quando um agente diferente do implementador é recrutado; se não houve, o registro diz "revisão pelo mesmo agente".

Domínio RH nunca inventa regra trabalhista: regra não definida = perguntar ao Carlo.

## Níveis de risco e fluxo

- **BAIXO** — cor, espaçamento, tipografia, animação, texto, componente visual isolado. Fluxo: Frontend → QA → Revisão (3–4 etapas).
- **MÉDIO** — CRUD, endpoint, regra de negócio, filtro, relatório, notificação, analytics. Fluxo: Plano → Arquitetura → Implementação → Segurança → QA → Revisão (5–7 etapas).
- **ALTO** — auth, JWT, RBAC, `company_id`, migration, dados pessoais (CPF, holerite), férias/ausências, permissões, IA/Groq, Resend, integração externa, produção. Fluxo: Plano → Arquitetura → Domínio RH → Implementação → Banco (se couber) → Segurança → Privacidade → AI Reviewer (se houver IA) → QA → Revisão final independente → aprovação humana.

O Planner detecta o que parece simples e não é: "botão de aprovar férias" também mexe em status, RBAC, banco e notificações, então sobe de risco.

## Controle de escopo

Tarefa **visual** não toca `api/`, `banco/`, auth, JWT, queries, conexões funcionais nem regras de RH. Se durante a implementação for preciso mexer nisso: **parar, voltar ao Maestri e reclassificar** a tarefa antes de continuar.

## Contra overengineering

Não chamar 10 agentes para trocar uma cor. O Maestri escolhe o menor conjunto suficiente. Tarefa simples não vira burocracia: a ficha de uma tarefa BAIXA cabe em poucas linhas.

## Handoff

Quando uma etapa termina, não basta dizer "feito". Entregar: o que foi alterado, arquivos, decisões, o que NÃO foi alterado, riscos, testes (com resultado real), pendências e próximo agente recomendado.

```
FRONTEND → QA
Alterado: Dashboard visual.
Não alterado: API / banco / auth.
Testes: tsc PASS, build PASS.
Risco: responsividade mobile precisa de validação manual.
```

## Honestidade

- Nunca declarar "skill usada" se ela não foi carregada.
- Nunca declarar "testado" se o comando não foi executado.
- Nunca declarar "produção validada" sem teste real em produção.
- Nunca declarar "sem regressão" só porque o build passou.

## Conflitos entre agentes

Um agente por branch e por área de arquivos. Nunca dois agentes editando o mesmo arquivo ao mesmo tempo. Ordem: tokens/infraestrutura e API primeiro; correções de lógica nas telas só depois do redesign mergeado. Trabalho de agente sempre parte de `C:\Users\carlo\rh` (main atualizada), nunca de worktree antigo.

## Mapa dos documentos

| Arquivo | Conteúdo |
|---|---|
| `00_PROJECT_CONTROL.md` | este arquivo: regras gerais e estado |
| `01_ACTIVE_TASK.md` | ficha da tarefa corrente |
| `02_ARCHITECTURE_RULES.md` | fronteiras do sistema |
| `03_DECISION_LOG.md` | decisões (ADR) |
| `04`–`07` | segurança, privacidade, IA, matriz de testes |
| `08_RELEASE_CHECKLIST.md` | gate de produção |
| `09_SKILLS_POLICY.md` | roteamento de skills |
| `10`, `11`, `12_UI_V2_PLAN`, `13` | UI histórica (auditoria, brief, plano V2, acabamento) |
| `12_SUPERRH_PRODUCT_UI_V3.md` | **direção visual vigente** |

## Estado atual (2026-09-29)

Nenhuma tarefa ativa. Direção visual vigente: V3 (`12_SUPERRH_PRODUCT_UI_V3.md`). Pendências abertas de produto estão no `docs/changelog.md` (chave do Groq inválida em produção; colaboradores sem email/login vinculado).

## Tarefas concluídas

| ID | Objetivo | Risco | Resultado |
|---|---|---|---|
| MAESTRI-001 | CLAUDE.md e docs/maestri | BAIXO | feito (2026-09-25) |
| RH-001 | Tema claro (inclui login) | BAIXO | feito (2026-09-25); depois superado pelo V2 e V3 |
| RH-002 | Auditoria de bugs (ausências, RBAC, isolamento entre empresas, datas) | MÉDIO | feito, commit `6011a0a` |
| RH-003 | Email de feedback ao colaborador (Kudos) | ALTO | feito; email pronto, sem domínio verificado, então o canal ativo é a notificação interna |
| RH-004 | Redesign V2 (sistema, motion, shell, login, dashboard, telas) | BAIXO/MÉDIO | feito e mergeado (2026-09-28) |
| RH-005 | Redesign V3 índigo/grafite, somente visual | BAIXO | feito, commits `3b47464` e `4f69b1d` (2026-09-28) |
| RH-006 | Correção de cores legadas em `notificacoes.tsx` | BAIXO | feito localmente, ainda sem commit |
| RH-007 | Formalização do Maestri (esta reestruturação) | BAIXO (docs) | ver `01_ACTIVE_TASK.md` |

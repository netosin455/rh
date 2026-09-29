# Controle do projeto — SuperRH

Caminhos deste documento e dos demais em `docs/maestri/` são relativos a `docs/maestri/`, salvo quando começam por `docs/` ou pela raiz do repositório. Índice geral: `README.md`.

Maestri aqui é o **processo** de orquestração do SuperRH, definido nesta pasta. Não confundir com o app Maestri (canvas de agentes) nem com as skills `maestri-*` do Claude Code.

## Stack atual

- **App:** React Native + Expo 55 + Expo Router, TypeScript, mobile e web (React Native Web).
- **API:** Vercel Functions (Node.js) em `api/`.
- **Banco:** PostgreSQL no Neon (`@neondatabase/serverless`), SQL parametrizado, migrations em `banco/migrations/`.
- **Auth:** JWT + bcryptjs; RBAC centralizado em `api/_lib.ts`.
- **IA:** Groq. **Email:** Resend. **Testes:** Vitest (`npm test`).
- **Tema:** tokens em `estilo/` (índigo + grafite claro, direção V3: `design/SUPERRH_UI_V3.md`).

## Ambientes

| Ambiente | Situação |
|---|---|
| Produção | Vercel, deploy automático a cada push na `main`. |
| Desenvolvimento | **Não existe banco de dev.** Rodar o app localmente pode tocar dados reais: cuidado com escritas. |
| Preview | Preview da Vercel quando houver branch; usar para teste manual antes de autorizar a `main`. |

## Regras inegociáveis

1. **Push na `main` ou deploy de produção nunca é decisão de agente.** Exige autorização explícita do Carlo, mesmo com testes e build verdes.
2. **`company_id` vem sempre do JWT** (`ctx.company_id`), nunca de body, query ou frontend. Toda query multi-tenant filtra por ele.
3. **Empresa A nunca acessa dado da empresa B** (403/404), com teste obrigatório.
4. **A UI nunca é autoridade de permissão:** a API revalida toda ação protegida.
5. **Sem dado pessoal em log** (CPF, senha, token). Email e IA recebem só o mínimo.
6. **IA sugere, resume e sinaliza; não decide** desligamento, advertência, promoção nem férias.
7. **Schema só muda por migration** com impacto e rollback descritos e OK do Carlo.
8. **Falha de efeito colateral** (email, push, cron) não quebra a operação principal.
9. **Domínio RH nunca inventa regra trabalhista:** regra indefinida = perguntar.

## Proteção da `main`

Fluxo até produção em `quality/RELEASE_CHECKLIST.md`. Resumo: tipos → testes → build → segurança/privacidade (quando aplicáveis) → revisão final → preview/teste manual → **aprovação humana** → `main` → produção. O repositório pode receber commits concorrentes: `git pull --rebase` antes de push (quando autorizado).

## Multi-tenancy

Um banco, várias empresas, isolamento por `company_id` em toda tabela de dados. Detalhes e testes: `core/02_ARCHITECTURE_RULES.md` e `quality/TEST_MATRIX.md`.

## Riscos globais

| Risco | Onde está tratado |
|---|---|
| Deploy acidental em produção | regra 1; `quality/RELEASE_CHECKLIST.md` |
| Vazamento entre empresas | regras 2 e 3; `agents/SECURITY.md` |
| Dado pessoal em log, email ou prompt de IA | `domains/PRIVACY_LGPD.md`, `domains/AI_GOVERNANCE.md` |
| Teste local tocando dado real | ambientes (acima) |
| Acento corrompido por PowerShell 5.1 | nunca reescrever arquivo com `Get-Content`/`Set-Content`; procurar `Ã` antes de commitar |
| Agente saindo do escopo | `agents/MAESTRI.md`, seção "Controle de escopo" |

## Regras de conduta dos agentes

- **Honestidade:** não declarar "skill usada" sem ter carregado a skill; "testado" sem ter executado; "produção validada" sem teste real; "sem regressão" só porque o build passou.
- **Contra burocracia:** o Maestri escolhe o menor conjunto suficiente de agentes. LOW usa 3–4 etapas, MEDIUM 5–7, HIGH o pipeline completo.
- **Um agente por branch e por área de arquivos.** Nunca dois agentes editando o mesmo arquivo. Agentes partem de `C:\Users\carlo\rh` (main atualizada), nunca de worktree antigo.
- **Handoff padronizado** ao fim de cada etapa: `templates/HANDOFF_TEMPLATE.md`.

## Estado atual do produto (2026-09-29)

- Direção visual V3 aplicada em login, sidebar, dashboard, equipe, férias e kudos; demais telas usam o design system e herdam a paleta (`design/SUPERRH_UI_V3.md`).
- Kudos notifica por canal interno; email pronto no código, sem domínio verificado no Resend.
- Nenhum dos 43 colaboradores tem email ou login vinculado (o gargalo é o cadastro).
- **Aberto:** `GROQ_API_KEY` inválida em produção (Insights de IA e chat fora do ar; `domains/SECURITY_FINDINGS.md`).
- **Aberto:** exportação em PDF ainda em dourado (`design/SUPERRH_UI_V3.md`, pendências).

## Tarefas concluídas

| ID | Objetivo | Risco | Resultado |
|---|---|---|---|
| MAESTRI-001 | CLAUDE.md e docs/maestri | BAIXO | feito (2026-09-25) |
| RH-001 | Tema claro (inclui login) | BAIXO | feito; superado por V2 e V3 |
| RH-002 | Auditoria de bugs (ausências, RBAC, isolamento, datas) | MÉDIO | feito, commit `6011a0a` |
| RH-003 | Email de feedback ao colaborador (Kudos) | ALTO | feito; canal ativo é a notificação interna |
| RH-004 | Redesign V2 (sistema, motion, shell, login, dashboard, telas) | BAIXO/MÉDIO | feito e mergeado (2026-09-28) |
| RH-005 | Redesign V3 índigo/grafite, somente visual | BAIXO | feito, `3b47464` e `4f69b1d` (2026-09-28) |
| RH-006 | Cores legadas em `notificacoes.tsx` + changelog | BAIXO | feito e publicado, `97fe4a1` (2026-09-29) |
| RH-007 | Formalizar o Maestri (regras, ADRs, gates) | BAIXO (docs) | feito, `e335e0c` (2026-09-29) |
| RH-008 | Reorganizar o Maestri em pastas (core, agents, workflows...) | BAIXO (docs) | feito (2026-09-29) |

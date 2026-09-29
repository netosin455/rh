# Tarefa ativa

Este arquivo representa **apenas a tarefa corrente**. Antes de qualquer edição o Maestri preenche a ficha; ao terminar, fecha o STATUS e move o resumo para "Tarefas concluídas" em `core/00_PROJECT_CONTROL.md`. Modelo em branco: `templates/ACTIVE_TASK_TEMPLATE.md`.

---

**TASK ID:** RH-008

**STATUS:** concluído e aprovado pelo Carlo em 2026-09-29 (commit e push autorizados).

**OBJECTIVE:** Reorganizar `docs/maestri/` em pastas (core, agents, workflows, skills, domains, quality, design, templates) e atualizar o `CLAUDE.md` para apontar para `docs/maestri/README.md`.

**TYPE:** Documentação.

**RISK:** BAIXO (nenhum código de produto).

**SCOPE:** somente `CLAUDE.md` e `docs/maestri/**`.

**AGENTS:** Claude Code (Maestri + escrita dos docs). Sem revisor independente: revisão feita pelo mesmo agente; o Carlo revisa o diff.

**SKILLS:** nenhuma carregada (documentação; nenhuma skill de design foi usada).

**ALLOWED FILES:** `CLAUDE.md`, `docs/maestri/**`.

**PROTECTED FILES:** `app/`, `componentes/`, `estilo/`, `api/`, `banco/`, `conexoes/`, `contextos/`, `helpers/`, `tipos/`, `tests/`, `package.json`.

**PLAN:**
1. Criar as pastas e mover os 13 arquivos antigos (`git mv`, preservando histórico).
2. Criar `README.md`, `agents/` (13), `workflows/` (8), `skills/` (2 novos), `domains/RH_RULES.md`, `quality/` (2 novos), `design/` (2 novos), `templates/` (5).
3. Corrigir todos os links internos.
4. Encurtar o `CLAUDE.md`.
5. `git status`, `git diff --check`, conferir que nada fora do escopo mudou.

**TESTS:** `git diff --check`; busca por `Ã` nos arquivos alterados; conferência de links; `git status` mostrando só `CLAUDE.md` e `docs/maestri/`. `tsc`, `npm test` e build não se aplicam (nenhum código alterado).

**ACCEPTANCE:** estrutura exatamente como pedida; nenhum link quebrado; nenhum arquivo de produto alterado; Carlo aprova o diff antes do commit.

**RISKS:** links antigos em outros arquivos apontando para os nomes numerados (varridos; ver relatório). Risco de processo: conteúdo novo divergir da spec original; mitigado pela revisão do Carlo.

**HANDOFF:** ao terminar, Maestri → Carlo (revisão e autorização de commit). Formato em `templates/HANDOFF_TEMPLATE.md`.

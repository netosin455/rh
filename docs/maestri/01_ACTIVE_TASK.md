# Tarefa ativa

Toda tarefa atualiza este arquivo **antes** de qualquer edição e o fecha ao terminar. O resumo histórico fica em `00_PROJECT_CONTROL.md`.

## Modelo

```
# TASK RH-XXX

Objetivo:

Escopo:

Risco: BAIXO / MÉDIO / ALTO

Agentes:

Skills:

Arquivos permitidos:

Arquivos proibidos:

Plano:

Testes:

Critérios de aceite:

Riscos:

Status:
```

## Em andamento

# TASK RH-007 — Formalizar o Maestri

Objetivo: alinhar `CLAUDE.md` e `docs/maestri/` à especificação `MAESTRI_SUPERRH.md` (classificação de risco, escopo, handoff, honestidade, gates, skills, ADRs, direção V3).

Escopo: somente documentação.

Risco: BAIXO (docs).

Agentes: Claude Code (Maestri + Frontend/docs). Sem revisor independente: revisão pelo mesmo agente; Carlo revisa o diff.

Skills: nenhuma (documentação; nenhuma skill de design carregada).

Arquivos permitidos: `CLAUDE.md`, `docs/maestri/*`.

Arquivos proibidos: `app/`, `componentes/`, `estilo/`, `api/`, `banco/`, `conexoes/`, `contextos/`, `helpers/`, `tests/`, `package.json`.

Plano: criar `12_SUPERRH_PRODUCT_UI_V3.md`; reescrever `00`, `01`, `03`, `08`, `09`; marcar `10`, `11`, `12_UI_V2_PLAN` como históricos; encurtar o bloco de workflow do `CLAUDE.md` para o ponteiro `## Maestri`.

Testes: busca por `Ã` nos arquivos alterados; `git diff` mostrando que só docs mudaram. `tsc`/`vitest` não se aplicam (nenhum código alterado).

Critérios de aceite: Carlo aprova o diff; nenhum arquivo fora do escopo alterado; sem commit e sem push até autorização.

Riscos: nenhum de produto. Risco de processo: docs divergirem da spec original; mitigado pela revisão do Carlo.

Status: escrito, aguardando revisão do Carlo. Sem commit.

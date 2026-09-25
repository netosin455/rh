# Tarefa ativa

Modelo de ficha (copiar por tarefa; o resumo fica em `00_PROJECT_CONTROL.md`).

```
ID:
Objetivo:
Módulos afetados:
Risco (BAIXO/MÉDIO/ALTO):
Agentes / dono:
Branch / worktree:
Arquivos permitidos:
Testes obrigatórios:
Critério de aceite:
Status:
```

## Em andamento

**RH-001 — Tema claro completo (inclui login)** · BAIXO · Codex · `redesign-claro` (`C:\Users\carlo\rh-visual`)
Aceite: sem hex fora de `estilo/cores.ts`; `accessibilityLabel` em botões só de ícone; texto ≥ 12 px; `tsc` sem erros novos.

**RH-002 — Auditoria de bugs** · MÉDIO · Codex #2 · `fix-feedback-email` (`C:\Users\carlo\rh-backend`)
Aceite: corrigidos os bugs claros; duvidosos em `reports/bugs_found.md`; testes passando.

**RH-003 — Email de feedback ao colaborador** · ALTO · Codex #2 · mesma branch
Aceite: helper `api/_email.ts`; falha de email não quebra a criação; destinatário da mesma empresa; teste de isolamento entre empresas; `RESEND_API_KEY` documentada.

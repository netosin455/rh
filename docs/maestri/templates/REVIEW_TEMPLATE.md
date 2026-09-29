# Review

Usado pelo Final Reviewer (`agents/FINAL_REVIEWER.md`). Pergunta principal: "Por que essa mudança NÃO deveria ser aprovada?"

```
OBJECTIVE: (pedido original e critério de aceite)
REVIEWER: (quem revisou; foi o mesmo agente que implementou? sim/não)
FILES REVIEWED: (lista, com o diff analisado)
FINDINGS: (arquivo:linha, impacto, correção sugerida)
REGRESSIONS: (comportamentos que podem ter quebrado)
SECURITY: (JWT, RBAC, company_id, IDOR, segredos, dado pessoal)
UX: (estados, responsividade, acessibilidade, motion)
VERDICT: (APROVADO | APROVADO COM RESSALVAS | REPROVADO) e o motivo
```

Buscar sempre: regressão, escopo extra, duplicação, quebra de arquitetura, problema de segurança, problema de UX, falta de teste.

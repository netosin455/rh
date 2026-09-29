# Handoff

Não aceitar apenas "feito". Cada agente, ao terminar, entrega:

```
FROM: (agente)
TO: (próximo agente recomendado)
TASK: (TASK ID e objetivo)
CHANGED: (o que foi alterado; arquivos)
NOT CHANGED: (o que foi deliberadamente deixado de fora, ex.: API / banco / auth)
TESTS: (comandos executados e resultado real: PASS/FAIL; o que NÃO foi testado)
RISKS: (riscos, ressalvas, decisões tomadas)
PENDING: (o que falta; ações do Carlo)
NEXT STEP:
```

Exemplo:

```
FROM: Frontend
TO: QA
TASK: RH-XXX Dashboard visual
CHANGED: app/(tabs)/index.tsx (composição e hierarquia)
NOT CHANGED: api/, banco/, auth
TESTS: tsc PASS, build web PASS; teste manual mobile ainda NÃO feito
RISKS: responsividade em 390 px precisa de validação manual
PENDING: teste manual
NEXT STEP: QA executa quality/MANUAL_TEST_CHECKLIST.md
```

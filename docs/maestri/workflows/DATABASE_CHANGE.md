# Workflow DATABASE_CHANGE

**Quando:** qualquer mudança de schema, índice, constraint ou FK. Risco: **HIGH**.

```
Maestri → Planner → Architect → Database → Backend/API → Security → QA → Final Reviewer → aprovação do Carlo → aplicar
```

## Regras

1. **Nunca alterar schema manualmente em produção.** Toda mudança estrutural tem migration numerada em `banco/migrations/`.
2. A migration é idempotente e descreve **impacto** e **rollback**.
3. Não existe banco de desenvolvimento: testar contra dados reais é arriscado. Preferir verificações somente leitura; escrita só com autorização.
4. Ordem de deploy: **migration antes do código que a usa** (ADR-004), senão o código novo quebra.
5. Aprovação explícita do Carlo antes de aplicar em produção.
6. Após aplicar: consulta de verificação e registro em `docs/changelog.md`.

## Checklist

- [ ] Migration numerada e idempotente
- [ ] Impacto descrito (tabelas, lock, volume)
- [ ] Rollback descrito e testável
- [ ] Toda tabela nova de dados tem `company_id` e índice apropriado
- [ ] Código que a usa está pronto, mas só sobe depois da migration
- [ ] OK do Carlo registrado
- [ ] Segurança e privacidade revisadas se houver dado pessoal

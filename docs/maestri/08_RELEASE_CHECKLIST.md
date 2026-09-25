# Checklist de release (gate de produção)

Push na `main` deploya em produção. Nada sobe sem todos os itens aplicáveis.

- [ ] `npx tsc --noEmit` sem erros novos em relação à linha de base
- [ ] `npm test` passando (inclui teste de isolamento entre empresas quando a mudança toca dados)
- [ ] Busca por `Ã` nos arquivos alterados (acento corrompido) sem ocorrências
- [ ] **Segurança:** JWT validado antes da lógica; role por constante de `_lib.ts`; SQL parametrizado; sem IDOR; sem segredo/CPF em log ou email
- [ ] **Privacidade** (se houver dado pessoal): conteúdo mínimo; destinatário da mesma empresa
- [ ] Migration (se houver): numerada, idempotente, rollback descrito, OK do Carlo
- [ ] Novas variáveis de ambiente listadas (ex.: `RESEND_API_KEY`) e configuradas na Vercel
- [ ] `docs/changelog.md` atualizado
- [ ] Preview na Vercel testado (login, fluxo alterado, web e mobile)
- [ ] Revisão final por quem não implementou
- [ ] Carlo autoriza → merge na `main` → push → conferir o deploy

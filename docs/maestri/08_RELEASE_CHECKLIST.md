# Checklist de release (gate de produção)

Push na `main` deploya em produção (Vercel). **Nenhum agente decide push ou deploy sozinho.** Mesmo com testes e build verdes, mesmo que a tarefa pareça simples: exige autorização explícita do Carlo.

Fluxo: código completo → tipos → testes → build → segurança → privacidade (quando aplicáveis) → revisão final → preview / teste manual → **aprovação humana** → `main` → produção.

Nada sobe sem todos os itens aplicáveis:

- [ ] `npx tsc --noEmit` sem erros novos em relação à linha de base
- [ ] `npm test` passando (inclui teste de isolamento entre empresas quando a mudança toca dados)
- [ ] `npx expo export --platform web` sem erro
- [ ] Busca por `Ã` nos arquivos alterados (acento corrompido) sem ocorrências
- [ ] Tarefa visual: `git diff --stat` sem nenhuma linha em `api/`, `banco/`, auth ou regras de negócio
- [ ] **Segurança:** JWT validado antes da lógica; role por constante de `_lib.ts`; SQL parametrizado; sem IDOR; sem segredo/CPF em log ou email
- [ ] **Privacidade** (se houver dado pessoal): conteúdo mínimo; destinatário da mesma empresa
- [ ] **IA** (se houver Groq/prompt): checklist de `06_AI_GOVERNANCE.md`
- [ ] Migration (se houver): numerada, idempotente, rollback descrito, OK do Carlo
- [ ] Novas variáveis de ambiente listadas (ex.: `RESEND_API_KEY`, `GROQ_API_KEY`) e configuradas na Vercel
- [ ] `docs/changelog.md` atualizado
- [ ] Teste manual da tela afetada (login, fluxo alterado, web e celular). Preview da Vercel quando houver
- [ ] Revisão final registrada; se foi feita pelo mesmo agente que implementou, dizer isso
- [ ] Handoff entregue (o que mudou, o que não mudou, testes com resultado real, pendências)
- [ ] **Carlo autoriza** → merge na `main` → push → conferir o deploy

Só se declara "testado" o que foi executado, e "sem regressão" nunca se conclui só porque o build passou.

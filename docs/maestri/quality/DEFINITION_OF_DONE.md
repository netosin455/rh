# Definition of Done

Uma tarefa só é chamada de **concluída** quando todos os itens aplicáveis abaixo forem verdadeiros e verificáveis. "Feito" sem evidência não conta.

## Para qualquer tarefa

- [ ] A ficha em `core/01_ACTIVE_TASK.md` tem objetivo, escopo, arquivos permitidos e critério de aceite, e o critério foi atendido.
- [ ] O diff só contém arquivos do escopo (`git status` conferido).
- [ ] `npx tsc --noEmit` sem erros novos (linha de base registrada).
- [ ] `npm test` passando.
- [ ] `npx expo export --platform web` sem erro (quando `app/`, `componentes/` ou `estilo/` mudaram).
- [ ] Busca por `Ã` nos arquivos alterados sem acento corrompido.
- [ ] Teste manual da tela ou fluxo afetado (`quality/MANUAL_TEST_CHECKLIST.md`).
- [ ] `docs/changelog.md` atualizado.
- [ ] Handoff entregue (`templates/HANDOFF_TEMPLATE.md`), com pendências e riscos.
- [ ] Revisão registrada (independente quando o workflow exige; senão declarada como "pelo mesmo agente").

## Se a tarefa tocou dados, auth ou integração

- [ ] Teste de isolamento entre empresas (token A não acessa recurso B).
- [ ] Security e Privacy: PASS registrados.
- [ ] IA: AI Reviewer PASS (`workflows/AI_CHANGE.md`).
- [ ] Migration numerada, com rollback, e OK do Carlo (`workflows/DATABASE_CHANGE.md`).

## Se for para produção

- [ ] Gates de `quality/RELEASE_CHECKLIST.md` cumpridos.
- [ ] **Autorização explícita do Carlo** para push na `main`.
- [ ] Deploy conferido depois do push. "Produção validada" só se houve teste real em produção.

## Não conta como concluído

- Build verde sem teste manual em mudança de UI.
- "Sem regressão" deduzido só do build.
- Skill "usada" que não foi carregada.
- Correção que ainda depende de ação do Carlo não registrada como pendência (ex.: chave do Groq).

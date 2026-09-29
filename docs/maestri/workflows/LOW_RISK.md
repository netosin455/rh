# Workflow LOW (risco baixo)

**Quando:** cor, espaçamento, tipografia, animação, texto, componente visual isolado, correção pequena de UI. Critérios completos: `agents/TASK_CLASSIFIER.md`.

```
Maestri → Frontend/Builder → QA → Reviewer
```

| Etapa | Quem | Saída |
|---|---|---|
| 1. Ficha | `agents/MAESTRI.md` | Ficha curta em `core/01_ACTIVE_TASK.md` (escopo, arquivos permitidos e protegidos) |
| 2. Implementar | `agents/FRONTEND_MOBILE.md` | Mudança visual; lógica preservada |
| 3. QA | `agents/QA.md` | `npx tsc --noEmit`, `npm test` e build web; teste manual da tela |
| 4. Revisão | `agents/FINAL_REVIEWER.md` | Veredito (pode ser revisão pelo mesmo agente, registrada como tal) |

Regras:
- 3 a 4 etapas. Não convocar Security, Privacy, Database ou AI Reviewer.
- Se a mudança precisar tocar `api/`, `banco/`, auth, queries ou regras de negócio: **parar e reclassificar** para MEDIUM ou HIGH.
- Trabalho de UI ou motion segue `workflows/UI_REDESIGN.md` ou `workflows/MOTION.md`.
- Release: `workflows/RELEASE.md`. Push na `main` só com autorização explícita do Carlo.

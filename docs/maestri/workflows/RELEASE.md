# Workflow RELEASE

**Push na `main` = deploy automático em produção (Vercel).** Nenhum agente decide push ou deploy sozinho: exige autorização explícita do Carlo, mesmo com testes e build verdes.

```
CODE COMPLETE → TYPECHECK → TESTS → BUILD → SECURITY → PRIVACY
             → FINAL REVIEW → PREVIEW / TESTE MANUAL → APROVAÇÃO HUMANA → MAIN → PRODUÇÃO
```

SECURITY e PRIVACY entram quando aplicáveis (ver o risco da tarefa).

| Gate | Comando ou ação | Quem |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | QA |
| Tests | `npm test` | QA |
| Build | `npx expo export --platform web` | QA |
| Segurança / Privacidade | `agents/SECURITY.md`, `agents/PRIVACY_LGPD.md` | Security / Privacy |
| Revisão final | `templates/REVIEW_TEMPLATE.md` | Final Reviewer |
| Preview / manual | `quality/MANUAL_TEST_CHECKLIST.md` | QA |
| Aprovação humana | Carlo autoriza | Carlo |
| Main / Produção | `git pull --rebase`, `git push origin main`, conferir o deploy | Maestri, **só depois da autorização** |

O relatório final segue `templates/RELEASE_REPORT_TEMPLATE.md`. Checklist completo: `quality/RELEASE_CHECKLIST.md`.

Migration envolvida? Ela sobe **antes** do código (`workflows/DATABASE_CHANGE.md`).

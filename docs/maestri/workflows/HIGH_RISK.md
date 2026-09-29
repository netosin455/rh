# Workflow HIGH (risco alto)

**Quando:** autenticação, JWT, RBAC, `company_id`, migration, dados pessoais (CPF, holerite), férias e ausências, permissões, IA/Groq, Resend, integração externa, produção.

```
Maestri → Planner → Architect → Domain RH → Builder
        → Database (se necessário) → Security → Privacy
        → AI Reviewer (se necessário) → QA → Final Reviewer → aprovação humana
```

| Etapa | Quem | Saída |
|---|---|---|
| 1. Ficha | `agents/MAESTRI.md` | Ficha completa; arquivos protegidos explícitos |
| 2. Plano | `agents/PLANNER.md` | Plano com rollback |
| 3. Arquitetura | `agents/ARCHITECT.md` | Fronteiras e contratos |
| 4. Domínio | `agents/DOMAIN_RH.md` | Parecer de regra de RH (`domains/RH_RULES.md`); dúvida vai ao Carlo |
| 5. Implementar | `agents/BACKEND_API.md`, `agents/FRONTEND_MOBILE.md` | Código e testes |
| 6. Banco | `agents/DATABASE.md` | Migration com impacto e rollback (`workflows/DATABASE_CHANGE.md`) |
| 7. Segurança | `agents/SECURITY.md` | PASS/FAIL |
| 8. Privacidade | `agents/PRIVACY_LGPD.md` | PASS/FAIL |
| 9. IA | `agents/AI_REVIEWER.md` | PASS/FAIL (`workflows/AI_CHANGE.md`) |
| 10. QA | `agents/QA.md` | Todos os gates com resultado real |
| 11. Revisão final | `agents/FINAL_REVIEWER.md` | Revisor **independente** de quem implementou |
| 12. Aprovação | Carlo | Autoriza (ou não) merge e push |

Regras:
- Pipeline completo, mas só as etapas aplicáveis (Banco só se houver migration; IA só se houver Groq).
- Preview ou teste manual antes de pedir autorização.
- Se não houve revisor independente, o relatório diz "revisão pelo mesmo agente".
- Release: `workflows/RELEASE.md`.

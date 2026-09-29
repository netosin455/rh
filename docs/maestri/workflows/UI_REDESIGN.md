# Workflow UI_REDESIGN

**Quando:** "deixa o Dashboard bonito", redesign de tela, componente novo, consistência visual. Risco normal: LOW ou MEDIUM (visual).

```
Maestri
  ↓ Skill Preflight
  ↓ Impeccable Audit
  ↓ Impeccable Critique
  ↓ Taste / Redesign Reference
  ↓ Frontend
  ↓ Motion Review
  ↓ Impeccable Polish
  ↓ QA
  ↓ Final Review
```

## Antes de codar (o Maestri responde, não sai codando)

```
TASK TYPE: UI REDESIGN
RISK: LOW/MEDIUM
AGENTS: Frontend, QA, Reviewer
SKILLS: Impeccable, redesign-existing-projects, Taste (referência), motion (Emil)
PROTECTED: API, DB, Auth
```

## Etapas

| Etapa | O que fazer | Referência |
|---|---|---|
| Skill Preflight | Conferir quais skills existem na sessão; registrar na ficha; avisar se alguma faltar | `skills/SKILLS_POLICY.md` |
| Impeccable Audit / Critique | Diagnosticar hierarquia, contraste, espaçamento, estados | `skills/UI_SKILLS.md` |
| Taste / Redesign Reference | Usar como referência estética, nunca como autoridade sobre arquitetura ou stack | `skills/UI_SKILLS.md` |
| Frontend | Implementar só a pele: aparência, composição, hierarquia, responsividade | `agents/FRONTEND_MOBILE.md`, `design/SUPERRH_UI_V3.md`, `design/DESIGN_TOKENS.md` |
| Motion Review | Onde motion comunica estado; nada decorativo | `workflows/MOTION.md`, `design/MOTION_SYSTEM.md` |
| Impeccable Polish | Acabamento: alinhamento, estados, contraste | `skills/UI_SKILLS.md` |
| QA | tsc, testes, build web, `quality/MANUAL_TEST_CHECKLIST.md` | `agents/QA.md` |
| Final Review | Revisão com `templates/REVIEW_TEMPLATE.md` | `agents/FINAL_REVIEWER.md` |

## PROTEGIDO (nunca alterar num redesign)

`api/`, `banco/`, auth, JWT, RBAC, queries, `conexoes/` funcionais e regras de negócio. Se for preciso tocar em algum: **parar, voltar ao Maestri e reclassificar.**

## Honestidade

Só se diz "skill usada" se a skill foi carregada e seguida. Skill instalada mas não carregada não conta.

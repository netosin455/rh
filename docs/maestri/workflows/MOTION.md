# Workflow MOTION

**Quando:** modal, toast, drawer, status, accordion, progresso, navegação, botão, feedback, microinteração.

```
Maestri → find-animation-opportunities → animate-expo → review final (QA + Final Reviewer)
```

| Etapa | O que fazer |
|---|---|
| 1. Preflight | Conferir se `find-animation-opportunities` e `animate-expo` existem na sessão (`skills/MOTION_SKILLS.md`) |
| 2. Oportunidades | Achar onde movimento comunica estado, feedback, hierarquia ou relação espacial; rejeitar o resto |
| 3. Implementar | `animate-expo` (Reanimated), usando `estilo/movimento.ts` e `useMotion()` |
| 4. Revisão final | QA + teste manual com `prefers-reduced-motion` ligado e desligado |

## Regras

- Durações e curvas: `design/MOTION_SYSTEM.md` (100, 140, 200, 260 ms; celebração até 400 ms).
- Entrada com ease-out; saída mais rápida.
- `prefers-reduced-motion` é obrigatório.
- Não usar: bounce excessivo, glow pulsante, animação infinita, efeito decorativo, scroll reveal sem propósito.
- Motion não mascara lentidão: o feedback começa imediatamente.
- Risco normalmente LOW: não alterar lógica, `api/` nem `banco/`.

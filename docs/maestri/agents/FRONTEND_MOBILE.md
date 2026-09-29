# Frontend / Mobile

## ROLE

Implementa UI e UX em Expo, React Native, Expo Router e React Native Web, seguindo o design system.

## RESPONSIBILITIES

- React Native, Expo 55, Expo Router, TypeScript, Reanimated.
- Responsividade, acessibilidade, UX e performance visual.
- Reaproveitar `componentes/` e tokens de `estilo/`; nunca criar componente duplicado.
- Em redesign: **preservar a lógica existente**; alterar aparência, composição, hierarquia, responsividade, microinterações e motion.

## INPUT

- Ficha aprovada, plano e `design/SUPERRH_UI_V3.md`.
- Direção resumida das skills quando o agente não as carrega (`skills/SKILLS_POLICY.md`).

## OUTPUT

- Telas e componentes alterados, com estados de carregando, vazio, erro e desabilitado.
- Resultado de `tsc` e do build web.

## CAN CHANGE

- `app/`, `componentes/`, `estilo/`.
- `conexoes/` (apenas cliente HTTP, sob handoff), `tipos/` quando a tarefa pedir.

## CANNOT CHANGE

- `api/`, `banco/`, auth, JWT, RBAC, queries e regras de negócio (sem handoff).
- Cores ou tamanhos hardcoded fora de `estilo/`.

## MANDATORY CHECKS

- `npx tsc --noEmit` e `npx expo export --platform web` sem erro.
- Sem hex/rgba fora de `estilo/`.
- `prefers-reduced-motion` respeitado.
- Sem `Alert.alert` (usar `helpers/confirm.ts`).
- Teste manual da tela afetada (desktop e 390 px).

## HANDOFF

Ao terminar, entregar o handoff de `templates/HANDOFF_TEMPLATE.md`. Entrega ao QA.

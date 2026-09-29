# Skills de UI

Uso e precedência gerais: `skills/SKILLS_POLICY.md`. **Não assumir que uma skill existe: fazer o preflight.** Conferido em 2026-09-29; recheque a cada tarefa.

## Impeccable (`impeccable`, disponível)

Uma skill única; os itens abaixo são **modos** dela.

| Modo | Para quê |
|---|---|
| audit | Diagnóstico técnico da interface: hierarquia, contraste, espaçamento, acessibilidade |
| critique | Crítica de UX e design de uma tela ou fluxo |
| extract | Extrair tokens e componentes reutilizáveis |
| polish | Acabamento final: alinhamento, estados, detalhes |
| document | Documentar o sistema de design |

## Taste (referência estética, nunca autoridade)

| Skill | Situação | Uso |
|---|---|---|
| `design-taste-frontend` | disponível | Direção estética para páginas e interfaces |
| `redesign-existing-projects` | disponível | Elevar um app existente sem quebrar funcionalidade |
| `minimalist-ui` | disponível | Referência de interface limpa e editorial |
| `high-end-visual-design` | disponível | Referência de acabamento premium |

**Taste não obriga:** Tailwind, Framer Motion, Phosphor, dark mode, biblioteca nova ou troca de stack. O SuperRH é Expo/React Native com tokens em `estilo/`.

## Extra

`mobile-native` (sensação nativa no web mobile): disponível; usar quando o trabalho é sobre toque, viewport e comportamento mobile na web.

## Como o Maestri usa

Rotas em `workflows/UI_REDESIGN.md`. Agentes que não carregam skills (ex.: Codex) recebem no prompt um resumo da direção que a skill definiu e a referência `design/SUPERRH_UI_V3.md`.

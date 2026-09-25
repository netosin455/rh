# Política de skills (roteamento do Maestri)

As skills ficam instaladas globalmente no Claude Code. O Maestri decide quando usar cada uma, conforme o tipo da tarefa. Não se usa "todas as skills em toda tarefa": mexer em SQL ou auth não carrega skill de design.

## Pré-flight (antes de trabalho de UI ou motion)

1. Conferir quais skills existem na lista disponível da sessão.
2. Registrar no início da tarefa quais serão usadas e em que ordem.
3. Se uma skill esperada não existir, avisar o Carlo antes de implementar (não trocar em silêncio).

Skills esperadas hoje: `impeccable`, `design-taste-frontend`, `redesign-existing-projects`, `minimalist-ui`, `high-end-visual-design`, `emil-design-eng`, `animate`, `animate-expo`, `find-animation-opportunities`, `improve-animations`, `animation-vocabulary`, `mobile-native`. Não instalada: `review-animations` (avisar se for necessária).

## Roteamento

| Tarefa | Skills, em ordem |
|---|---|
| Redesign / tela nova / componente visual | `impeccable` (audit/critique) → `redesign-existing-projects` → implementar → `impeccable` (polish) |
| Direção estética | `design-taste-frontend`, `minimalist-ui`, `high-end-visual-design` como referência, nunca como autoridade sobre a arquitetura |
| Animação, transição, microinteração no app (Expo) | `find-animation-opportunities` → `animate-expo` → `improve-animations` só se pedido |
| Animação na web pura | `animate`; vocabulário via `animation-vocabulary` |
| Sensação nativa no web mobile | `mobile-native` |
| Backend, banco, auth, RBAC, email | nenhuma skill de design; aplicar checklist de segurança e privacidade |

## Precedência

1. Regras do projeto (`CLAUDE.md`, `docs/maestri/02_ARCHITECTURE_RULES.md`)
2. Maestri (níveis de risco e gates)
3. Impeccable
4. Skills de motion
5. Taste (referência estética)

Nenhuma skill sobrescreve regra de arquitetura ou segurança. Motion deve comunicar estado, feedback, hierarquia ou relação espacial; sem animação decorativa, bounce ou movimento que atrase ação frequente.

## Agentes Codex

Codex não carrega estas skills. Quando delegar UI, o Maestri resume no prompt a direção que a skill definiu (tokens, hierarquia, o que evitar) e a referência visual, em vez de pedir que o Codex "use a skill".

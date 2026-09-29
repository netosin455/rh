# Skills de motion

Uso e precedência gerais: `skills/SKILLS_POLICY.md`. **Não assumir existência: fazer o preflight.** Conferido em 2026-09-29.

| Skill | Situação | Quando usar |
|---|---|---|
| `find-animation-opportunities` | disponível | Procurar onde motion realmente ajuda (somente leitura, propõe valores) |
| `animate-expo` | disponível | Implementar animação no app Expo/React Native (Reanimated, gestos, haptics) |
| `animate` | disponível | Animação na **web pura** (não é o caso do app Expo) |
| `animation-vocabulary` | disponível | Traduzir "aquele efeito de..." para o termo técnico |
| `improve-animations` | disponível | Auditoria e plano de motion existente; só quando pedido |
| `emil-design-eng` | disponível | Filosofia de polimento e decisões de animação |
| `review-animations` | **ausente** | Não instalada: registrar como ausente e avisar se for necessária |

## Rota padrão

`find-animation-opportunities` → `animate-expo` → revisão final (`workflows/MOTION.md`).

## Limites

Base de tempos e proibições em `design/MOTION_SYSTEM.md`. Motion comunica estado, feedback, hierarquia ou relação espacial; nunca é decorativo.

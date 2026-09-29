# Política de skills (roteamento do Maestri)

Skill é ferramenta; o projeto é a autoridade. O Maestri decide **quando** cada skill entra. Não se carregam skills indiscriminadamente: mexer em SQL, auth, RBAC ou email não carrega skill de design.

## Skill preflight (obrigatório antes de trabalho de UI ou motion)

1. Conferir na lista de skills da sessão quais existem de fato.
2. Registrar em `01_ACTIVE_TASK.md` quais serão usadas e em que ordem.
3. Se uma skill esperada não existir, avisar o Carlo antes de implementar (não trocar em silêncio) e registrar como ausente.
4. **Só se diz "skill usada" depois de a skill ter sido carregada e seguida.** Estar instalada não conta.

Conferido em 2026-09-29:

| Grupo | Skills | Situação |
|---|---|---|
| Impeccable | `impeccable` (audit, critique, extract, polish, document e demais são modos da mesma skill) | disponível |
| Taste | `design-taste-frontend`, `redesign-existing-projects`, `minimalist-ui`, `high-end-visual-design` | disponíveis |
| Motion / Emil | `emil-design-eng`, `find-animation-opportunities`, `animate`, `animate-expo`, `animation-vocabulary`, `improve-animations` | disponíveis |
| Extra | `mobile-native` (sensação nativa no web mobile) | disponível |
| Ausente | `review-animations` | **não instalada**; registrar e avisar se for necessária |

Rechecar a cada tarefa: a lista muda entre sessões.

## Roteamento

| Tarefa | Skills, em ordem |
|---|---|
| Melhorar / redesenhar tela ("deixa o Dashboard bonito") | `impeccable` (audit → critique) → `redesign-existing-projects` → `minimalist-ui` / `design-taste-frontend` como referência → implementar → `find-animation-opportunities` → `animate-expo` → `impeccable` (polish) → QA → revisão final |
| Componente ou tela nova | `impeccable` (critique) → `redesign-existing-projects` → implementar → `impeccable` (polish) |
| Extrair tokens/componentes, documentar o sistema | `impeccable` (extract, document) |
| Animação, transição, microinteração no app (Expo) | `find-animation-opportunities` → `animate-expo`; `emil-design-eng` para decisão de polimento; `improve-animations` só se pedido auditoria |
| Animação em web pura | `animate`; vocabulário via `animation-vocabulary` |
| Modal, toast, drawer, status, accordion, progresso, navegação, botão, feedback | `find-animation-opportunities` → `animate-expo` → revisão final |
| Sensação nativa no web mobile | `mobile-native` |
| Backend, banco, auth, RBAC, email, IA | nenhuma skill de design; checklists de `04`, `05`, `06` |

## Precedência

1. Pedido do usuário
2. Regras do projeto (`CLAUDE.md`, `02_ARCHITECTURE_RULES.md`)
3. Maestri (risco, escopo, gates)
4. Arquitetura
5. Impeccable
6. Motion / Emil
7. Taste (referência estética)

**Taste nunca obriga** Tailwind, Framer Motion, Phosphor, dark mode, biblioteca nova ou troca de stack. Nenhuma skill sobrescreve arquitetura, segurança ou escopo da tarefa.

## Motion

Base em `estilo/movimento.ts` e `12_SUPERRH_PRODUCT_UI_V3.md`: instant 100 ms, fast 140, normal 200, estrutural 260, celebração até 400. Entrada ease-out, saída mais rápida, `prefers-reduced-motion` obrigatório. Motion comunica estado, feedback, hierarquia ou relação espacial; sem bounce excessivo, glow pulsante, animação infinita, efeito decorativo ou scroll reveal sem propósito. Motion não mascara lentidão: o feedback começa na hora.

## Agentes que não carregam skills

Agentes externos (ex.: Codex) não carregam as skills do Claude Code. Ao delegar UI, o Maestri resume no prompt a direção que a skill definiu (tokens, hierarquia, o que evitar) e aponta `12_SUPERRH_PRODUCT_UI_V3.md`, em vez de pedir que o agente "use a skill".

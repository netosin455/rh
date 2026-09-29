> **HISTÓRICO (2026-09-29).** Plano do V2 (sistema, motion, shell, login, dashboard, telas), concluído e mergeado em 2026-09-28. A direção visual vigente é `12_SUPERRH_PRODUCT_UI_V3.md`. Este arquivo fica só como registro; onde citar dourado, Cormorant, tema bege ou o Araujo Prev como identidade, vale o V3.

# Plano de redesign V2 — SuperRH

Status: **PLANO. Nada disso foi implementado.** Aguarda aprovação do Carlo antes de qualquer edição de UI.
Contexto: a direção visual foi trocada quatro vezes seguidas (escuro, claro, correção do claro, login copiado do Araujo Prev). Este plano fecha a direção e define a ordem: sistema → shell → motion → telas → polish.

## 0. Preflight de skills (política em `09_SKILLS_POLICY.md`)

| Skill | Situação |
|---|---|
| `impeccable` (audit, critique, polish, extract, layout, adapt, harden, typeset) | instalada |
| `redesign-existing-projects`, `minimalist-ui`, `design-taste-frontend` (referência), `high-end-visual-design` | instaladas |
| `find-animation-opportunities`, `animate-expo`, `animate`, `improve-animations`, `animation-vocabulary`, `emil-design-eng`, `mobile-native` | instaladas |
| `review-animations` | **ausente** (apenas registrado) |

Leitura obrigatória feita: `10_UI_AUDIT.md`, `11_DESIGN_BRIEF.md`, `09_SKILLS_POLICY.md`.
Os Codex não carregam skills: o Maestri traduz cada decisão abaixo em instrução concreta no prompt.

## 1. Problemas atuais (com evidência)

1. **Sem sistema de design de fato.** Existem 7 componentes (`Badge, Button, Card, EmptyState, Input, Modal, ScreenHeader`), mas as telas ainda os reimplementam: telas de 486 a 954 linhas com estilos próprios.
2. **Login voltou a ter valores próprios.** `app/login.tsx` tem hex no arquivo (`#0F0F0F`, `#1A1510`, `#FFFDF8`, `#B8973A`, `rgba(...)`), um `Field` local (duplica `componentes/Input.tsx`), e dois halos grandes. Contradiz "tokens sempre" e "consistência antes de novidade".
3. **Identidade emprestada.** O login copia o Araujo Prev; o SuperRH não tem cara própria.
4. **Dashboard sem hierarquia.** `app/(tabs)/index.tsx` tem 810 linhas, sendo ~540 de `LegacyDashboardScreen` morto ainda no arquivo. A tela ativa põe alertas, métricas, agenda, equipe e insights com o mesmo peso.
5. **Navegação plana.** Nove destinos com o mesmo peso na sidebar; no celular, 5 abas + "Mais" sem agrupamento.
6. **Telas só recoloridas.** Férias, Agenda, Avisos, Kudos, Analytics, Admin, Pesquisas, Onboarding, Detalhe do colaborador e IA ainda têm o layout antigo com cores novas.
7. **Motion inexistente ou ad hoc.** Só `FadeInDown` solto em algumas telas; sem tokens, sem feedback de toque, sem respeito a "reduzir movimento".
8. **Acessibilidade e contraste.** Dourado `#B8973A` sobre branco = 2,8:1 (não serve para texto pequeno). Poucos `accessibilityLabel` fora dos componentes novos.
9. **Verificação furada.** O `tsc` do projeto só cobre `api/`; o gate real de UI é `expo export --platform web` e teste visual.
10. **Código morto e hex restantes.** `LegacyDashboardScreen`; hex de categoria em `admin.tsx`, `analytics.tsx`, `notificacoes.tsx`, `onboarding/[id].tsx`, `pesquisas/[id].tsx`, `colaborador/[id].tsx`.

Preservar (não reverter): fallback de fontes com timeout em `app/_layout.tsx`; Dashboard sem chamada sem sessão; `helpers/confirm.ts`; regras de perfil das abas.

## 2. Proposta visual V2

**Posicionamento:** SaaS de RH moderno, profissional e calmo. Identidade jurídica só nos detalhes. Referência conceitual: Linear/Notion (densidade limpa, muito espaço, hierarquia), não o Araujo Prev.

- **Superfícies:** fundo off-white quente, cartões brancos, sidebar grafite, texto quase preto.
- **Dourado só como accent:** botão primário, indicador ativo, um detalhe da marca. Nunca texto pequeno sobre branco; para texto dourado usa-se o dourado profundo `#7A6220` (5,8:1).
- **Status:** verde, azul, vermelho e âmbar só para estado (ativo, licença, pendente, erro).
- **Tipografia:** Inter para toda a UI; Cormorant Garamond só na marca e em títulos especiais (não em todo cabeçalho de tela).
- **Forma:** raios consistentes (8 controle / 12 cartão), borda de 1 px muito sutil, sombra mínima (só elevação de overlay), bastante espaço.
- **Densidade:** menos bordas e sombras; separar por espaço e por peso tipográfico antes de separar por caixa.

**Login V2 (decisão a confirmar):** simples, elegante, pouco texto, muito espaço. Cartão único centralizado sobre fundo grafite liso ou off-white (sem gradiente pesado, sem halos gigantes). Usa `Input` e `Button` compartilhados; erro inline com ícone; um único detalhe dourado (fio ou marca). Sem `Field` local e sem hex no arquivo da tela.

## 3. Design system V2 (Fase 1)

Tudo em `estilo/`, e nenhuma tela define valor visual próprio.

| Arquivo | Conteúdo |
|---|---|
| `estilo/cores.ts` | tokens semânticos (superfície, texto, borda, accent, status, sidebar, foco); aliases legados marcados como `@deprecated` |
| `estilo/espaco.ts` | escala de espaçamento, raios, sombras/elevação, alvos de toque (44) |
| `estilo/tipografia.ts` | escala (display, título, corpo, legenda), pesos, alturas de linha |
| `estilo/movimento.ts` | durações, curvas, hook `useMotion()` que já respeita "reduzir movimento" |

Gradientes e halos deixam de existir dentro de telas. Se algum efeito for parte da identidade, vira componente (`BrandMark`, `AccentRule`).

**Componentes base**

| Já existe (revisar) | A criar |
|---|---|
| Button, Input, Card, Badge, Modal, EmptyState, ScreenHeader | Drawer/Sheet, Skeleton, MetricCard, Section, ListRow, Avatar, StatusPill, ProgressBar |
| Toast: existe em `contextos/Toast.tsx`; padronizar visual e movimento | AppShell, Sidebar, Topbar, TabBarMobile, BrandMark |

Regra: **proibido recriar componente dentro de tela.** Se faltar, cria-se em `componentes/` primeiro.

## 4. Motion system (Fase 2)

Biblioteca: `react-native-reanimated` (já instalada, ~4.3). Respeito a "reduzir movimento": `useReducedMotion()`; nesse modo, troca-se movimento por fade curto ou mudança instantânea de estado (o estado continua comunicado).

| Token | Duração | Uso |
|---|---|---|
| `instant` | 100 ms | feedback de toque (press) |
| `fast` | 140 ms | hover, troca de estado de badge, foco |
| `normal` | 200 ms | modal, toast, accordion |
| `structural` | 280 ms | drawer, indicador da sidebar, transição de tab |

Curvas: `ease-out` para entrada, `ease-in` para saída, spring curta e sem bounce só no indicador da sidebar.

**Movimentos previstos (todos com função):** press leve em botões e cards clicáveis; indicador ativo da sidebar que desliza; modal com fade + scale curto; drawer lateral; toast desliza e some; skeleton durante carregamento; badge de status com transição de cor; progresso (férias/onboarding) animando até o novo valor; destaque temporário em linha recém-alterada; accordion suave; transição contínua entre abas.

**Proibido:** bounce exagerado, animação infinita, glow pulsante, movimento decorativo, qualquer animação > 300 ms em ação frequente.
Antes de implementar: rodar `find-animation-opportunities` nas telas e `animate-expo` na implementação.

## 5. Shell e navegação (Fase 3, antes das telas)

**Web largo (≥ 960 px):** sidebar grafite com marca SuperRH, ícone + rótulo, indicador ativo animado, grupos e topbar simples (título da tela, busca opcional, notificações, perfil, sair).

| Grupo | Destinos |
|---|---|
| Visão geral | Dashboard |
| Pessoas | Equipe, Onboarding |
| Gestão | Férias, Agenda |
| Comunicação | Avisos, Kudos, Pesquisas |
| Inteligência | Analytics, Assistente (IA) |
| Administração | Admin (só super_admin) |

Regras de perfil continuam as atuais (Analytics e Admin restritos). Grupos vazios para o perfil não aparecem.

**Celular:** no máximo 4 ações principais + "Mais": Dashboard, Equipe, Férias, Agenda, e "Mais" abre uma folha (Sheet) com os grupos restantes.

## 6. Dashboard (Fase 5)

Hierarquia: 1) saudação e contexto; 2) o que precisa de atenção (férias pendentes, onboarding atrasado, alertas), com peso alto; 3) métricas principais, visualmente leves (`MetricCard` sem borda/sombra forte); 4) agenda e prazos; 5) equipe; 6) insights secundários, recolhíveis. Quatro níveis de ênfase: urgente, importante, informativo, secundário. Remover `LegacyDashboardScreen`.

## 7. Ordem de execução e telas (Fases 1 a 6)

| Fase | Entrega | Dono |
|---|---|---|
| 0 | Auditoria e este plano | Maestri (concluído) |
| 1 | Tokens + componentes base | Codex |
| 2 | Motion tokens e `useMotion` | Codex |
| 3 | Shell e navegação | Codex |
| 4 | Login V2 | Codex |
| 5 | Dashboard | Codex |
| 6 | Equipe → Férias → Agenda → Avisos → Kudos → Analytics → Admin → Pesquisas → Onboarding → Detalhe → IA | Codex, **uma tela por vez** |

Gate por tela (só avança se passar): `impeccable polish` (Maestri) → teste responsivo (celular e web largo) → acessibilidade → motion → `vitest` → `expo export --platform web` → sem hex fora de `estilo/`, sem componente local duplicado.
O Maestri revisa cada entrega antes de commitar; nada sobe sem preview e sem aprovação do Carlo.

## 8. Arquivos que serão alterados

- **Criar:** `estilo/espaco.ts`, `estilo/movimento.ts`; `componentes/`: Drawer/Sheet, Skeleton, MetricCard, Section, ListRow, Avatar, StatusPill, ProgressBar, AppShell, Sidebar, Topbar, TabBarMobile, BrandMark.
- **Alterar (sistema):** `estilo/cores.ts`, `estilo/tipografia.ts`, `componentes/{Button,Input,Card,Badge,Modal,EmptyState,ScreenHeader}.tsx`, `contextos/Toast.tsx`, `app.json`.
- **Alterar (shell e telas):** `app/(tabs)/_layout.tsx`, `app/(tabs)/mais.tsx`, `app/login.tsx`, `app/(tabs)/index.tsx`, `colaboradores.tsx`, `ferias.tsx`, `agenda.tsx`, `avisos.tsx`, `reconhecimentos.tsx`, `analytics.tsx`, `admin.tsx`, `ia.tsx`, `pesquisas/*`, `onboarding/*`, `colaborador/[id].tsx`, `notificacoes.tsx`.
- **Não alterar:** `api/`, `conexoes/`, `banco/`, `tests/` (exceto novos testes de componente, se houver), regras de perfil, lógica de negócio.

## 9. Decisões que precisam do Carlo

1. **Login:** V2 próprio (este plano) em vez do "igual ao Araujo Prev" pedido antes. Confirma?
2. **Fundo do login:** grafite liso ou off-white?
3. **Escopo da primeira rodada:** fases 1 a 5 (sistema, motion, shell, login, dashboard) e parar para você ver, ou seguir direto para as telas?
4. **Branch:** trabalhar em `redesign-v2` (worktree `rh-visual`), partindo da `main` atual, e descartar a branch `redesign-claro` (ela tem migrações de tela que serão refeitas).

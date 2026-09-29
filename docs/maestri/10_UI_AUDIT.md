> **HISTÓRICO (2026-09-29).** Auditoria feita em 2026-09-25, antes do V2 e do V3; os problemas apontados já foram tratados nos redesigns. A direção visual vigente é `12_SUPERRH_PRODUCT_UI_V3.md`. Este arquivo fica só como registro; onde citar dourado, Cormorant, tema bege ou o Araujo Prev como identidade, vale o V3.

# Auditoria de UI — SuperRH (2026-09-25)

Auditoria técnica de código (impeccable audit). Somente leitura. Contexto: app Expo/React Native que roda em produção como web; redesign para tema claro igual ao Araujo Prev. Não há PRODUCT.md/DESIGN.md no projeto.

## Placar

| # | Dimensão | Nota | Achado principal |
|---|---|---|---|
| 1 | Acessibilidade | 1 | Zero `accessibilityLabel/Role` em ~276 usos de Touchable/Pressable; fontes de 9–11 px em 118 lugares |
| 2 | Performance | 2 | Telas de 500–950 linhas com estilos inline; polling de pendentes a cada 2 min na barra de abas |
| 3 | Responsivo | 2 | Só 9 telas com `KeyboardAvoidingView`; alvos de toque pequenos; sem layout de desktop (barra de 9 abas embaixo) |
| 4 | Tema | 2 | `estilo/cores.ts` existe, mas há cores fixas nas telas e `login.tsx` tem sua própria paleta |
| 5 | Integridade da implementação | 2 | Sem componentes compartilhados: cada tela reimplementa card, botão, input e modal |
| **Total** | | **9/20** | Ruim: precisa de refatoração do sistema visual antes de repintar |

## Veredito de integridade: reprovado

Não existe sistema visual: existe uma paleta (`cores.ts`) consumida por 18 arquivos, e telas grandes que repetem o mesmo padrão à mão. Trocar só os tokens **não** basta para o tema claro, porque o escuro está espalhado em cores fixas e em texto branco.

Evidências:
- `componentes/` só tem `PushProvider*`: nenhum Card, Button, Input, Modal, Badge ou Header compartilhado.
- 72 usos de `theme.white`/`theme.text` como cor de texto, pensados para fundo escuro: ficam ilegíveis no fundo claro.
- `app.json` fixa `"userInterfaceStyle": "dark"` e `app/_layout.tsx` usa `<StatusBar style="light" />`.
- `app/(tabs)/_layout.tsx` usa `#0C0E12` e `#555250` fixos na barra de abas e no cabeçalho, mais `rgba(255,255,255,0.07)`.
- `app/login.tsx` tem 46 cores fixas e uma paleta própria (NAVY, GOLD `#C9A84C` etc.), diferente da do resto do app.
- Só 1 ocorrência de `fontFamily`: a tipografia é a do sistema; Inter e Cormorant Garamond do Araujo Prev precisam ser carregadas (expo-font).

## Problemas por severidade

**P1 — corrigir antes de publicar**
1. **Sem sistema de componentes** (`componentes/`). Criar `Card`, `Button`, `Input`, `Modal`, `Badge`, `ScreenHeader`, `EmptyState` sobre os tokens novos e migrar as telas para eles. Comando: `/impeccable extract`.
2. **Texto legível só em fundo escuro** (72 usos + 58 `theme.white`/`#fff`). Mapear para tokens semânticos (`textPrimary`, `textMuted`, `onGold`) antes de trocar a paleta. Comando: `/impeccable colorize`.
3. **Acessibilidade ausente:** nenhum `accessibilityRole/Label`. Ícones sem rótulo (sair, filtros, fechar modal). Mínimo: role e label em todo botão só de ícone. Comando: `/impeccable harden`.
4. **Login com paleta própria** (46 cores fixas). Refazer usando os tokens; o Araujo Prev usa login escuro com halo dourado, que pode ficar como única tela escura de propósito. Comando: `/impeccable polish`.

**P2**
5. **Barra de 9 abas** (Dashboard, Equipe, Analytics, Agenda, Férias, Avisos, Kudos, Assistente, Admin) com rótulo de 9 px. Não cabe em celular pequeno e não tem hierarquia. No web/desktop, trocar por barra lateral escura como no Araujo Prev; no celular, manter 4–5 abas principais e mover o resto para um menu "Mais". Comando: `/impeccable layout` e `/impeccable adapt`.
6. **Tipografia:** 118 fontes de 9–11 px. Piso de 12 px para texto de leitura; rótulos de 10 px só em caixa-alta curta. Carregar Inter e Cormorant Garamond via expo-font. Comando: `/impeccable typeset`.
7. **Alvos de toque:** ~53 elementos com largura/altura menor que 44, só 4 `hitSlop`. Comando: `/impeccable adapt`.
8. **Formulários:** 50 `placeholderTextColor` fixos (vão sumir no fundo claro); poucos `keyboardType`/`autoComplete` (18 usos em ~50 inputs); `KeyboardAvoidingView` em 9 de ~20 telas. Comando: `/impeccable harden`.
9. **Estados vazios e de carregamento** irregulares (`RefreshControl` em 11 telas, estado vazio em 10, `ActivityIndicator` em 17 arquivos). Padronizar num `EmptyState` e num skeleton simples. Comando: `/impeccable onboard`.

**P3**
10. `app/colaborador/[id].tsx` (947 linhas), `ferias.tsx` (796), `index.tsx` (619): dividir em subcomponentes junto com a migração.
11. Movimento inexistente ou ad hoc: não é bloqueante; tratar depois via `find-animation-opportunities`.

## Pontos positivos
- Tokens centralizados em `estilo/cores.ts` (cores, `spacing`, `radius`): a base certa para trocar de tema.
- `confirm.ts` já resolve o `Alert.alert` mudo na web.
- Navegação por perfil (`roles` na lista de abas) e contador de pendentes na aba Férias: bom para RH.
- Uso consistente de Ionicons.

## Diretrizes para o redesign (para o Codex)

Referência: `scratchpad/araujo-visual.md` e o CSS do Araujo Prev.

1. **Ordem obrigatória**
   1. `estilo/cores.ts` com tokens semânticos claros: `bg #f4f0ea`, `card #ffffff`, `border #e7e1d6`, `textPrimary #1a1a1a`, `textMuted #857f73`, `gold #b8973a`, `goldLight #d4af5a`, `onGold #1a1a1a`, `success #3d7a5e`, `danger #a53a2f`, `info #2a5581`, sombras e raios (12/8). Manter os nomes de export atuais como aliases para não quebrar as telas, marcando os obsoletos.
   2. Fontes (expo-font): Inter para corpo, Cormorant Garamond 600 para títulos e marca.
   3. Componentes compartilhados em `componentes/` (Card, Button primário com gradiente dourado, Input com rótulo, Modal, Badge, EmptyState, ScreenHeader).
   4. Navegação: barra lateral escura no web largo, abas enxutas no celular.
   5. Telas, uma a uma, começando por login, Dashboard e Equipe. Trocar cores fixas e `theme.white` de texto pelos tokens.
   6. `app.json` (`userInterfaceStyle: "light"`) e `StatusBar style="dark"` fora do login.
2. **Não fazer:** alterar lógica, chamadas de API ou nomes de rotas; criar dark mode nesta fase; animações decorativas.
3. **Critério de aceite:** nenhuma cor hex fora de `estilo/cores.ts` (exceto login, se mantido escuro); todo botão só de ícone com `accessibilityLabel`; texto de leitura ≥ 12 px; `npx tsc --noEmit` sem erros novos.

## Próximos comandos recomendados
1. P1 `/impeccable extract` — componentes e tokens
2. P1 `/impeccable colorize` — mapeamento para o tema claro
3. P1 `/impeccable harden` — acessibilidade e formulários
4. P2 `/impeccable layout` + `adapt` — navegação e alvos de toque
5. P2 `/impeccable typeset`
6. `/impeccable polish` como passe final

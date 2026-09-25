# Brief de design (método Impeccable) — SuperRH

Objetivo deste arquivo: o agente que implementa **reproduz o raciocínio do Maestri**, não só aplica uma lista de correções. Leia inteiro antes de mexer em qualquer tela. Fonte: `10_UI_AUDIT.md` + crítica da entrega RH-001.

## Modo e postura

O SuperRH é modo **Operate**: a pessoa vem cumprir uma tarefa (aprovar férias, achar um colaborador, publicar um aviso). Escaneabilidade, consistência e expectativas nativas valem mais que expressão. A marca aparece nos detalhes (tipografia, dourado sóbrio, cantos, sombras), não em slogans.

## Método a repetir em cada tela (nesta ordem)

1. **Auditar** o que existe: cores fora de `estilo/cores.ts`, contraste, alvos de toque, rótulos de acessibilidade, responsividade.
2. **Criticar**: qual é a tarefa principal da tela? O olho vai para ela primeiro? O que compete com ela?
3. **Corrigir em lote**, usando só componentes de `componentes/` e tokens.
4. **Verificar**: `npx tsc --noEmit`, busca de hex fora de `estilo/cores.ts`, e reler a tela pensando no celular pequeno e no desktop largo.
5. **Registrar** o que mudou e por quê em `docs/changelog.md`.

## Princípios (com o porquê)

- **Não invente afirmações.** Texto de marketing e selos ("Acesso seguro", "Dados protegidos") que o sistema não comprova viram promessa falsa. Em tela de tarefa, texto é funcional. *Por quê:* confiança do usuário e responsabilidade jurídica do produto.
- **Nada que finge estado ao vivo.** Bolinha verde com "Acesso seguro" parece um indicador de status real. Só mostre estado que o sistema realmente mede.
- **Contraste primeiro.** Texto pequeno precisa de 4,5:1. O dourado `#B8973A` sobre branco dá cerca de 2,8:1 (o `#7A6220` dá cerca de 5,8:1): serve para detalhe e fundo de botão, **não** para texto de leitura ou rótulo de aba. Para texto dourado sobre claro use o dourado profundo `#7A6220`. *Por quê:* legibilidade real, não só regra.
- **Uma decisão, um lugar.** Cor de aba inativa depende do fundo. Se a mesma constante serve a sidebar escura e à barra clara, um dos dois quebra. Escolha o token pelo contexto.
- **Responsivo de verdade.** Largura lida uma vez no carregamento do módulo (`Dimensions.get` fora do componente) não reage a redimensionar nem a girar a tela. Use `useWindowDimensions()` dentro do componente.
- **Tokens, sempre.** Nenhum hex em tela. Se falta um token, crie em `estilo/cores.ts` com nome semântico.
- **Consistência antes de novidade.** Uma tela nova no sistema visual e as outras só recoloridas cria dois produtos. Termine o conjunto antes de refinar uma tela.

## Crítica da entrega RH-001 (a corrigir, nesta ordem)

1. **[P1] Abas inativas invisíveis no celular.** `app/(tabs)/_layout.tsx`: `tabBarInactiveTintColor: theme.sidebarMuted` (branco 58%) vale para a barra de baixo, que é branca (`theme.card`). Crie tokens separados: inativo da sidebar (claro sobre escuro) e inativo da barra mobile (`theme.textMuted`, verificando contraste). O ativo em texto pequeno usa `#7A6220`, não `#B8973A`.
2. **[P1] Rótulo ativo em dourado claro sobre branco.** Mesma tela: rótulos de 11 px ficam abaixo de 4,5:1. Ver princípio de contraste.
3. **[P1] `isWide` calculado no carregamento** em `app/login.tsx` (`const isWide = width > 768` fora do componente). Trocar por `useWindowDimensions()`.
4. **[P2] Texto e selo inventados no login.** Remover o selo "Acesso seguro" com bolinha verde, o título "Pessoas bem cuidadas, trabalho bem conduzido." e a lista "Dados protegidos / Acesso por perfil / Visão completa da equipe". Login é tarefa: marca + formulário. Se quiser apoio visual, use só o halo dourado e o nome da marca.
5. **[P2] Cores restantes fora de `estilo/cores.ts`:** `admin.tsx` (4), `ferias.tsx` (2), `colaborador/[id].tsx` (2), `analytics.tsx`, `notificacoes.tsx`, `onboarding/[id].tsx`, `pesquisas/[id].tsx` (1 cada). Mover para tokens.
6. **[P2] Telas ainda só recoloridas:** Férias, Agenda, Avisos, Analytics, Admin, Kudos, Pesquisas, Onboarding e Detalhe do colaborador ainda usam cards, botões, inputs e modais escritos à mão. Migrar para `Card`, `Button`, `Input`, `Modal`, `Badge`, `EmptyState`, `ScreenHeader`, uma tela por vez, na ordem de uso: Férias, Agenda, Avisos, Kudos, Analytics, Admin, Pesquisas, Onboarding, Detalhe.

## O que não muda

Lógica, chamadas de API, nomes de rotas, permissões por perfil. Nada de dark mode nesta fase. Sem animação decorativa; se houver movimento, ele comunica estado ou feedback (ex.: pressionar um botão).

## Critério de aceite da fase

- Nenhum hex fora de `estilo/cores.ts`.
- Contraste de texto pequeno ≥ 4,5:1 (cheque com o dourado profundo onde precisar).
- Todo botão só de ícone com `accessibilityLabel`; texto de leitura ≥ 12 px.
- `npx tsc --noEmit` sem erros novos; `npx expo export --platform web` compila.
- Sem texto ou selo que o sistema não comprove.

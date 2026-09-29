# SuperRH — Direção visual V3 (vigente)

Status: **em vigor desde 2026-09-28.** Substitui `11_DESIGN_BRIEF.md` (tema claro dourado, herdado do Araujo Prev) e `12_UI_V2_PLAN.md` (plano de sistema/motion/shell). Aprovada pelo Carlo depois de rejeitar a direção "Modern Law" (bege + dourado + Cormorant + sidebar preta). Histórico completo em `docs/changelog.md`, entrada "V3".

Escopo desde o pedido: **somente visual**. Nenhuma linha de API, banco, auth, RBAC ou regra de negócio faz parte desta direção.

## Referência

SaaS moderno (Linear, Notion, Rippling) como norte de qualidade, sem copiar nenhum literalmente. O Araujo Prev é referência de **engenharia visual** (tokens, componentes), não de identidade (ver ADR-012).

## Paleta (fonte: `estilo/cores.ts`)

| Papel | Valor |
|---|---|
| Fundo da página | `#F7F8FA` |
| Superfície elevada | `#FFFFFF` |
| Sidebar (grafite) | `#171A21` · hover `#20232A` · item ativo `#272B35` |
| Accent principal (índigo) | `#4F5BD5` · profundo `#434EC2` · claro `#818CF0` |
| Texto primário / secundário / discreto | `#101828` / `#475467` / `#667085` |
| Borda sutil / forte | `#EAECF0` / `#D0D5DD` |
| Status | sucesso `#12B76A`, erro `#F04438`, info `#2E90FA`, pendente `#F79009` |

Regras:
- Cor só via `estilo/cores.ts`. Nenhum hex ou `rgba` hardcoded em `app/` ou `componentes/`.
- As chaves `accent.dourado*` e `theme.gold*` são **nomes legados**: o valor já é índigo. Não renomear sem tarefa própria (muitos consumidores).
- O dourado real sobrou só como traço fino da marca (`BrandMark`).
- Texto sobre botão primário é branco (`texto.sobreAccent`). Conferir contraste sempre que mexer no accent.
- `theme` (em `cores.ts`) está deprecated. Só `notificacoes.tsx` e `responder/[id].tsx` ainda o usam; novos arquivos usam `cores`.

## Tipografia

Inter para tudo. Cormorant Garamond restrita à marca (`BrandMark`). Sem eyebrow/kicker acima de título; contexto extra vai no subtítulo. Escala em `estilo/tipografia.ts`.

## Composição

- Hierarquia antes de decoração: o que exige ação vem primeiro e maior; o resto é lista compacta.
- Nada de pilha de cards iguais (ícone + título + texto) como estrutura de página.
- Sem borda colorida lateral decorativa, sem glow colorido, sombra só com offset + blur suave.
- Ícones: só Ionicons, um peso consistente. Sem emoji como ícone.
- Responsivo: layouts lado a lado empilham em coluna quando `width <= 768` (padrão `compact`).
- Componentes compartilhados em `componentes/` antes de qualquer estilo local. Não duplicar.
- Todo controle tem estado de carregando, vazio, erro e desabilitado.

## Motion (fonte: `estilo/movimento.ts`)

| Token | Duração |
|---|---|
| instant | 100 ms |
| fast | 140 ms |
| normal | 200 ms |
| estrutural | 260 ms |
| celebração | máx. 400 ms |

Entrada com ease-out, saída mais rápida. `prefers-reduced-motion` obrigatório (`useMotion`: nesse modo tudo vira 100 ms sem deslocamento). Motion comunica estado, feedback, hierarquia ou relação espacial. Proibido: bounce excessivo, glow pulsante, animação infinita, efeito decorativo, scroll reveal sem propósito.

## Telas: situação

| Situação | Telas |
|---|---|
| Recompostas no V3 | login, sidebar, dashboard, equipe, férias (badge animado), kudos |
| No design system, herdam a paleta pelos tokens | admin, agenda, avisos, ia, analytics, mais, pesquisas, onboarding, detalhe do colaborador |
| Legado via `theme` (herdam a paleta pelos aliases) | notificações, responder pesquisa (página pública) |
| Fora do V3 | exportação em PDF (`helpers/pdf.ts` ainda em dourado `#C9A84C`) |

## Como aplicar (checagem por tela)

1. Zero hex/`rgba` fora de `estilo/`.
2. Contraste do texto de corpo ≥ 4,5:1; texto grande ≥ 3:1.
3. Testar com texto real (nomes e mensagens longas).
4. Um movimento com propósito por interação, sem `FadeInDown` idêntico em toda seção.
5. Foco de teclado visível (`foco.anel`).
6. Conferir em 390 px (celular) e desktop.
7. `npx tsc --noEmit`, `npm test`, `npx expo export --platform web`.

## Pendências visuais conhecidas

- `helpers/pdf.ts`: trocar o dourado antigo pelo índigo (aguarda decisão do Carlo).
- Comentário-cabeçalho de `estilo/cores.ts` ("Modern Law", "Champagne Gold") descreve a paleta antiga; atualizar quando alguém for mexer no arquivo.
- Telas legadas (`notificacoes`, `responder`) ainda usam `theme`; migrar para `cores` quando houver tarefa de acabamento.

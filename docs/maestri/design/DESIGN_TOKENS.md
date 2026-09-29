# Design tokens

Fonte de verdade: `estilo/cores.ts`, `estilo/espaco.ts`, `estilo/tipografia.ts`, `estilo/movimento.ts`. Este documento **resume**; se divergir do código, o código vale. Nenhuma cor, espaçamento ou raio hardcoded em `app/` ou `componentes/`. Direção visual: `design/SUPERRH_UI_V3.md`.

## Cores (`cores`)

| Token | Valor |
|---|---|
| `superficie.pagina` / `elevada` / `sutil` / `destaque` | `#F7F8FA` / `#FFFFFF` / `#F9FAFB` / `#EEF0FF` |
| `texto.primario` / `secundario` / `discreto` | `#101828` / `#475467` / `#667085` |
| `texto.sobreAccent` | `#FFFFFF` |
| `borda.sutil` / `forte` | `#EAECF0` / `#D0D5DD` |
| `accent.dourado` (nome legado; valor índigo) | `#4F5BD5` |
| `accent.douradoProfundo` / `douradoClaro` | `#434EC2` / `#818CF0` |
| `status.sucesso` / `erro` / `informacao` / `pendente` (forte) | `#12B76A` / `#F04438` / `#2E90FA` / `#F79009` |
| `sidebar.superficie` / `hover` / `itemAtivo` | `#171A21` / `#20232A` / `#272B35` |

As chaves `dourado*` e `theme.gold*` são nomes legados; renomear é tarefa própria.

## Spacing (`espaco`)

`zero 0`, `micro 2`, `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 20`, `xxl 24`, `xxxl 32`, `gigante 40`, `secao 48`, `tela 64`. Dentro de um grupo, junto; entre grupos, generoso; mais espaço acima de um título de seção do que abaixo.

## Radius (`raio`)

`controle 8`, `cartao 12`, `overlay 16`, `pill 999`.

## Typography (`tipografia`, `familias`)

Inter em toda a interface (`corpo`, `medio`, `semibold`, `negrito`); Cormorant Garamond só na marca (`BrandMark`). Escala semântica: `display` 32/40, `titulo` 24/32, `subtitulo` 18/26, `corpo` 14/20, `corpoForte` 14/20, `legenda` 12/16. Sem eyebrow acima de título.

## Shadow

Geometria em `estilo/espaco.ts` (`elevacao`): `nenhuma` (sem sombra) e `overlay` (offset y 12, raio 40, para modal, drawer e menus). A cor vem de `cores.elevacao.sombra` (`rgba(16,24,40,0.06)`); o `backdrop` de overlay é `rgba(16,24,40,0.45)`. Sempre com offset e blur suave; sem glow colorido de offset zero. Cartões usam borda sutil, não sombra pesada.

## Breakpoints

Padrão do app: `compact` quando `width <= 768` (layouts lado a lado empilham em coluna). Sidebar larga na web; no celular, 4 abas + "Mais". Conferir sempre em 390 px, 768 px e desktop.

## Outros

`tamanho.toqueMinimo 44`, ícones 16/20/24, `borda.fina 1`, `borda.foco 2`, `largura.leitura 520`, `drawer 400`, `sheet 640`. Ícones: só Ionicons.

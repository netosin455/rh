# Brief de acabamento (Impeccable craft-floor) — Fase 6

O Codex não carrega skills do Claude Code (isso é um recurso do meu lado). Este arquivo traduz o "craft floor" do Impeccable — o que separa um app organizado de um app com acabamento — em checagens concretas para cada tela desta fase. Ler antes de migrar qualquer tela.

## Já corrigido nas fases 1–5 (não reintroduzir)

- **Sem kicker/eyebrow acima de título.** `ScreenHeader` não tem mais a prop `eyebrow`. É um enfeite banido pelo Impeccable — nunca ajuda hierarquia. Contexto extra vai no `subtitle`, nunca numa etiqueta separada acima do título.
- Sem cards do mesmo tamanho com ícone+título+texto como estrutura de página (isso é "the lazy container").
- Sem borda colorida lateral em card/aviso como decoração (a única exceção é o anel de foco de teclado no `ListRow`, que é funcional, não decorativo).
- Sem sombra "flat" com glow colorido de offset zero — se usar sombra, ela tem offset + blur suave (`estilo/espaco.ts` já define isso).

## Checagem obrigatória por tela, antes de passar para a próxima

1. **Contraste:** texto de corpo e placeholder ≥ 4,5:1; texto grande ≥ 3:1. Nunca cinza genérico sobre superfície colorida — use o tom semântico da própria cor (ex.: `douradoProfundo` sobre claro, não um cinza qualquer).
2. **Espaçamento:** dentro de um grupo, junto; entre grupos, generoso. Mais espaço **acima** de um título de seção do que abaixo dele.
3. **Tipografia:** hierarquia óbvia entre título, corpo e legenda (não dois tamanhos quase iguais competindo). Rode o texto real (nomes longos, mensagens longas) em vez de só o texto de exemplo — veja se quebra ou corta mal.
4. **Motion:** um movimento com propósito por interação, não um `FadeInDown` idêntico repetido em cada seção da tela. Motion existe para comunicar estado (entrada de item novo, expansão, mudança de valor), não para "parecer vivo".
5. **Estados:** todo controle tem estado de carregando, vazio, erro e desabilitado — não só o caminho feliz. Use `Skeleton`, `EmptyState` e os estados do `Button`/`Input` já prontos, não invente um novo padrão local.
6. **Ícones:** só Ionicons, um traço/peso consistente — nunca emoji ou glifo solto como ícone.
7. **Foco de teclado (web):** visível em todo elemento interativo (já existe token `foco.anel`; reaproveite, não invente cor nova).
8. **Copy:** botão nomeia a ação ("Aprovar", "Ver detalhes"), nunca genérico ("OK", "Enviar" quando há ambiguidade). Erro nomeia o problema e o que fazer.
9. **Limpeza final:** sem código morto, sem import não usado, sem estilo duplicado que já existe em `componentes/` ou `estilo/`.

## O que isso muda na prática nas próximas telas

- Título de tela é só `ScreenHeader title="..." subtitle="..."` — nada de rótulo em caixa alta acima dele.
- Antes de criar um novo estilo local, verificar se `estilo/espaco.ts` já tem o valor (raio, sombra, espaçamento) e `componentes/` já tem o padrão (Card, ListRow, StatusPill, MetricCard, ProgressBar, Skeleton, Avatar).
- Ao terminar cada tela, alem do gate tecnico (tsc/testes/build), reler a tela contra esta lista antes de seguir pra proxima.

# Plano — fluidez e movimento do SuperRH

Registrado em 2026-10-06 (Carlo: "deixar o app mais fluido, ainda está muito estático"). Só planejamento: **nada disto foi implementado**. Entra depois das entregas em andamento (Fechamento, alertas, WhatsApp).

## Diagnóstico (levantado no código em 2026-10-06)
A sensação de "estático" vem de duas causas diferentes, e a segunda pesa mais do que parece:

**A. Espera (percepção de velocidade).** 25 telas buscam dados com `useEffect` e refazem tudo a cada visita; não existe cache de dados (nenhum SWR/React Query). Resultado: toda vez que se volta a uma tela aparece o esqueleto de novo, mesmo para dado que acabou de ser visto. Nenhuma ação é otimista: aprovar, excluir ou lançar só mostram efeito depois da resposta da API.

**B. Movimento (falta de vida nas mudanças).**
- Já existe base boa: tokens de movimento (`estilo/movimento.ts`), hook `useMotion` com `reduzMovimento`, escala ao pressionar em `Button` e `Card`, entrada/saída do `Modal`, `Skeleton`, `ProgressBar`, `Toast` e a fita animada da sidebar.
- Faltam: transição entre telas (o `Stack` não define animação), entrada escalonada de listas, saída/colapso de itens removidos, números que contam até o valor, barras que crescem, feedback de hover e toque em `ListRow`, e confirmação visual ao salvar.

## Princípios (valem para todas as fases)
- Usar só os tokens de `estilo/movimento.ts`. Durações: micro 100–160 ms, normal 180–240 ms, estrutural 250–320 ms. Entrada de conteúdo nunca passa de 250 ms.
- Animar apenas `transform` e `opacity` (nada que force recalcular layout em lista grande).
- Movimento nunca atrasa clique: o elemento é interativo desde o primeiro frame.
- Respeitar `reduzMovimento` (`useMotion`) e `prefers-reduced-motion`: com ele ligado, tudo aparece instantâneo, sem deslocamento.
- Escalonamento: no máximo 8 itens (30 ms de intervalo). Lista com mais de 50 itens não anima entrada.
- Foco de teclado sempre visível; animação não substitui estado (cor, texto, ícone).
- Cada fase fecha com `tsc`, testes, E2E e verificação no navegador a 1280 px e 390 px.

## Fases (da que mais muda a sensação para a que dá o polimento)

### F1 — Percepção de velocidade (maior impacto)
1. **Cache leve com revalidação (stale-while-revalidate):** helper `usarDados(chave, buscar)` em `helpers/` ou `contextos/`; mostra na hora o dado já visto e atualiza em segundo plano; deduplica pedidos iguais; TTL curto (ex.: 60 s) e invalidação por chave.
2. **Invalidação após escrita:** qualquer lançamento, aprovação, edição ou exclusão invalida as chaves afetadas (`employees`, `absences`, `analytics`, `notifications`, `surveys`). Regra de ouro: o saldo de folga e férias nunca pode aparecer velho depois de uma ação.
3. **Pré-carregar ao passar o mouse ou focar** em item do menu e em linha de lista (web): a tela de destino abre já com dados.
4. **Otimismo nas ações seguras:** aprovar, recusar e excluir tiram o item da lista na hora e voltam atrás com aviso se a API falhar.
- **Aceite:** voltar a uma tela já visitada mostra o conteúdo em menos de 100 ms, sem esqueleto; toda ação mostra efeito antes da resposta; nenhum dado velho depois de escrita (teste).
- Estimativa: 12–18 h (front) + testes.

### F2 — Entrada e saída de conteúdo
1. **Transição entre telas:** fade com deslocamento curto (160–220 ms) no `Stack`; sidebar permanece fixa.
2. **Listas:** entrada escalonada (Equipe, Férias, Dashboard, Feedbacks, Pesquisas).
3. **Esqueleto para conteúdo:** crossfade em vez de troca seca; esqueleto com o mesmo desenho do conteúdo (sem salto de layout).
4. **Remoção de item:** o item sai e a lista fecha o vazio com transição de layout (excluir, aprovar, marcar lida).
- **Aceite:** nenhum salto de layout visível (CLS ≈ 0); itens removidos não "pulam" a lista.
- Estimativa: 10–14 h.

### F3 — Números e dados vivos
1. **Contagem animada** nos KPIs (Dashboard, Analytics, NPS, Fechamento): do valor anterior ao novo em 400–600 ms.
2. **Barras e progresso** crescem do zero ao valor (NPS por faixa, distribuição, risco, ProgressBar).
3. **Medidor do NPS** com preenchimento animado e troca suave de cor por faixa.
- **Aceite:** números nunca mostram valor intermediário errado depois de assentar; leitores de tela recebem o valor final (não o contador).
- Estimativa: 6–10 h.

### F4 — Micro-interações
1. `ListRow` e `Card`: realce no hover (web) e escala sutil ao pressionar.
2. Filtros e chips: troca animada do selecionado (como a fita da sidebar).
3. Salvar com sucesso: confirmação visual no próprio botão (check) antes do toast.
4. Ícones do menu e do sino: resposta curta ao toque; sino balança só quando chega notificação nova.
- Estimativa: 8–12 h.

### F5 — Polimento
- Modais como folha inferior no celular, pull-to-refresh nativo, feedback tátil (haptics) no app nativo, esqueletos refinados.
- Só vale se o app nativo for usado; na web, apenas o que for de baixo custo.
- Estimativa: 8–12 h.

**Total aproximado:** 44–66 horas de front, em fases independentes (cada uma entrega valor sozinha).

## Ordem sugerida
F1 primeiro (muda o "feeling" mais do que qualquer animação) → F2 → F3 → F4 → F5. Parar quando o Carlo achar suficiente.

## Testes e medição
- **E2E determinístico:** o Playwright roda com `reducedMotion: 'reduce'` (tudo instantâneo, sem flakiness) e um projeto separado "com movimento" só com smoke (telas abrem e interagem).
- **Unitários:** helper de cache (dado velho na hora, revalidação, deduplicação, invalidação por escrita, TTL) e dos cálculos de animação (valor final exato).
- **Medição:** tempo até conteúdo numa revisita (meta: < 100 ms), salto de layout (CLS) e quadros por segundo no perfil do Chrome nas telas com listas.
- **Revisão:** o chefe confere que dado de saldo não fica velho depois de escrita e que `reduzMovimento` desliga tudo.

## Riscos
- **Dado velho depois de uma ação** (principal): mitigado por invalidação por chave e TTL curto; testes obrigatórios para saldo de folga e férias.
- **Otimismo errado:** ação otimista que a API recusa; mitigado com rollback e aviso.
- **Flakiness do E2E:** mitigado com `reducedMotion` nos testes.
- **Excesso:** movimento demais cansa; seguir os princípios e a regra de parar quando bastar.
- **Desempenho em lista grande:** limite de itens animados e só `transform`/`opacity`.

## Divisão de trabalho (quando for executar)
- **Claude Code #2 (front):** tudo; usa as habilidades `animate-expo`, `emil-design-eng` e `apple-design` como guia de decisão.
- **Codex (back):** nada obrigatório. Opcional: cabeçalhos de cache/`ETag` nas leituras mais pesadas, se a medição mostrar necessidade.
- **Chefe:** revisão, medição, `verify` e push.

## Perguntas em aberto para o Carlo
1. **Intensidade:** sutil e rápido (estilo Linear/Notion) ou mais expressivo? (Recomendação: sutil, porque é uma ferramenta de trabalho do dia a dia.)
2. **App nativo:** o RH vai usar no celular instalado ou só no navegador? Define se F5 (folhas, haptics) vale.
3. **Por onde começar:** F1 (velocidade) como recomendado?

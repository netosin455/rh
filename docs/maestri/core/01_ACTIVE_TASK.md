# Tarefa ativa

Este arquivo representa **apenas a tarefa corrente**. Antes de qualquer edição o Maestri preenche a ficha; ao terminar, fecha o STATUS e move o resumo para "Tarefas concluídas" em `core/00_PROJECT_CONTROL.md`. Modelo em branco: `templates/ACTIVE_TASK_TEMPLATE.md`.

---

**TASK ID:** RH-009

**STATUS:** PAUSADA (2026-09-29). Implementação feita, testada e depois desfeita a pedido do Carlo. O código está guardado no `git stash`. Retomar numa próxima sessão.

**OBJECTIVE:** Recompor a COMPOSIÇÃO de 4 telas do V3: Dashboard, Login, Sidebar e Equipe. O V3 publicado (`4f69b1d`) trocou a paleta para índigo e grafite, mas manteve a estrutura Section + Card + ListRow. Sem mudar cores.

**TYPE:** Frontend (UI redesign, somente visual).

**RISK:** LOW/MEDIUM visual. Exceção declarada: o Dashboard nomeia quem aguarda aprovação usando `getPendingAbsences()` (leitura já existente em `conexoes/ausencias.ts`, sem escrita e sem mudança de API).

**ONDE ESTÁ O TRABALHO:** `git stash list` mostra `stash@{0}: RH-009 recomposicao 4 telas (desfeita a pedido do Carlo em 2026-09-29)`. Para retomar: `git stash pop` (ou `git stash show -p stash@{0}` para ler). Contém: `app/(tabs)/index.tsx`, `app/login.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/colaboradores.tsx`, novos `componentes/Divider.tsx`, `SectionHeading.tsx`, `DataRow.tsx`, `FilterMenu.tsx`, tokens `largura.sidebar/formulario/conteudo` e `tamanho.avatarLista` em `estilo/espaco.ts`, e `Avatar` com tamanho `row`. Nesse estado passaram `npx tsc --noEmit`, `npm test` (51/51) e `npx expo export --platform web`. Só o login foi renderizado (screenshot); Dashboard, Sidebar e Equipe NÃO foram vistos em tela. Não houve revisão independente.

**CRÍTICA DO V3 PUBLICADO (base do redesign):**
- Dashboard: até 8 `Card` iguais; "Precisa de você" aparece duas vezes; três títulos empilhados (topbar, ScreenHeader, seção); o cartão "Equipe hoje" mostra o total (43) com selo de 93%.
- Login: cartão de 520 px centralizado + círculo decorativo de 384 px; genérico.
- Sidebar: 6 grupos para 10 itens, rótulos em caixa alta, item ativo com tripla marcação, três linhas divisórias, topbar de 68 px só para repetir o título.
- Equipe: selo de status em toda linha (a maioria é Ativa), 3 ícones coloridos sem rótulo por linha, botão redondo flutuante, filtros em chips.

**DECISÕES DO CARLO (2026-09-29):**
1. Login dividido 50/50: painel grafite com a marca à esquerda, formulário sem cartão à direita; no celular só o formulário.
2. Frase do painel: "Pessoas. Organização. Clareza."
3. "Precisa de você" nomeia a pessoa de cada pedido pendente (leitura de `getPendingAbsences()`).
4. Equipe: segundo filtro por **Área jurídica** (lista fechada), não por Cargo (texto livre).
5. A paleta atual fica (`#F7F8FA`, `#171A21`, `#4F5BD5`): o problema é layout e composição, não cor.
6. Layout primeiro, componentes depois: desenhar a tela e só então achar como os componentes atendem.

**WIREFRAMES APROVADOS (resumo):**
- **Shell desktop (232 px):** sem topbar. Marca com sino no topo; grupos "Início" (sem rótulo), Pessoas (Equipe, Férias, Onboarding), Trabalho (Agenda, Avisos, Kudos, Pesquisas), Insights (Analytics, Assistente); rodapé com Administração (só super_admin) e usuário com Sair. Item ativo em faixa cheia, sem pílula e sem barra. Sem `borderRight`. Rótulos de grupo em minúsculas.
- **Dashboard:** saudação (display 32) + data; "40 de 43 disponíveis" com barra e percentual; "Precisa de você" em lista com divisores (rótulo Urgente ou Atenção, sem cartão); duas colunas (Agenda agrupada por dia | Aniversários e Avisos); Equipe com 5 linhas e "Ver todas"; Insights da IA como linha discreta. Zero `Card`.
- **Login:** painel grafite (`#171A21`) com marca e a frase; formulário de 360 px sem cartão, sem borda e sem sombra; erro em linha acima do botão; sem círculo decorativo.
- **Equipe:** título e "43 pessoas" + botão Adicionar no cabeçalho; busca + filtros Situação e Área; linhas diretas com avatar de 44 px, cargo e OAB em texto secundário, área em coluna, situação só quando não é Ativa; ações rápidas (falta, folga, horas) num único "⋯" por linha, visível no hover ou foco (sempre visível no celular).

**DEPENDÊNCIAS E RISCOS CONHECIDOS:**
- `FilterMenu` fecha ao tocar fora só na web; no nativo fecha ao escolher ou ao tocar de novo no gatilho.
- Hover-reveal depende de mouse; o foco de teclado também deve revelar as ações.
- Sem topbar no desktop, todas as telas de `(tabs)` precisam ter título próprio (todas têm `ScreenHeader` hoje).
- A skill `design-taste-frontend` se declara fora de escopo para dashboards: usada só pelas regras anti-genérico. `review-animations` segue ausente.

**PARA RETOMAR (checklist):**
1. `git stash pop`; conferir `git status`.
2. Renderizar as 4 telas (desktop 1280 e celular 390), ver com dados reais e ajustar.
3. `npx tsc --noEmit`, `npm test`, `npx expo export --platform web`.
4. Revisão independente (agente Final Reviewer) e aprovação do Carlo.
5. Só então commit; push na `main` só com autorização explícita.

**OUTRAS PENDÊNCIAS (fora desta tarefa):**
- `GROQ_API_KEY` inválida em produção: Insights de IA e chat fora do ar até gerar chave nova em console.groq.com e atualizar na Vercel.
- Exportação em PDF (`helpers/pdf.ts`) ainda em dourado.
- Comentário-cabeçalho de `estilo/cores.ts` ainda cita "Modern Law" e "Champagne Gold"; nomes `dourado*` e `theme.gold*` são legado com valor índigo.
- Nenhum dos 43 colaboradores tem email ou login vinculado.

**MAESTRI NO APP (canvas):** o workspace certo do SuperRH é o **"rh"**. O terminal do Claude Code usado nesta sessão estava no workspace "araujo prev" (Gerador de Recibos), então nada do SuperRH deve ser criado lá. Feito e depois removido do Araujo Prev: notas do fichário "SUPERRH CONTROL", agentes Lume e Fiel. Mantidos (globais, só configuração): 14 papéis "SuperRH - ..." (Maestri, Task Classifier, Planner, Architect, Domain RH, Frontend Mobile, Backend API, Database, Security, Privacy LGPD, AI Reviewer, Performance, QA, Final Reviewer). Próximo passo: o Carlo abre um terminal do Claude Code dentro do workspace `rh`; de lá montar as notas do fichário e os agentes (a pergunta "Yes, I trust this folder" de cada agente novo é decisão do Carlo). A pasta `.maestri/` criada dentro do repo está ignorada localmente (`.git/info/exclude`).

**PROTECTED FILES (para a retomada):** `api/`, `banco/`, `conexoes/` (só leitura), `contextos/`, `helpers/`, `tipos/`, `tests/`, auth, RBAC, `estilo/cores.ts`.

**HANDOFF:** Claude Code → Carlo. Próxima sessão: retomar pelo checklist acima.

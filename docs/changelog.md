# Changelog — SuperRH

## [2026-10-01] — Fase 1 de estabilização, CI, NPS de clientes e risco de saída clicável

### Corrigido
- **Isolamento entre empresas:** `department_id` e `manager_id` (colaborador) e `case_id` (evento) agora são validados por `company_id` (422 sem gravar) e os JOINs conferem a empresa. Testes de regressão em `tests/employees-tenancy.test.ts` e `tests/events-tenancy.test.ts`.
- **Histórico salarial nunca era gravado:** a tabela `salary_history` estava no `schema.sql` mas NUNCA existiu em produção (o `.catch(() => {})` escondia). Migration `019_salary_history.sql` criou a tabela; a atualização do colaborador e o histórico agora são um único comando, sem falha silenciosa. Descoberto rodando `EXPLAIN` no Neon real: os testes com banco simulado não pegam tabela inexistente.
- **Notificações lidas por usuário:** migration `018_notification_reads.sql`; a leitura de um usuário não marca como lida para os outros (fallback para o comportamento antigo se a tabela não existir).
- **Sessão:** `helpers/sessao.ts` (restaurar sessão nunca lança, loading sempre termina), login passa pelo cliente HTTP compartilhado (timeout de 15 s) e um 401 em qualquer tela encerra a sessão na hora (`setUnauthorizedHandler`).
- **Teste instável:** `tests/recognitions.test.ts` estourava 5 s sob carga (import dinâmico frio) e derrubava o teste seguinte em cascata; import movido para `beforeAll` e `mockReset`.
- Conta da usuária RH corrigida em produção: "Ariele" para "Arielle" (nome, login e e-mail); o cadastro de funcionária já estava correto.

### Adicionado
- **CI** (`.github/workflows/ci.yml`): `tsc`, testes e build web em todo PR e push na `main`; scripts `typecheck`, `test:ci`, `build:web` e `verify`. A automação "Agente IA — Análise do Repositório" foi desativada no GitHub (apontava para um repositório inexistente); o arquivo continua no repo.
- **NPS de clientes** como área própria (item "NPS" no menu): campanhas com público `customers`, pergunta NPS 0 a 10, modelo "Satisfação do cliente", resposta pública anônima por link/QR code (`toqr`, gerado no cliente), contato opcional só com consentimento, "Retornar contato" (marcar contatado, apagar contato sem apagar a resposta). NPS calculado no servidor (9-10 promotores, 7-8 neutros, 0-6 detratores; sem dados = nulo). Migration `020_nps_clientes.sql`.
- **Trava por IP** nas pesquisas públicas: só HMAC do IP é gravado (nunca o IP puro nem em log); 100 respostas por IP em 24 h para colaboradores e 5 para clientes (HTTP 429).
- **Risco de saída clicável** em People Analytics: cards alto/médio/baixo viram filtros com o motivo de cada pessoa (`helpers/risco.ts`, espelha a migration 006); filtro na URL (`?risco=`); Dashboard, Analytics, Equipe e Férias navegam por números ("todo número é um caminho"), com `?status=` e `?tab=`.

### Planejamento
- `PLAN_STABILIZATION.md`, `PLAN_SURVEYS_FEEDBACK_NOTE.md`, `PLAN_NPS_CLIENTES.md` em `docs/maestri/core/`.

### Operação / pendências
- Migrations 015 a 020 já executadas em produção. Pendente: banco de desenvolvimento separado no Neon e proteção do branch `main` (ação do Carlo nas contas); limpeza agendada de `ip_hash` com mais de 7 dias; evolução/filtro/PDF do NPS; seletores de data e hora na Agenda.
- Verificado: `tsc` limpo, `npm test` verde, `expo export --platform web` ok, CI verde.

## [2026-09-30] — Tela "Lançar", pesquisas com perguntas próprias, sidebar persistente e correções

### Adicionado
- **Tela única "Lançar"** (falta, folga, hora extra, férias, licença) no lugar dos 3 botões da Equipe e do formulário de 7 tipos; Folga sempre exige horas e mostra "banco de horas: 10h para 8h" antes de salvar.
- **Pesquisas com 1 a 10 perguntas** (escala 1-5, escolha, aberta; obrigatória ou não), resposta uma pergunta por tela, resultados por pergunta. Migrations `016_survey_questions.sql` e `017_feedback_ack_note.sql`.
- **Observação do colaborador** ao confirmar a leitura de um feedback (até 1000 caracteres; aparece no detalhe do RH e no PDF).
- Migration `015_absences_falta.sql`: o tipo `falta` não existia na regra do banco de produção ("Registrar falta" dava erro).

### Corrigido
- **Sidebar** persistente em todas as rotas (estava no grupo de abas e sumia em colaborador, pesquisas, onboarding, feedbacks e notificações) e a fita azul acompanha o item ativo (a posição era medida dentro do grupo e dois itens tinham o mesmo y).
- **Linha de feedback tremia no hover:** loop de `pointerEvents` alternando com o hover; linha passou a usar `onPointerEnter/Leave` e a caixa de ações fica sempre montada, só a opacidade muda.
- **Busca de colaboradores** não para mais em 50 (`getEmployees` busca todas as páginas de 100); Dashboard, Equipe, Agenda, Avisos, Férias e Reconhecimentos mostram erro com "Tentar de novo" em vez de lista vazia.
- `tsconfig` passou a cobrir o front inteiro (64 erros corrigidos) e o `apiFetch` ganhou timeout de 15 s com `AbortController`.
- **Notificação individual vazava como global** quando o colaborador não tinha `user_id` (ficava `NULL`, que significa "empresa toda"); não grava mais.

### Observação de processo
- Push na `main` = deploy automático; migrations rodam ANTES do push e só com OK nomeado do Carlo.

## [2026-09-29] — Feedback do Tiago removido e feedback individual com link privado e ciência

### Operação
- Feedback #2 (revogado, de TIAGO FERNANDO DE SOUZA) removido do banco de produção a pedido do Carlo; backup da linha guardado fora do repositório.

## [2026-09-29] — Feedback individual com link privado e ciência

### Adicionado
- Fluxo completo de Feedback: rascunho por RH, publicação com token criptograficamente imprevisível, tela pública sem login, confirmação explícita de leitura, revogação e PDF real para download.
- Tela de RH para criar, editar rascunhos, publicar, abrir, copiar o link, baixar o PDF e visualizar o horário da confirmação.
- Migration `014_feedbacks.sql`, testes de RBAC/isolamento, revogação, confirmação e geração de PDF.

### Operação pendente
- A migration deve ser aplicada antes de publicar o código. Nenhum deploy ou dado de produção foi alterado nesta entrega.

## [2026-09-29] — Notificações: cores legadas trocadas pelos tokens do V3, e Maestri formalizado

### Corrigido (somente visual)
- `app/notificacoes.tsx`: o ícone de "onboarding" usava `#A78BFA` fixo e o fundo de item não lido usava um dourado antigo (`rgba(201,168,76,0.04)`, quase invisível). Agora usam `cores.categoria.familia` e `theme.surface3` (tom claro do índigo), então o não lido aparece de verdade. Nenhuma lógica alterada.
- Conferência das demais telas contra o V3: admin, agenda, avisos, ia, analytics, mais, pesquisas, onboarding e detalhe do colaborador já usam os componentes e tokens novos, sem hex hardcoded. Pendência conhecida: `helpers/pdf.ts` ainda exporta PDF em dourado.

### Documentação
- `CLAUDE.md` enxuto com bloco `## Maestri`; `docs/maestri/` atualizado (regras de risco, escopo, handoff, honestidade, gate de release, política de skills, ADR-001 a ADR-015) e nova direção visual em `12_SUPERRH_PRODUCT_UI_V3.md`. Push na `main` passa a exigir autorização explícita.

### Verificado
- tsc limpo, npm test 51/51, expo export --platform web sem erro.

## [2026-09-28] — V3: nova identidade visual (índigo/grafite claro), SOMENTE visual

Redesign completo da pele do SuperRH, aprovado pelo Carlo depois de rejeitar a direção "Modern Law"
(bege+dourado+Cormorant+sidebar preta). Nova referência: SaaS moderno (Linear/Notion/Rippling), sem copiar
nenhum literalmente. Escopo travado desde o pedido: **somente visual** — nenhuma linha de lógica de negócio,
API, banco, auth ou RBAC foi tocada. Protótipo isolado (Artifact, dados fake) validado com o Carlo antes de
qualquer código real ser alterado.

### Tokens (estilo/cores.ts, estilo/movimento.ts)
- Paleta inteira trocada: fundo `#F7F8FA`, sidebar grafite `#171A21` (+ hover `#20232A` e item-ativo
  `#272B35`, tokens novos), accent principal índigo `#4F5BD5`, status success/warning/error/info recalibrados
  pros tons exatos que o Carlo passou. Chaves antigas "dourado*" mantidas por compatibilidade (evita reescrever
  todo consumidor), só o valor virou índigo — dourado de verdade sobrou só como traço fino da marca.
- Corrigido de tabela um bug de contraste que a troca ia introduzir silenciosamente: `texto.sobreAccent` era
  escuro (certo pro dourado antigo), ficaria ilegível em cima de botão primário índigo. Agora branco.
- `estrutural` do motion: 280ms → 260ms (valor exato pedido).
- Os 2 arquivos que ainda não usam o sistema de tokens (`notificacoes.tsx`, `responder/[id].tsx`) foram
  religados pra puxar de `cores.*` em vez de duplicar hex, então herdam a paleta nova automaticamente.

### Telas (Codex, dois agentes em paralelo, revisão minha em tudo antes do commit)
- **Login**: removido gradiente escuro, halo dourado e sombra gigante. Fundo claro, 1 detalhe gráfico bem
  sutil no canto, cartão simples com sombra leve, título "Bem-vindo de volta", marca em tamanho padrão (não
  gigante). Entrada opacity+translateY em 200ms, botão com scale 0.98 no press — comportamento já existia,
  só a pele mudou.
- **Sidebar** (`_layout.tsx`): item ativo agora usa fundo sólido `cores.sidebar.itemAtivo` (era um tint
  translúcido dourado). Hover novo nas linhas da sidebar larga (web), animado, ~120ms. Estrutura de navegação
  intocada.
- **Férias**: badge de status ganhou um componente próprio (`AbsenceStatusBadge`) que anima a transição de
  cor quando o status muda (pendente→aprovado/recusado), ~140ms. Lógica de aprovar/reprovar/criar/editar
  100% preservada.
- **Kudos**: ao publicar um reconhecimento com sucesso, aparece um feedback curto (troféu + texto) com
  fade+scale de 220ms que desaparece depois de ~400ms, respeitando `prefers-reduced-motion`. Sem confete, sem
  bounce.
- **Dashboard**: recomposição completa, saiu do "pilha de cards iguais". Agora: resumo (equipe hoje + precisa
  de você) lado a lado com barra de progresso, "Precisa de atenção" como lista compacta (não card por item),
  próximos eventos + aniversários lado a lado, equipe no rodapé. Toda a lógica de carregamento/cálculo
  (`load()`, `attentionItems`, insights) intocada.
- **Equipe**: lista compacta de pessoas com hover na linha (`cores.superficie.sutil`). Busca, filtro, CRUD,
  FAB e ações rápidas 100% preservados.
- **Achado e corrigido na minha revisão antes do commit**: o Dashboard novo usava `flexDirection: 'row'`
  fixo nas duas fileiras lado a lado, sem breakpoint — ia espremer os cards numa fatia ilegível no celular.
  Adicionado `compact` (`width <= 768`) que empilha em coluna no mobile, mesmo padrão já usado no login.

### Verificado
- `tsc --noEmit` limpo, `npm test` 51/51, `expo export --platform web` sem erro.
- Scan manual: zero hex/rgba hardcoded fora de `estilo/`, zero corrupção de encoding (`Ã`), zero padrão
  "eyebrow" banido nos 6 arquivos alterados.
- Nota operacional: os dois Codex estavam sendo recrutados em worktrees obsoletos (`rh-visual`,
  `rh-backend`, branches de um redesign anterior já mergeado há muito tempo) — redirecionados pra
  `C:\Users\carlo\rh` (main) antes de qualquer edição real, senão o trabalho ia sair da base errada.

## [2026-09-28] — Bug real: Insights de IA do Dashboard sempre em erro (conta da ariele)

### Corrigido
- **Achado investigando "dashboard não mostra informações" na conta da ariele (role rh)**: o painel de Insights de IA do Dashboard (`GET /api/analytics?view=insights`) devolvia 500 pra ela sempre. Reproduzido contra produção com o token real dela. Causa raiz: a chave do Groq configurada em produção está inválida/expirada (`401 Invalid API Key` testando direto na API do Groq) — isso também derruba o assistente de IA (`POST /api/chat` → 502 "Assistente temporariamente indisponível"). **Preciso que o Carlo gere uma chave nova em console.groq.com e atualize `GROQ_API_KEY` nas env vars do projeto na Vercel** — não tenho como gerar/rotacionar essa chave.
- De brinde, achei e corrigi 2 bugs reais de SQL nessa mesma função que estavam sendo engolidos silenciosamente (`.catch(() => [])`, por isso nunca geravam 500, só dados incompletos): coluna `pr.submitted_at` não existe em `pulse_responses` (é `responded_at`), e `pulse_surveys` não tem coluna `response_count` (não existe, tem que contar via subquery em `pulse_responses`). Corrigido e testado direto contra o banco de produção antes de subir.
- Frontend (`app/(tabs)/index.tsx`) engolia esse erro em silêncio (`.catch(() => {})`), então a tela não crashava mas a seção de Insights ficava sempre vazia sem aviso — é o que a ariele via como "dashboard sem informação".

### Verificado
- Todas as outras chamadas do Dashboard pra conta da ariele (colaboradores, eventos, avisos, analytics geral, ausências) retornam 200 com dado real; o problema era isolado ao painel de Insights de IA.
- tsc limpo, npm test (51/51).

## [2026-09-28] — Degradê no login, máscaras de telefone/CPF, e um bug real: CPF sumiu do cadastro

### Corrigido
- **Achado testando o pedido de máscaras**: o campo CPF (estado e envio já existiam) tinha sumido do formulário de "Novo colaborador" na migração da Equipe pro design system mais cedo hoje — regressão minha, não fui completo na hora de reescrever. Campo de volta, agora com máscara.
- **Investiguei um suposto bug de "cartão do login não centraliza no celular"**: era falso positivo da minha ferramenta de teste (o `--window-size` do Chrome headless não estava respeitando a largura pedida). Testado com emulação de dispositivo de verdade (protocolo do Chrome): o login centraliza certinho em 390px. Nenhuma mudança de código necessária; documentado aqui pra não repetir o susto.

### Adicionado
- `helpers/validacoes.ts`: `maskCPF` e `maskPhone`, mesmo padrão do `maskDate` já existente. Aplicadas nos 3 campos que faltavam (telefone e CPF na Equipe e no Detalhe do colaborador).
- Login: fundo passa de cor sólida pra degradê grafite (`expo-linear-gradient`, dois tons da família `sidebar`), e o halo dourado atrás do cartão ficou mais visível (era quase imperceptível).

### Verificado
- Confirmado que `prefers-reduced-motion` não está sendo detectado incorretamente (motion do app funciona, é só discreto por escolha de design).
- tsc, npm test (51/51), expo export --platform web.

## [2026-09-28] — Aviso na tela de Kudos quando o colaborador não tem email

### Adicionado
- Ao escolher a pessoa e escrever a mensagem no Kudos, se ela não tem email cadastrado na ficha, aparece um aviso claro no modal: "não tem email cadastrado — o aviso só aparece pra ele(a) quando acessar o SuperRH". Não bloqueia a publicação, só avisa quem está dando o Kudos.

Verificado: tsc, npm test (51/51), expo export --platform web.

## [2026-09-28] — Kudos ganha notificação interna (canal grátis, sem depender de domínio de email)

### Contexto
- O Carlo pediu feedback por email pros colaboradores. Já estava implementado pro Kudos (reconhecimentos), mas o remetente padrão (`noreply@super-rh.vercel.app`) não pode ser verificado no Resend — `vercel.app` não é domínio do Carlo, e ele decidiu não comprar um domínio agora. Email continua no código, pronto pra ativar quando/se houver domínio.
- Achado nessa investigação: hoje **nenhum dos 43 colaboradores tem `email` na ficha nem conta de login vinculada** — o gargalo real não é o canal de envio, é o cadastro. Notificação interna só alcança quem tem conta.

### Adicionado
- `POST /api/recognitions` agora também cria uma notificação interna (tabela `notifications`, tipo `reconhecimento` — já previsto no schema, nunca usado) para o colaborador, quando ele tem conta de usuário vinculada (`employees.user_id`). Aparece no sino, mesma cadência de férias/avisos. Falha na notificação nunca quebra a criação do Kudos (mesmo padrão do email).
- 2 testes novos em `tests/recognitions.test.ts` (51 no total).

Verificado: tsc, npm test (51/51), expo export --platform web, e o INSERT testado direto contra o banco de produção.

## [2026-09-28] — Bug crítico ativo: "Próximos eventos" sempre quebrava (500 mascarado de CORS)

### Corrigido
- `GET /api/events?upcoming=true` comparava `e.date` (coluna `text`, formato "YYYY-MM-DD") direto com um valor `::date` — Postgres não tem operador `text >= date`, então a query sempre lançava exceção (`FUNCTION_INVOCATION_FAILED`, 500). Como o handler crashava antes de `cors()` rodar, o navegador reportava isso como bloqueio de CORS, escondendo o erro real. Achado ao testar o redesign V2 logado de verdade (não aparecia em teste com mock, nem via curl sem o parâmetro exato `upcoming=true`). Esse mesmo código já existia na versão anterior do Dashboard — bug ativo em produção, não introduzido pelo V2. Corrigido com `e.date::date >= ...`.
- Teste de regressão novo em `tests/events.test.ts` (49 no total).

### Observação
- Testes com `sql` mockado não capturam erro de tipo do Postgres real — só apareceu testando contra o banco de fato. Vale considerar, no futuro, algum teste de integração pontual pra queries com comparação de data/hora.

Verificado: tsc, npm test (49/49), expo export --platform web.

## [2026-09-28] - V2 polish: login com profundidade, sino duplicado, bug de eventos

Resposta ao feedback do Carlo de que o login/dashboard não tinham comparação com o gerador de recibos. Auditei contra print real (não só estrutura) e corrigi 3 problemas concretos:

1. **Login sem profundidade**: `BrandMark` ganhou variante `size="grande"` (só o login usa); halo dourado único atrás do cartão via `boxShadow` real (blur de verdade, web); sombra de profundidade no cartão.
2. **Sino de notificação duplicado**: existia um na topbar do shell (sem contador) e outro no Dashboard (com contador). Unificado no shell, único dono, web largo e celular.
3. **Bug crítico achado testando logado contra produção**: `GET /api/events?upcoming=true` sempre dava 500 (mascarado de erro de CORS no navegador). `events.date` é `text`, comparado sem cast contra `::date`. Corrigido e já em produção (`main`, 12:29) — pré-existente, não introduzido pelo V2.

Verificado: tsc, npm test (49/49), expo export --platform web, e visualmente contra produção logado (Dashboard real: 43 colaboradores, eventos corretos, um só sino).

## [2026-09-28] - V2-F6d: Equipe (achado tardio, feito por mim)

### Corrigido
- `app/(tabs)/colaboradores.tsx` (Equipe) nunca tinha sido atribuído a nenhum dos dois blocos da Fase 6 — erro meu na divisão do trabalho. Uma varredura completa por hex/rgba fora de `estilo/` encontrou a tela ainda com o visual antigo. Migrada agora: `Avatar`, `ListRow`, `StatusPill`, `Modal`, `Input`, `Button`, `EmptyState`, `Skeleton`; chip de filtro local (não existe componente de chip ainda) só com tokens. Lógica de busca, filtro, ações rápidas (falta/folga/crédito de horas) e cadastro preservada.

### Verificado
- `npx expo export --platform web`, `npm test` (48/48), sem hex/rgba fora de `estilo/`, sem eyebrow.

Com esta entrega, a Fase 6 do redesign V2 está completa de verdade: Equipe, Férias, Agenda, Avisos, Kudos, Analytics, Admin, Pesquisas, Onboarding, Detalhe do colaborador e IA.

## [2026-09-28] - V2-F6c: Assistente de IA

### Alterado
- `app/(tabs)/ia.tsx` migrou mensagens, sugestões e compositor para `ScreenHeader`, `Card`, `Avatar`, `Button`, `Input` e `Skeleton`, usando somente tokens de estilo compartilhados.
- O estado de processamento recebe fade curto com `useMotion()` e o cabeçalho não apresenta mais o estado estático “Online”; o histórico, o envio e a chamada ao chat foram preservados.

### Verificado
- `npx expo export --platform web` concluído.

## [2026-09-28] - V2-F6a: Férias, Agenda, Avisos, Reconhecimentos e Analytics

### Alterado
- As cinco telas passaram a compor a interface com tokens semânticos e componentes compartilhados (`ScreenHeader`, `Section`, `Card`, `Button`, `Input`, `Modal`, `ListRow`, `MetricCard`, `EmptyState`, `Skeleton`, `StatusPill`, `ProgressBar` e `Avatar` conforme o contexto).
- Férias preserva aprovações, edição, exclusão, saldos e PDF; Agenda preserva calendário, aniversários, criação e ICS; Avisos preserva expansão, fixação e exclusão; Reconhecimentos preserva o fluxo em duas etapas e exclusão autorizada; Analytics preserva métricas, riscos, casos urgentes e atalhos.
- Foram removidos `FadeInDown`, cartões locais duplicados, FABs e estilos com cores legadas dessas telas; a interação recebe feedback pelos componentes de motion e os controles mantêm rótulos acessíveis e foco web.

### Verificado
- Busca sem hex/rgba, `theme`, `eyebrow`, componentes legados e caracteres corrompidos nos cinco arquivos.
- `npm test`: 48 testes aprovados em 11 arquivos após cada migração.
- `npx expo export --platform web` executado após cada tela; as exportações concluídas geraram as 30 rotas web (com o aviso ambiental já conhecido de `EXPO_PUBLIC_API_URL` ausente).

## [2026-09-28] - V2-F5: Dashboard

### Alterado
- `app/(tabs)/index.tsx` reorganizado para saudacao e data, atencao prioritaria, metricas, agenda, equipe e insights secundarios recolhiveis.
- Alertas de alta severidade, pendencias de ferias e faltas agora recebem enfase semantica; metricas usam `MetricCard`, listas usam `ListRow`, e os carregamentos usam `Skeleton`.
- Guard de sessao, consultas existentes, roles de insights/aprovacao e contador de notificacoes foram preservados.

### Removido
- `LegacyDashboardScreen`, seus estilos, imports e helpers de renderizacao nao usados.

### Verificado
- `npx expo export --platform web` concluido.
- `npm test`: 44 testes aprovados em 11 arquivos.

## [2026-09-28] - V2-F3: shell e navegacao

### Alterado
- `app/(tabs)/_layout.tsx`: web largo passou a usar sidebar grafite agrupada, `BrandMark`, indicador ativo com motion estrutural sem bounce, topbar com titulo, notificacoes e sair.
- As regras de `roles` continuam centralizadas no mapa de navegacao; Analytics permanece restrito a RH/admin/adm/super_admin, Admin a super_admin, e o contador de ferias pendentes aparece na barra mobile e na sidebar para quem pode aprovar.
- `app/(tabs)/mais.tsx`: os destinos fora das quatro acoes primarias agora usam os mesmos grupos e filtros de perfil do desktop, incluindo Onboarding e Pesquisas.

### Verificado
- `npx expo export --platform web` concluido.
- `npm test`: 44 testes aprovados em 11 arquivos.

## [2026-09-28] - V2-F4: Login V2

### Alterado

- `app/login.tsx`: login redesenhado como um cartão central em fundo grafite liso, usando somente `BrandMark`, `Input` e `Button` compartilhados e os tokens do sistema.
- Removidos o gradiente, halos, `Field` local e valores de cor locais; foco dos campos, erro inline, confirmação breve de sucesso e entrada curta respeitando redução de movimento ficaram padronizados.

## [2026-09-28] - V2-F1F2: sistema de design e motion

### Adicionado
- `estilo/espaco.ts`: escala espacial, raios de controle/cartao, elevacao minima de overlay, camadas e alvo de toque de 44 px.
- `estilo/movimento.ts`: duracoes de 100/140/200/280 ms, curvas de entrada/saida e `useMotion()` integrado a `useReducedMotion()`.
- Componentes base: `Drawer`/`Sheet`, `Skeleton`, `MetricCard`, `Section`, `ListRow`, `Avatar`, `StatusPill`, `ProgressBar` e `BrandMark`.

### Alterado
- `estilo/cores.ts` passou a expor grupos semanticos de superficie, texto, borda, accent, status, sidebar, foco e elevacao; os nomes antigos permanecem como compatibilidade de migracao.
- `estilo/tipografia.ts` centraliza escala Inter para a UI e reserva Cormorant para a marca.
- `Button`, `Input`, `Card`, `Badge`, `Modal`, `EmptyState`, `ScreenHeader` e Toast usam somente tokens, tem foco visivel/alvos de 44 px quando interativos e removem gradientes, halos e spring com bounce.
- Motion funcional aplicado a press, foco, modal, drawer, toast, badge/status, skeleton e barra de progresso; reducao de movimento usa fade curto ou transicao sem deslocamento.

### Verificado
- `npx expo export --platform web` concluido.
- `npm test`: 44 testes aprovados em 11 arquivos.
- Busca em `componentes/` e `contextos/` sem hex/`rgba`, sem spring/bounce/loops, com verificacao de codificacao aprovada.

## [2026-09-28] — Bug crítico: criar conta de usuário sempre quebrava (500)

### Corrigido
- **`POST /api/users` (criar conta na Admin) sempre retornava 500.** A coluna `users.username` é `NOT NULL UNIQUE` no banco (usada no login) e já existia em produção, mas nunca tinha sido documentada em `banco/schema.sql` nem em `banco/migrations/`. O `INSERT` do endpoint nunca preenchia esse campo, mesmo o formulário da Admin já coletando e enviando `username` — toda criação de conta violava a constraint e caía num 500 sem explicação. Corrigido: `username` é normalizado (trim + minúsculas), validado e gravado; erro de duplicidade agora retorna 409 em vez de 500. Adicionada `banco/migrations/013_username_column.sql` (no-op em produção, documenta a coluna) e `username` foi incluído em `banco/schema.sql` e nas respostas de GET/PUT.
- Achado durante depuração ao vivo com o Carlo (diagnóstico direto no banco de produção reproduzindo o INSERT do endpoint).

### Alterado (temporário, a revisar)
- **Email deixou de ser obrigatório ao criar conta de usuário** (pedido do Carlo, 2026-09-28). Sem email informado, a API gera um placeholder (`usuario@sememail.local`) — o campo continua `NOT NULL UNIQUE` no banco, então algo precisa preenchê-lo. Editar conta continua exigindo email. Revisar esse fluxo quando o requisito de email for definido.

### Adicionado
- 4 testes de regressão em `tests/users.test.ts` cobrindo: falta de username, normalização do username, placeholder de email, e email inválido quando informado.

## [2026-09-25] — RH-002 Auditoria de lógica e RH-003 Email de feedback

### Corrigido
- Ausências: validação estrita de datas civis, proteção contra períodos invertidos, acesso de colaborador restrito ao próprio histórico, edição/exclusão apenas enquanto pendente e bloqueio de reaprovação.
- Férias e banco de horas: criação autoaprovada e aprovação debitam o saldo na mesma instrução SQL que grava a ausência.
- Isolamento/RBAC: etapas de onboarding, limpeza de processo, notificações pessoais e departamento-alvo de pesquisa passaram a respeitar o tenant do JWT.
- Agenda: próximos eventos usam o fuso `America/Sao_Paulo`.
- Telas: Admin e Avisos usam `helpers/confirm.ts`; falhas de ações e carregamentos relevantes mostram Toast sem atualizar estado prematuramente.

### Adicionado
- `api/_email.ts`: cliente Resend reutilizável, validação de destinatário e template HTML em português.
- Email para o destinatário de um **reconhecimento (Kudos)**, enviado depois da persistência; sem CPF, salário ou dado de saúde e isolado da criação por `try/catch`.
- Regressões Vitest para ausências, email/Resend, reconhecimento entre empresas, onboarding, pesquisas e fuso da agenda.

### Verificado
- `npx tsc --noEmit` sem erros.
- `npm test -- --run`: 30 testes em 10 arquivos, todos aprovados.

## [2026-09-25] — RH-001: redesign visual claro

### Alterado
- Tema visual migrado para a paleta clara de referência Araujo Prev: fundo quente, cartões brancos, bordas discretas, dourado sóbrio e tokens semânticos em `estilo/cores.ts` com aliases de compatibilidade.
- Carregadas as famílias Inter e Cormorant Garamond via `expo-font`; títulos, marca e componentes novos adotam a tipografia.
- Login redesenhado inteiramente em fundo claro `#F4F0EA`, com cartão branco, halo dourado sutil e sem animação decorativa.
- Dashboard e Equipe passaram a usar a hierarquia clara, textos legíveis e componentes compartilhados; removida a animação decorativa da lista de Equipe.
- Navegação responsiva: barra lateral escura no web amplo e cinco abas compactas no celular, com a nova tela `Mais` para módulos secundários.
- `app.json` e StatusBar configurados para aparência clara.

### Adicionado
- Componentes compartilhados: `Card`, `Button`, `Input`, `AppModal`, `Badge`, `EmptyState` e `ScreenHeader`.

### Validação
- `npx tsc --noEmit` passou sem erros novos.
- `npm test` permanece com duas falhas preexistentes em `tests/absences.test.ts`, causadas pelo mock sem `createAbsenceRecord`; nenhuma API ou lógica foi alterada nesta tarefa.

## [2026-09-25] — Maestri Fase 0: governança multi-agente (só documentação)

### Alterado
- `CLAUDE.md` reescrito para o SuperRH real (Expo/TypeScript/Vercel/Neon/Vitest). O anterior era um modelo genérico de Python (pytest, `app/main.py`, `requirements.txt`) que não batia com o projeto.

### Adicionado
- `docs/maestri/`: controle do projeto e níveis de risco, regras de arquitetura (`company_id` do JWT, efeitos colaterais, IA, tema), log de decisões e checklist de release (push na `main` = deploy).

- `docs/maestri/09_SKILLS_POLICY.md` e seção "Skill routing" no `CLAUDE.md`: o Maestri escolhe skills conforme a tarefa (pré-flight, ordem e precedência).

### Observação
- `RULES.md` ainda cita Python (type hints, try/except); não foi alterado nesta fase.

## [2026-08-04] (parte 2) — CORS restrito + Alert.alert corrigido em todo o app

### Corrigido
- **CORS permissivo**: `api/_lib.ts` `cors()` respondia `Access-Control-Allow-Origin: *` pra qualquer origem — achado real do scan de segurança do Vulnary (`rules.vulnary-cors-permissive`, `api/_lib.ts:27`). Agora restringe a uma allowlist (produção + `localhost:8081`/`19006` de dev), configurável via `CORS_ORIGIN` (já documentada em `.env.example`, nunca foi lida até agora). Os 12 endpoints que chamavam `cors(res)` foram atualizados pra `cors(req, res)`.
- **`Alert.alert` mudo na web em todo o resto do app**: `react-native-web` implementa `Alert.alert` como função vazia — todo confirm/dialog não fazia nada na versão web (que é como o app roda em produção). Corrigidos os 6 arquivos que ainda restavam desde a sessão anterior: `colaborador/[id].tsx` (excluir colaborador, remover holerite), `pesquisas/index.tsx`, `onboarding/index.tsx`, `onboarding/[id].tsx`, `reconhecimentos.tsx`, `(tabs)/_layout.tsx` (logout) — usando o `helpers/confirm.ts` (`confirmAction`) já criado. Dois desses arquivos já tinham gambiarra manual com `window.confirm` duplicada; unificado no helper compartilhado. **Zero `Alert.alert` restante no app.**

### Segurança
- **Credencial de produção exposta**: `Desktop\SuperRH_projet\SuperRH\debug_db.mjs` tinha a senha do Neon em texto puro (achado documentado desde 28/07 no scan do Vulnary, nunca resolvido). Arquivo apagado e senha do Neon **rotacionada** em 2026-08-04; `DATABASE_URL` atualizada na Vercel (produção) e redeploy feito.

## [2026-08-04] — Correção de datas, licenças granulares, banco de horas e ações da IA

### Corrigido
- **Bug crítico "data NaN" na tela de Férias**: `formatDateShort`/`formatDateDisplay`/`getDayOfWeek` em `helpers/datas.ts` faziam `dateStr.split('-')` direto na string vinda da API. Quando a coluna `date` do Postgres/Neon vem serializada como timestamp completo (`"2026-07-01T00:00:00.000Z"`), isso quebrava o dia (`NaN`). Corrigido usando `ymd()` antes do split — mesmo padrão já usado em `app/colaborador/[id].tsx`. Afetava também Dashboard (`index.tsx`) e Agenda (`agenda.tsx`), que usam as mesmas funções.

### Adicionado
- **Abas "Licença Maternidade" e "Licença Paternidade"** no filtro da tela de Férias (`app/(tabs)/ferias.tsx`) — esses tipos já existiam pra cadastro mas não tinham como ser filtrados depois.
- **Status granular de licença na aba Equipe**: `api/employees/index.ts` já calculava dinamicamente se o colaborador está de férias/licença (via `EXISTS` em `absences` aprovadas cobrindo `CURRENT_DATE`), mas colapsava tudo em `licenca` genérico. Agora retorna o tipo específico (`licenca_medica`/`licenca_maternidade`/`licenca_paternidade`). `EmployeeStatus` (`tipos/modelos.ts`), `STATUS_LABELS`, `STATUS_COLORS` e o filtro da aba Equipe (`app/(tabs)/colaboradores.tsx`, `app/colaborador/[id].tsx`) foram atualizados; o filtro "Licença" continua pegando qualquer variante.
- **Auto-aprovação quando RH/admin/gestor registra a ausência diretamente**: antes, mesmo um lançamento feito pela própria RH caía em "pendente" e precisava de um segundo clique pra aprovar. Agora, se quem cria já tem permissão de aprovar (`CAN_APPROVE_ABSENCES`), o lançamento já entra aprovado, com saldo descontado na hora e notificação pro colaborador (em vez de notificação pra RH pedindo aprovação).
- **Banco de horas de folga**: nova coluna `employees.folga_hours` (migration `banco/migrations/010_folga_hours.sql`) — saldo de horas de compensação, editável no perfil do colaborador (mirror de `vacation_days`). Ausências tipo `folga` aceitam um campo opcional `hours` (`absences.hours`); se informado, desconta/restaura do banco de horas em vez de contar dias inteiros. Validação de saldo insuficiente igual à de férias.
- **Assistente de IA com ações reais** (`api/chat.ts`): antes só respondia perguntas; agora, pra papéis que já podem aprovar férias/ausências (RH/admin/gestor), tem 3 ferramentas via tool-calling do Groq: `criar_ausencia`, `listar_ausencias_pendentes`, `aprovar_ausencia`. Escopo deliberadamente restrito — sem ferramenta pra salário, desligamento ou exclusão de colaborador. O contexto da equipe passou a incluir o `[ID]` de cada colaborador (necessário pra IA referenciar o registro certo) e o status computado (mesma lógica da aba Equipe).

### Refatorado
- Lógica de criar ausência (validação de saldo/sobreposição, inserção, desconto e notificação) extraída de `api/absences/index.ts` POST para `createAbsenceRecord()` em `api/_lib.ts`.
- Lógica de aprovar/recusar ausência extraída de `api/absences/index.ts` PATCH para `resolveAbsenceApproval()` em `api/_lib.ts`.
- Ambas agora são a fonte única usada tanto pelo endpoint REST quanto pelas ferramentas do assistente de IA, evitando duas implementações divergentes da mesma regra de negócio.

### Corrigido (achado durante teste local, não relacionado às mudanças acima)
- **Migrations 007 (`ai_insights`) e 009 (coluna `route` em `notifications`) estavam documentadas como aplicadas no changelog de 18/05 mas nunca tinham rodado de fato em produção.** Isso quebrava a central de notificações (`GET /api/users?notifications=1`, erro `column "route" does not exist`) e os Insights da IA do dashboard (`api/analytics` insights, erro `relation "ai_insights" does not exist`) — bug real e ativo em produção, descoberto porque derrubou o `vercel dev` local ao testar (query sem `.catch()` em `handleNotifications`). Aplicado direto no Neon de produção em 2026-08-04 (`CREATE TABLE IF NOT EXISTS ai_insights`, `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS route`).
- **Causa raiz real da tabela `notifications`: era o desenho antigo de um sistema de notificação agendada multi-canal** (`employee_id`, `channel`, `scheduled_for`, `status`, `payload` — o mesmo que ainda estava documentado em `banco/schema.sql`), nunca usado (0 linhas). A migration 009 tentou recriá-la no formato de central de notificações (`user_id`, `read`) com `CREATE TABLE IF NOT EXISTS`, que é um no-op quando a tabela já existe — por isso nunca migrou de verdade, mesmo "aplicada". Corrigido com `DROP TABLE` + recriação no formato certo (migration `011_fix_notifications_table.sql`, seguro pois a tabela estava vazia) e `banco/schema.sql` atualizado pra refletir o schema real.

### ⚠️ Pendente antes do deploy
- A migration `banco/migrations/010_folga_hours.sql` (`ALTER TABLE employees ADD COLUMN folga_hours`, `ALTER TABLE absences ADD COLUMN hours`) já foi aplicada no Neon de produção em 2026-08-04 — confirmado, não precisa rodar de novo.

## [2026-06-03] — Automação de RH: Fluxo de Aprovação Completo + Rastreabilidade

### Adicionado
- **Seção "Aguardando Aprovação"** em `app/(tabs)/ferias.tsx`: visível apenas para RH/admin/gestor; lista ausências pendentes com botões "Aprovar" e "Recusar" inline — a profissional não precisa mais buscar aprovações manualmente
- **Badge vermelho** na aba Férias em `app/(tabs)/_layout.tsx`: mostra contagem de pendentes em tempo real, atualizada a cada 2 minutos
- **Card de aprovações pendentes** no Dashboard (`app/(tabs)/index.tsx`): visível para RH/admin, clicável e navega direto para a lista de pendentes
- **Notificação push para RH** quando colaborador cria nova ausência (`api/absences/index.ts` POST): equipe RH/admin recebe alerta imediato com tipo, nome e período
- **Validação de saldo de férias** (`api/absences/index.ts` POST): rejeita solicitação com 422 se dias pedidos excedem `vacation_days` disponíveis
- **Validação de sobreposição** (`api/absences/index.ts` POST): rejeita com 409 se já existe ausência no mesmo período
- **Desconto automático de `vacation_days`** ao aprovar férias (`api/absences/index.ts` PATCH): saldo é deduzido automaticamente; se recusado, é restaurado
- **Job cron `vacation-expiry-check`** (`api/cron.ts`): executa diariamente às 8h BRT; detecta colaboradores com férias vencendo em 30 dias e notifica RH
- **Tabela `salary_history`** (`banco/schema.sql`): registra todo histórico de alterações salariais com old_salary, new_salary, data e responsável
- **Soft-delete em `employees`** (`banco/schema.sql`): coluna `deleted_at` preserva dados históricos — DELETE agora é recuperável
- **Validação de CPF** (`helpers/validacoes.ts`): algoritmo de dígitos verificadores, usado em POST e PUT de colaboradores
- `conexoes/ausencias.ts`: funções `countPendentes()` e `getPendingAbsences()` para queries de pendentes

### Corrigido
- **Bug crítico**: `approveAbsence` chamava URL inexistente `/api/absences/:id/approve` — corrigido para `/api/absences/:id` com PATCH
- Tipo `Absence` em `tipos/modelos.ts` não incluía `employee_name` e `role_title` retornados pelo JOIN da API

### Modificado
- `api/employees/index.ts`: PUT registra salary_history ao alterar salário; DELETE usa soft-delete; todas queries filtram `deleted_at IS NULL`
- `api/cron.ts`: relatório semanal agora inclui pendentes de aprovação, férias vencendo e envia info mais rica para IA
- `vercel.json`: novo cron `vacation-expiry-check` agendado para 0 11 * * * (diário 8h BRT)

## [2026-05-18] — UX, IA Proativa e Push Notifications

### Adicionado
- **Sistema de Toast** (`contextos/Toast.tsx`, `componentes/Toast.tsx`): substitui todos os `Alert.alert` bloqueantes por notificações não-bloqueantes com slide animado, 4 tipos (success/error/warning/info), fila de até 3 toasts, auto-dismiss em 3.2s
- **Insights da IA** (`api/insights.ts`, `conexoes/insights.ts`): endpoint GET com cache de 6h por empresa; usa Groq (llama-3.3-70b) para gerar 4 insights prioritários a partir de dados de turnover, clima, onboarding e pesquisas; seção visual no dashboard com botão de atualização forçada
- **Push Notifications** (`componentes/PushProvider.tsx`): solicita permissão Expo, registra token via `POST /api/push`, ouve notificações em foreground e navega ao toque; totalmente não-crítico (falha silenciosa)
- `api/push/index.ts`: endpoint `POST /api/push` salva token Expo com upsert por `(user_id, token)`
- `api/_lib.ts`: helper `sendPush(tokens, title, body, data?)` envia push via Expo Push API (gratuito)
- `banco/migrations/007_ai_insights.sql`: tabela `ai_insights` com TTL de 6h e índice por `(company_id, expires_at)`
- `banco/migrations/008_push_tokens.sql`: tabela `push_tokens` com UNIQUE por `(user_id, token)`

### Modificado
- `app/_layout.tsx`: adicionados `<ToastProvider>` e `<PushProvider>` no root
- `app/(tabs)/index.tsx`: seção "Insights da IA" com cards coloridos por severidade (alto=vermelho, médio=amarelo, baixo=azul)
- `api/absences/index.ts`: ao aprovar/recusar férias → push para o solicitante
- `api/notices/index.ts`: ao fixar aviso → push para todos da empresa
- `api/surveys/index.ts`: ao criar pesquisa → push para todos da empresa
- `api/cron.ts`: onboarding atrasado → push para o responsável + email (anterior)
- `app.json`: plugin `expo-notifications` adicionado com cor dourada

### Substituído
- Todos os `Alert.alert('Erro', ...)` e `Alert.alert('Sucesso', ...)` em 9 arquivos substituídos por `toast.error()` / `toast.success()` / `toast.warning()` — `Alert.alert` mantido apenas para diálogos de confirmação destrutiva

## [2026-05-18] — Qualidade de Código e Documentação

### Adicionado
- `docs/architecture.md` — documentação completa de arquitetura: stack, fluxo de dados, multitenancy, RBAC, JWT, módulos, decisões técnicas
- `reports/bugs_found.md` — registro formal de todos os bugs encontrados e corrigidos (10 bugs documentados)
- `api/_lib.ts`: helper `parsePagination(query, opts?)` centraliza lógica de paginação com suporte a limites customizáveis por endpoint
- `api/cron.ts`: funções `fetchOnboardingStatus()` e `fetchClimateScore()` extraídas de `buildWeeklyContext()` para respeitar o limite de responsabilidade única

### Corrigido
- `api/chat.ts`: `.catch(() => [])` substituído por `.catch((e) => { log; return []; })` em 3 queries — erros de banco agora são logados com timestamp e contexto
- `api/cron.ts`: mesmo padrão aplicado em `buildWeeklyContext()` — falhas nas queries de onboarding e clima agora são rastreáveis

### Refatorado
- `api/employees/index.ts`: paginação substituída por `parsePagination(req.query)`
- `api/users/index.ts`: paginação substituída por `parsePagination(req.query)`
- `api/notices/index.ts`: paginação substituída por `parsePagination(req.query)`
- `api/recognitions/index.ts`: paginação substituída por `parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 })`
- `api/absences/index.ts`: paginação substituída por `parsePagination(req.query)`

## [2026-05-15] — Melhorias v2.0 (Feedback Técnico)

### Adicionado
- `api/cron/onboarding-reminders.ts` — Vercel Cron diário (8h BRT): detecta etapas de onboarding atrasadas e envia email via Resend ao responsável
- `api/cron/weekly-report.ts` — Vercel Cron toda segunda-feira (7h BRT): gera resumo executivo com Groq e envia por email para rh/admin/super_admin
- Histórico de clima organizacional (`climate_history`) na resposta de `GET /api/analytics` — últimos 6 meses de média das pesquisas de pulso
- Gráfico de barras verticais "Clima Organizacional" na tela `analytics.tsx` com cores por faixa (verde/amarelo/vermelho)
- Antifraude nas pesquisas de pulso: `voter_token` anônimo gerado no dispositivo, persistido em AsyncStorage, enviado na resposta e verificado no backend (409 se já respondeu)
- `banco/migrations/005_survey_antifraud.sql` — coluna `voter_token` em `pulse_responses` com índice único `(survey_id, voter_token)`
- `banco/migrations/006_analytics_engagement.sql` — atualiza `vw_employee_analytics` com fator de engajamento (média de pulso da empresa nos últimos 30 dias)
- `avg_pulse_score` exibido na lista de colaboradores em atenção na tela de analytics

### Corrigido
- `api/analytics/index.ts` — removidos todos os `any`, tipagem explícita com interfaces locais e tipos de `modelos.ts`
- `app/(tabs)/analytics.tsx` — `catch (e: any)` substituído por `catch (e: unknown)`, card de erro inteligente que diferencia sessão expirada / sem conexão / erro de banco
- `app/responder/[id].tsx` — `catch (e: any)` corrigido para `unknown`, mensagem amigável quando pesquisa já foi respondida

### Tipos
- `EmployeeAtRisk` — novo campo opcional `avg_pulse_score?: number | null`
- `ClimateHistory` — novo tipo `{ month, avg_score, response_count }`
- `AnalyticsOverview` — novo campo `climate_history: ClimateHistory[]`

## [2026-05-15] — Correção exportação ICS / Google Calendar

### Corrigido
- `helpers/ics.ts`: adicionado campo `DTSTAMP` obrigatório (RFC 5545) que o Google Calendar exigia para aceitar o arquivo
- `helpers/ics.ts`: adicionado `TZID=America/Sao_Paulo` nos campos `DTSTART` e `DTEND` para evitar eventos no horário errado
- `helpers/ics.ts`: adicionado `X-WR-CALNAME` e `X-WR-TIMEZONE` no cabeçalho do VCALENDAR

## [2026-05-08] — Testes, Paginação e Rate Limiting

### Adicionado
- Vitest configurado (`vitest.config.ts`) com 13 testes automatizados cobrindo users, notices e absences
- `tests/users.test.ts` — 7 cenários: criação, duplicata, senha curta, role inválido, nome vazio, auto-exclusão, acesso negado
- `tests/notices.test.ts` — 3 cenários: criação com sucesso, sem permissão, pin sem boolean
- `tests/absences.test.ts` — 2 cenários: funcionário de outra empresa, type inválido
- Scripts `test`, `test:watch`, `test:coverage` no `package.json`
- Rate limiting no login: máx 5 tentativas falhas em 15 minutos por email (HTTP 429)
- Tabela `login_attempts` para rastrear tentativas falhas sem Redis externo
- Migration `docs/migrations/002_login_attempts.sql`
- Paginação em todos os GETs: `page`, `limit` (máx 100), retorna `{ data, total, page, limit, totalPages }`
  - GET /api/employees
  - GET /api/absences
  - GET /api/notices
  - GET /api/users

### Corrigido
- `conexoes/colaboradores.ts`: atualizado para extrair `.data` da resposta paginada
- `conexoes/ausencias.ts`: atualizado para extrair `.data` da resposta paginada
- `conexoes/avisos.ts`: atualizado para extrair `.data` da resposta paginada
- `conexoes/usuarios.ts`: atualizado para extrair `.data` da resposta paginada

## [2026-05-08] — Módulo de Admin, Mural de Avisos e Correções de Segurança

### Adicionado
- Tela de gerenciamento de usuários (`app/(tabs)/admin.tsx`) — exclusivo para super_admin
- API CRUD de usuários (`api/users/index.ts`, `api/users/[id].ts`)
- Tela de mural de avisos (`app/(tabs)/avisos.tsx`) com suporte a pin e prioridades
- API CRUD de avisos (`api/notices/index.ts`, `api/notices/[id].ts`)
- Campo `salary` visível e editável no detalhe do colaborador (admin/rh)
- Tabs "Avisos" e "Admin" na barra de navegação
- `VALID_ROLES` e `SystemRole` centralizados em `api/_lib.ts`
- `reports/security_report.md` com análise completa de vulnerabilidades
- `reports/tests_pending.md` com cenários de teste mapeados

### Corrigido
- Cross-tenant injection: `employee_id` em POST /api/absences agora validado contra `company_id`
- Prompt injection no chat IA: `role` das mensagens sanitizado para aceitar apenas `user`/`assistant`
- PATCH /api/notices/:id: `pinned` sem validação boolean que causaria violação de constraint
- PUT /api/users/:id: COALESCE com string vazia após trim era inserida em branco
- Tela admin.tsx: acesso direto por rota agora bloqueado com guard de role na tela
- Enum `type` em POST /api/absences sem validação prévia ao INSERT

### Removido
- Módulo de processos jurídicos (fora do escopo de RH)

## [2026-09-28] — Redesign V2, telas de gestão

### Alterado
- `app/(tabs)/admin.tsx` — administração migrada para componentes e tokens V2, com estados de lista, criação/edição, exclusão e bloqueio de `super_admin` preservados.
- `app/pesquisas/index.tsx` e `app/pesquisas/[id].tsx` — criação, listagem e resultados migrados para métricas, listas, modal e barras de progresso compartilhadas.
- `app/onboarding/index.tsx` e `app/onboarding/[id].tsx` — processos e checklist migrados, preservando filtros, prazos, marcação de etapas e encerramento confirmado.
- `app/colaborador/[id].tsx` — perfil, edição por papel, ausências, holerites e início de onboarding migrados para os componentes V2.

### Qualidade
- As telas migradas usam tokens sem hex/rgba locais, estados de carregamento/vazio/erro, foco via componentes compartilhados e motion funcional.
- Validação por tela: `npx expo export --platform web` e `npm test` (48 testes aprovados).

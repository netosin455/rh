# Changelog — SuperRH

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

# Changelog — SuperRH

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

# Changelog — SuperRH

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

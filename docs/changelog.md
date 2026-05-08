# Changelog — SuperRH

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

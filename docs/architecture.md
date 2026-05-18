# Arquitetura — SuperRH

## Visão Geral

SuperRH é uma plataforma de gestão de Recursos Humanos para escritórios de advocacia. O sistema é composto por um app mobile/web em React Native (Expo) e uma API serverless na Vercel, com banco de dados PostgreSQL gerenciado pelo Neon.

---

## Stack Tecnológico

| Camada | Tecnologia | Motivo da escolha |
|--------|-----------|-------------------|
| Frontend | React Native + Expo 55 | App mobile e web com um único codebase |
| Roteamento | Expo Router (file-based) | Convenção clara, suporte a rotas dinâmicas |
| Backend | Vercel Functions (Node.js) | Serverless, zero infra, escala automática, deploy integrado com GitHub |
| Banco de dados | PostgreSQL via Neon | Serverless Postgres, cold start baixo, compatível com Vercel Functions |
| Autenticação | JWT (jsonwebtoken) | Stateless, sem sessão no servidor, simples de validar em cada rota |
| Hashing | bcryptjs | Padrão seguro para senhas, sem dependência nativa |
| IA | Groq (llama-3.3-70b) | Inferência rápida, API compatível com OpenAI, custo baixo |
| Email | Resend | API moderna, simples de integrar, template HTML nativo |
| Testes | Vitest | Compatível com TypeScript, rápido, API familiar (jest-like) |

---

## Fluxo de Dados

```
React Native App
    │
    │  HTTP/HTTPS (Bearer JWT)
    ▼
Vercel Functions (api/*.ts)
    │
    ├── Autentica JWT em _lib.ts
    ├── Valida permissão de role
    ├── Valida inputs
    │
    │  SQL parametrizado (@neondatabase/serverless)
    ▼
PostgreSQL — Neon (serverless)
    │
    └── Retorna dados isolados por company_id
```

---

## Multitenancy

Todo dado sensível é isolado por `company_id`. Esta coluna está presente em todas as tabelas principais:

- `employees.company_id`
- `absences.company_id`
- `events.company_id`
- `notices.company_id`
- `recognitions.company_id`
- `pulse_surveys.company_id`
- `onboarding_processes.company_id`

O `company_id` vem do JWT do usuário autenticado (`ctx.company_id`) e é injetado em todas as queries — nunca vem do corpo da requisição. Isso impede cross-tenant injection.

---

## RBAC — Controle de Acesso por Role

Hierarquia de permissões (do mais ao menos privilegiado):

```
super_admin → admin → rh / gestor / financeiro / juridico / ti / adm → colaborador
```

Permissões centralizadas em `api/_lib.ts`:

| Constante | Roles | Usado em |
|-----------|-------|----------|
| `CAN_MANAGE_EMPLOYEES` | super_admin, admin, rh, adm | CRUD de colaboradores |
| `CAN_APPROVE_ABSENCES` | super_admin, admin, rh, adm, gestor | Aprovação de férias |
| `IS_ADMIN` | super_admin, admin | Gestão de usuários |

---

## Autenticação JWT

Fluxo completo:

```
1. POST /api/auth/login
   ├── Verifica rate limit (5 tentativas / 15 min por email)
   ├── Busca usuário pelo email
   ├── Compara senha com bcrypt.compare()
   └── Retorna JWT assinado com { sub, company_id, role, name, email }

2. Requisições autenticadas
   ├── Header: Authorization: Bearer <token>
   ├── _lib.authenticate() verifica assinatura e expiração
   └── Retorna JWTPayload tipado para uso nas queries
```

- Expiração: 7 dias (recomendação futura: reduzir para 24h + refresh token)
- Secret: `JWT_SECRET` obrigatório via variável de ambiente
- Token não é armazenado no banco (sem revogação — risco aceito no MVP)

---

## Estrutura de Módulos

```
SuperRH/
├── app/                    # UI — Expo Router
│   ├── (tabs)/             # Abas da navegação principal
│   │   ├── index.tsx       # Dashboard
│   │   ├── colaboradores.tsx
│   │   ├── ferias.tsx
│   │   ├── agenda.tsx
│   │   ├── analytics.tsx
│   │   ├── avisos.tsx
│   │   ├── ia.tsx
│   │   ├── reconhecimentos.tsx
│   │   └── admin.tsx       # Exclusivo super_admin
│   ├── colaborador/[id].tsx
│   ├── onboarding/
│   ├── pesquisas/
│   └── login.tsx
│
├── api/                    # Backend — Vercel Functions
│   ├── _lib.ts             # Utilitários: sql, JWT, cors, RBAC, parsePagination
│   ├── auth/login.ts
│   ├── users/
│   ├── employees/
│   ├── absences/
│   ├── events/
│   ├── notices/
│   ├── recognitions/
│   ├── surveys/
│   ├── onboarding/
│   ├── analytics/
│   ├── chat.ts
│   └── cron.ts
│
├── conexoes/               # Clientes HTTP do frontend → API
│   ├── http.ts             # Fetch base com Authorization header
│   └── *.ts               # Um arquivo por domínio
│
├── contextos/
│   └── Autenticacao.tsx    # AuthContext global com JWT no AsyncStorage
│
├── tipos/
│   └── modelos.ts          # 19 interfaces TypeScript centralizadas
│
├── helpers/
│   ├── datas.ts
│   ├── ics.ts              # Exportação para Google Calendar (RFC 5545)
│   └── pdf.ts
│
├── banco/
│   ├── schema.sql
│   ├── seeds/
│   └── migrations/         # 006 migrations aplicadas em ordem
│
└── tests/
    ├── users.test.ts       # 7 testes
    ├── notices.test.ts     # 3 testes
    └── absences.test.ts    # 2 testes
```

---

## Padrão de Paginação

Todos os endpoints GET de coleção seguem o mesmo contrato:

**Request:** `GET /api/employees?page=1&limit=50`

**Response:**
```json
{
  "data": [...],
  "total": 120,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

O helper `parsePagination()` em `api/_lib.ts` centraliza o parsing de `page` e `limit`, evitando duplicação.

---

## Cron Jobs

Dois jobs configurados no Vercel Cron, ambos via `GET /api/cron?job=<nome>`:

| Job | Frequência | O que faz |
|-----|-----------|-----------|
| `onboarding-reminders` | Diário às 8h BRT (11h UTC) | Detecta etapas atrasadas e envia email ao responsável via Resend |
| `weekly-report` | Segunda-feira 7h BRT (10h UTC) | Gera resumo com Groq e envia por email para rh/admin/super_admin |

Autenticação dos crons: header `x-vercel-cron: 1` (Vercel) ou `Authorization: Bearer <CRON_SECRET>`.

---

## Variáveis de Ambiente

| Variável | Onde é usada | Obrigatória |
|----------|-------------|-------------|
| `DATABASE_URL` | `api/_lib.ts` (neon) | Sim |
| `JWT_SECRET` | `api/_lib.ts` (sign/verify) | Sim |
| `CORS_ORIGIN` | `api/_lib.ts` (CORS header) | Recomendado em produção |
| `GROQ_API_KEY` | `api/chat.ts`, `api/cron.ts` | Sim |
| `RESEND_API_KEY` | `api/cron.ts` (emails) | Sim (crons) |
| `CRON_SECRET` | `api/cron.ts` (autenticação manual) | Recomendado |
| `EXPO_PUBLIC_API_URL` | Frontend e cron (links nos emails) | Sim em produção |

---

## Decisões de Arquitetura

**Por que Vercel Functions em vez de servidor dedicado?**
Zero infra para gerenciar. Deploy automático via push no GitHub. Escala horizontal automática. Custo proporcional ao uso — ideal para MVP.

**Por que Neon (Postgres serverless) em vez de Supabase ou PlanetScale?**
Postgres puro sem abstrações. Cold start aceitável para uso interno. Compatível com `@neondatabase/serverless` que funciona em edge/serverless sem drivers nativos.

**Por que JWT sem refresh token no MVP?**
Simplicidade de implementação. O risco de token sem revogação foi aceito com expiração de 7 dias. Para produção madura: implementar blacklist no banco ou Redis.

**Por que Groq em vez de OpenAI?**
Inferência 10x mais rápida, custo menor, suficiente para assistente de RH com contexto limitado. Modelo llama-3.3-70b tem qualidade comparável para português.

**Por que tipos centralizados em `tipos/modelos.ts`?**
Evita definir a mesma interface em múltiplos arquivos. Frontend e backend compartilham os mesmos contratos de dados via importação direta.

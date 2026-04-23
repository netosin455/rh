# SuperRH — Gestão Jurídica & Recursos Humanos

Sistema completo de RH para escritórios de advocacia.
Design dark premium: Preto · Dourado · Branco.

---

## Stack Tecnológica

| Camada       | Tecnologia                          |
|--------------|-------------------------------------|
| Mobile       | React Native + Expo Router          |
| Linguagem    | TypeScript (strict)                 |
| API          | Vercel Serverless Functions         |
| Banco        | Neon PostgreSQL (serverless)        |
| Auth         | JWT (7d) + bcrypt                   |
| IA           | Groq API (llama-3.3-70b)            |
| Notificações | Expo Push + Email (Resend)          |

---

## Estrutura de Pastas

```
SuperRH/
├── app/
│   ├── _layout.tsx          # Root layout + AuthProvider
│   ├── login.tsx            # Tela de login
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar
│       ├── index.tsx        # Dashboard
│       ├── colaboradores.tsx
│       ├── processos.tsx
│       ├── agenda.tsx
│       ├── ferias.tsx
│       └── ia.tsx           # Assistente IA
├── api/                     # Vercel Serverless Functions
│   ├── _lib.ts              # db, auth, cors
│   ├── auth/
│   │   └── login.ts
│   ├── employees/
│   │   ├── index.ts         # GET, POST
│   │   └── [id].ts          # GET, PUT, DELETE
│   ├── cases/
│   │   ├── index.ts
│   │   └── [id].ts
│   ├── events/
│   │   ├── index.ts
│   │   └── [id].ts
│   ├── absences/
│   │   ├── index.ts
│   │   └── [id].ts
│   └── chat.ts
├── components/
│   ├── GoldDivider.tsx
│   ├── StatusPill.tsx
│   ├── EmployeeCard.tsx
│   ├── CaseCard.tsx
│   └── AI/
│       ├── AIChat.tsx
│       └── MessageBubble.tsx
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   ├── useEmployees.ts
│   ├── useCases.ts
│   ├── useEvents.ts
│   ├── useAbsences.ts
│   └── useAI.ts
├── services/
│   ├── api.ts              # apiFetch centralizado
│   ├── employees.ts
│   ├── cases.ts
│   ├── events.ts
│   └── absences.ts
├── theme/
│   └── index.ts            # Paleta completa
├── types/
│   └── index.ts            # Todos os tipos
├── utils/
│   └── dateUtils.ts
└── schema/
    └── schema.sql          # PostgreSQL completo
```

---

## Paleta de Cores

```ts
bg:        '#09090B'  // Preto profundo
surface:   '#111114'  // Superfície
gold:      '#C9A84C'  // Dourado principal
goldLight: '#E2C97E'  // Dourado claro
text:      '#F2F0EA'  // Off-white quente
```

---

## Módulos do Sistema

### 1. Dashboard
- Métricas em tempo real (colaboradores, processos, eventos)
- Aniversários do dia com notificação automática
- Próximos eventos e prazos
- Processos urgentes em destaque

### 2. Colaboradores
- Cadastro completo (dados pessoais, OAB, área jurídica)
- Status: Ativo, Férias, Licença, Afastado, Desligado
- Histórico de ausências por colaborador
- Aniversários automáticos

### 3. Processos Jurídicos
- Número do processo, cliente, área, responsável
- Status: Ativo, Em Andamento, Urgente, Encerrado
- Vinculação de audiências à agenda
- Alertas de prazo automáticos

### 4. Agenda
- Calendário mensal com marcadores por categoria
- Categorias: Audiência, Reunião, Prazo, Perícia
- Vinculação de eventos a processos
- IA para criar eventos por linguagem natural

### 5. Férias & Ausências
- Solicitação pelo colaborador
- Aprovação em múltiplos níveis (Gestor → RH)
- Calendário de ausências do time
- Controle de saldo de dias disponíveis

### 6. Assistente IA
- Chat em linguagem natural
- Cria eventos, lista agenda, consulta processos
- Contexto completo da empresa no prompt
- Powered by Groq (llama-3.3-70b)

---

## Permissões (RBAC)

| Ação                       | Super Admin | Admin | RH | Gestor | Colaborador |
|----------------------------|:-----------:|:-----:|:--:|:------:|:-----------:|
| Ver dashboard              | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gerenciar colaboradores    | ✓ | ✓ | ✓ | — | — |
| Aprovar férias             | ✓ | ✓ | ✓ | ✓ | — |
| Ver processos              | ✓ | ✓ | ✓ | ✓ | — |
| Gerenciar processos        | ✓ | ✓ | — | — | — |
| Configurar empresa         | ✓ | ✓ | — | — | — |

---

## Setup Inicial

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Preencher: EXPO_PUBLIC_API_URL, DATABASE_URL, JWT_SECRET, GROQ_API_KEY

# 3. Criar banco de dados
# Rodar schema/schema.sql no Neon PostgreSQL

# 4. Criar usuário admin
# Inserir via SQL com bcrypt hash da senha

# 5. Rodar o app
npx expo start
```

---

## Próximas Funcionalidades (Roadmap)

- [ ] Integração WhatsApp (Evolution API) para notificações
- [ ] Onboarding digital de novos colaboradores
- [ ] Relatórios PDF de RH e processos
- [ ] Integração Google Calendar (OAuth)
- [ ] Holerite digital no app
- [ ] Dashboard de indicadores (turnover, headcount por área)
- [ ] SSO Google Workspace

---

*SuperRH · Construído sobre a base do AgendaAI · 2026*

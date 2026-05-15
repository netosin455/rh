# 🧠 SuperRH — Prompt Estratégico para Claude Code

> Cole este prompt no início de qualquer sessão com o Claude Code para garantir
> contexto completo, decisões consistentes e código alinhado com a arquitetura existente.

---

## 🎯 Contexto do Projeto

Você está trabalhando no **SuperRH**, um sistema interno de gestão de Recursos Humanos
desenvolvido para um **escritório de advocacia**. O app é utilizado **exclusivamente pela
equipe de RH e gestores** — colaboradores comuns não têm acesso.

Este não é um CRUD genérico. É uma ferramenta estratégica de gestão de pessoas, com
design premium e funcionalidades que precisam refletir as melhores práticas modernas de RH:
People Analytics, Employee Experience e IA como parceira de decisão.

---

## 🏗️ Stack Tecnológica (não alterar sem justificativa)

| Camada        | Tecnologia                              |
|---------------|-----------------------------------------|
| Mobile        | React Native + Expo Router              |
| Linguagem     | TypeScript (strict mode — sem `any`)    |
| API           | Vercel Serverless Functions             |
| Banco         | Neon PostgreSQL (serverless)            |
| Auth          | JWT (7 dias) + bcrypt                   |
| IA            | Groq API — modelo `llama-3.3-70b`       |
| Notificações  | Expo Push Notifications + Resend (email)|
| Deploy Mobile | Expo / EAS                              |
| Deploy API    | Vercel                                  |

---

## 🎨 Design System — Dark Premium (seguir rigorosamente)

```ts
// theme/index.ts
export const colors = {
  bg:        '#09090B',  // Preto profundo — background principal
  surface:   '#111114',  // Superfície de cards e modais
  border:    '#1E1E24',  // Bordas sutis
  gold:      '#C9A84C',  // Dourado principal — CTAs, ícones ativos
  goldLight: '#E2C97E',  // Dourado claro — textos em destaque
  goldDim:   '#7A6230',  // Dourado escuro — estados desabilitados
  text:      '#F2F0EA',  // Off-white quente — texto principal
  textMuted: '#8B8B8B',  // Texto secundário / labels
  danger:    '#C0392B',  // Vermelho — erros, alertas críticos
  warning:   '#E67E22',  // Laranja — avisos
  success:   '#27AE60',  // Verde — confirmações
}
```

**Regras de design inegociáveis:**
- Fundo sempre `#09090B` — nunca branco ou cinza claro
- Elementos interativos usam `gold` como cor de destaque
- Cards usam `surface` com borda `border` e `borderRadius: 12`
- Glassmorphism é permitido em modais e overlays: `rgba(17,17,20,0.85)` + `blur`
- Tipografia: títulos em `goldLight`, corpo em `text`, labels em `textMuted`
- Separadores usam o componente `<GoldDivider />` já existente
- Animações: sutis e funcionais — sem exagero. Usar `Animated` do React Native

---

## 📁 Estrutura de Pastas (respeitar a arquitetura existente)

```
SuperRH/
├── app/
│   ├── _layout.tsx              # Root layout + AuthProvider
│   ├── login.tsx
│   └── (tabs)/
│       ├── _layout.tsx          # Tab bar
│       ├── index.tsx            # Dashboard
│       ├── colaboradores.tsx
│       ├── processos.tsx
│       ├── agenda.tsx
│       ├── ferias.tsx
│       └── ia.tsx               # Assistente IA
├── api/                         # Vercel Serverless Functions
│   ├── _lib.ts                  # db, auth helpers, cors
│   ├── auth/login.ts
│   ├── employees/
│   ├── cases/
│   ├── events/
│   ├── absences/
│   └── chat.ts
├── components/
│   ├── GoldDivider.tsx
│   ├── StatusPill.tsx
│   ├── EmployeeCard.tsx
│   ├── CaseCard.tsx
│   └── AI/
│       ├── AIChat.tsx
│       └── MessageBubble.tsx
├── contexts/AuthContext.tsx
├── hooks/                       # useEmployees, useCases, useEvents, useAbsences, useAI
├── services/                    # apiFetch centralizado em api.ts
├── theme/index.ts
├── types/index.ts               # Todos os tipos TypeScript
└── schema/schema.sql
```

**Ao criar novos arquivos:**
- Novas telas → `app/(tabs)/nome-da-tela.tsx`
- Novos endpoints → `api/recurso/index.ts` e `api/recurso/[id].ts`
- Novos hooks → `hooks/useNomeDoRecurso.ts`
- Novos serviços → `services/nomeDoRecurso.ts`
- Novos componentes → `components/NomeDoComponente.tsx`
- Novos tipos → adicionar em `types/index.ts`

---

## 🔐 Sistema de Permissões (RBAC)

O sistema tem 5 níveis. **Sempre validar permissões no backend (`api/_lib.ts`)
e condicionar a UI com base no role do usuário logado (`AuthContext`).**

| Role         | Acesso                                              |
|--------------|-----------------------------------------------------|
| super_admin  | Tudo, incluindo configurações do sistema            |
| admin        | Tudo exceto configurações de sistema                |
| rh           | Colaboradores, férias, analytics, onboarding        |
| gestor       | Ver processos, aprovar férias do seu time           |
| colaborador  | ⚠️ SEM ACESSO AO APP — apenas notificações externas |

**Importante:** Colaboradores não usam o app. Eles recebem comunicações via
Expo Push / email (Resend). O app é exclusivo para RH e gestores.

---

## ✅ Padrões de Código Obrigatórios

### TypeScript
```ts
// ✅ Correto — tipagem explícita
interface Employee {
  id: string
  name: string
  role: 'super_admin' | 'admin' | 'rh' | 'gestor' | 'colaborador'
  area: string
  status: 'ativo' | 'ferias' | 'licenca' | 'afastado' | 'desligado'
}

// ❌ Proibido
const employee: any = {}
```

### API Endpoints (Vercel Serverless)
```ts
// Sempre usar o helper centralizado de _lib.ts
import { db, requireAuth, cors } from '../_lib'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const user = requireAuth(req) // Lança erro se não autenticado
    // lógica aqui
  } catch (err) {
    return res.status(401).json({ error: 'Não autorizado' })
  }
}
```

### Hooks
```ts
// Sempre com loading, error e refetch
export function useEmployees() {
  const [data, setData] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = async () => { /* ... */ }

  useEffect(() => { fetch() }, [])
  return { data, loading, error, refetch: fetch }
}
```

### Componentes
```tsx
// Props tipadas, sem estilos inline fora do StyleSheet
interface Props {
  employee: Employee
  onPress?: () => void
}

export function EmployeeCard({ employee, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {/* ... */}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  }
})
```

---

## 🚀 Roadmap de Implementação — Fases Priorizadas

O app já possui: Dashboard básico, Colaboradores, Processos, Agenda, Férias/Ausências
e Assistente IA com Groq. A seguir estão as evoluções planejadas **em ordem de prioridade**.

---

### FASE 1 — People Analytics (Dashboard Estratégico)
**Prioridade: Alta | Impacto imediato | Dados já existem no banco**

**Objetivo:** Transformar o dashboard operacional em uma central de decisão estratégica.

**Novas métricas a implementar:**

1. **Índice de Risco de Turnover**
   - Algoritmo simples baseado em: ausências recentes + tempo de casa + status
   - Visual: badge colorido (verde/amarelo/vermelho) nos cards de colaborador
   - Card no dashboard: "X colaboradores em risco de evasão"

2. **Headcount por Área Jurídica**
   - Gráfico de barras: Cível, Trabalhista, Tributário, Criminal etc.
   - Identificar áreas sub ou sobredimensionadas

3. **Taxa de Absenteísmo (mensal)**
   - Fórmula: (dias de ausência / dias úteis totais) × 100
   - Comparativo mês a mês

4. **Distribuição de Status**
   - Gráfico de rosca: Ativos / Férias / Licença / Afastados
   - Número absoluto e percentual

5. **Processos Urgentes por Responsável**
   - Ranking: quem está com maior carga de urgentes

**Schema necessário (adicionar em schema.sql):**
```sql
-- Sem novas tabelas para fase 1 — usar dados existentes de employees e absences
-- Criar VIEW para facilitar as queries de analytics:

CREATE VIEW vw_employee_analytics AS
SELECT
  e.id,
  e.name,
  e.area,
  e.status,
  e.hire_date,
  COUNT(a.id) AS total_absences_90d,
  CURRENT_DATE - e.hire_date AS days_in_company,
  CASE
    WHEN COUNT(a.id) >= 5 OR (CURRENT_DATE - e.hire_date) < 180 THEN 'high'
    WHEN COUNT(a.id) >= 2 THEN 'medium'
    ELSE 'low'
  END AS turnover_risk
FROM employees e
LEFT JOIN absences a ON a.employee_id = e.id
  AND a.created_at >= NOW() - INTERVAL '90 days'
GROUP BY e.id;
```

**Novos endpoints:**
- `GET /api/analytics/overview` — todas as métricas consolidadas
- `GET /api/analytics/turnover-risk` — lista de colaboradores com risco

**Nova tela:** `app/(tabs)/analytics.tsx`
- Acesso restrito: `rh`, `admin`, `super_admin`
- Ícone na tab bar: gráfico de barras

---

### FASE 2 — Pulse Surveys (Pesquisas de Pulso)
**Prioridade: Alta | Gera dados novos que alimentam a Fase 1**

**Objetivo:** Coletar feedback periódico dos colaboradores via notificação push,
sem que eles precisem acessar o app.

**Fluxo:**
1. RH cria uma pesquisa no app (pergunta + escala 1-5 ou múltipla escolha)
2. Sistema envia push notification para os colaboradores selecionados
3. Colaborador responde diretamente na notificação (ou em uma web view simples)
4. Resultados aparecem no Analytics Dashboard para o RH

**Schema:**
```sql
CREATE TABLE pulse_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  question TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'scale', -- 'scale' | 'choice'
  options JSONB, -- para tipo 'choice'
  target_group VARCHAR(50) DEFAULT 'all', -- 'all' | área específica
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE pulse_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES pulse_surveys(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  score INTEGER, -- para escala 1-5
  choice VARCHAR(100), -- para múltipla escolha
  responded_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Novos endpoints:**
- `POST /api/surveys` — criar pesquisa e disparar notificações
- `GET /api/surveys` — listar pesquisas
- `POST /api/surveys/[id]/respond` — registrar resposta
- `GET /api/surveys/[id]/results` — resultados consolidados

---

### FASE 3 — Onboarding Digital
**Prioridade: Média | Já estava no roadmap original**

**Objetivo:** Estruturar a entrada de novos colaboradores em uma trilha digital,
garantindo que nada seja esquecido e que o processo seja acolhedor.

**Funcionalidades:**
- Ao cadastrar novo colaborador, RH pode ativar trilha de onboarding
- Trilha com checklist de etapas configurável (ex: "Enviar contrato", "Configurar e-mail",
  "Apresentar ao time", "Agendar reunião com gestor")
- Cada etapa tem responsável (RH ou Gestor) e prazo
- Notificação push/email para o colaborador com boas-vindas e informações iniciais
- Dashboard de onboardings ativos com % de conclusão

**Schema:**
```sql
CREATE TABLE onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  steps JSONB NOT NULL, -- array de { title, description, responsible, days_deadline }
  is_default BOOLEAN DEFAULT false
);

CREATE TABLE onboarding_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  template_id UUID REFERENCES onboarding_templates(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  steps_progress JSONB -- { step_index: { completed: bool, completed_at, completed_by } }
);
```

---

### FASE 4 — IA Proativa (Evolução do Assistente Groq)
**Prioridade: Média | Evolução natural do que já existe**

**Objetivo:** Transformar o assistente de "responde perguntas" para "sugere ações".

**Novas capacidades:**

1. **Análise de Sentimento das Pulse Surveys**
   - IA lê os resultados e gera resumo: "A equipe tributária demonstrou sinais de
     fadiga nas últimas 2 semanas. Média: 2.3/5"

2. **Alertas Proativos**
   - "3 colaboradores estão com risco de turnover alto esta semana"
   - "João Silva tem 15 dias de férias vencendo em 30 dias"
   - Aparecem como cards no dashboard, gerados por cron job (Vercel Cron)

3. **Assistente de Redação de Feedback**
   - Gestor descreve a situação em linguagem natural
   - IA estrutura um feedback construtivo formal

4. **Resumo Semanal Automático**
   - Todo domingo, IA gera e envia por email um resumo da semana:
     ausências, novos processos urgentes, aniversários da próxima semana

**Implementação técnica:**
```ts
// Adicionar ao prompt do sistema em api/chat.ts:
const SYSTEM_PROMPT = `
Você é o assistente de RH do escritório. Além de responder perguntas,
você tem acesso aos seguintes dados em tempo real:
- ${JSON.stringify(analyticsData)}
Seja proativo: se notar padrões preocupantes, mencione sem ser perguntado.
`
```

---

### FASE 5 — Funcionalidades Complementares
**Prioridade: Baixa | Qualidade de vida e completude do sistema**

- **Mural de Reconhecimento:** Colaboradores recebem "medalhas" de colegas,
  registradas e visíveis no perfil (gerenciado pelo RH no app)
- **Relatórios PDF:** Exportar relatórios de ausências, headcount, analytics
- **Integração Google Calendar:** Sincronizar agenda via OAuth
- **SSO Google Workspace:** Login com conta do escritório
- **Holerite Digital:** Upload de PDF do holerite vinculado ao colaborador

---

## 🧪 Quando criar migrações de banco

Sempre que adicionar tabelas ou colunas, criar o SQL em `schema/`:
```
schema/
├── schema.sql          # Schema base completo
├── migrations/
│   ├── 001_analytics_views.sql
│   ├── 002_pulse_surveys.sql
│   ├── 003_onboarding.sql
│   └── ...
```

E atualizar o `apply-schema.mjs` para incluir a migração.

---

## ⚠️ Regras Gerais — Sempre seguir

1. **Nunca usar `any` em TypeScript** — se não sabe o tipo, criar interface
2. **Nunca hardcodar strings** — usar constantes ou enums em `types/index.ts`
3. **Sempre tratar erros** — try/catch em toda chamada async, mensagem de erro amigável na UI
4. **Sempre validar permissão no backend** — não confiar só na UI para controle de acesso
5. **Sempre usar `apiFetch` de `services/api.ts`** — nunca `fetch` diretamente nas telas
6. **Loading states obrigatórios** — toda tela que busca dados precisa de indicador de carregamento
7. **Componentes reutilizáveis** — se um padrão de UI se repete 2x, virar componente
8. **Comentários em português** — o time é brasileiro, manter consistência

---

## 💬 Como pedir ajuda ao Claude Code de forma eficiente

Ao iniciar uma tarefa, sempre informar:
- Qual fase do roadmap está implementando
- Quais arquivos existentes serão modificados
- Se é backend (API), frontend (tela/componente) ou ambos
- Se precisa de migração de banco

**Exemplo de prompt ideal:**
> "Estou na Fase 1 — People Analytics. Preciso criar o endpoint
> `GET /api/analytics/overview` que retorna headcount por área, taxa de absenteísmo
> do mês atual e distribuição de status. Backend apenas por agora. O helper de db
> está em `api/_lib.ts`."

---

*SuperRH · Prompt gerado para uso com Claude Code · 2026*

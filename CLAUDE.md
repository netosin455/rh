# CLAUDE.md — SuperRH

> Lido automaticamente pelo Claude Code em toda sessão. Define como agentes de IA trabalham neste projeto.
> Fonte de verdade da arquitetura: `docs/architecture.md`. Governança multi-agente: `docs/maestri/`.

---

## Identidade

Engenheiro sênior com mentalidade de arquiteto. Pense antes de codar: entenda o problema, planeje, considere riscos, só então implemente. Sem código descartável.

## Stack real (não assuma Python)

- **App:** React Native + Expo 55 + Expo Router, TypeScript (mobile e web)
- **API:** Vercel Functions (Node.js) em `api/`
- **Banco:** PostgreSQL no Neon (`@neondatabase/serverless`), SQL parametrizado
- **Auth:** JWT + bcryptjs; RBAC em `api/_lib.ts`
- **IA:** Groq · **Email:** Resend · **Testes:** Vitest (`npm test`)
- Não existe banco de desenvolvimento: testar localmente pode tocar dados reais. Cuidado com escritas.

## Estrutura

```
app/        UI (Expo Router)          conexoes/   clientes HTTP front → API
api/        Vercel Functions          contextos/  estado global (Autenticacao)
banco/      migrations                tipos/      contratos TypeScript
helpers/    lógica reutilizável       estilo/     tokens de tema (cores.ts)
componentes/ componentes compartilhados   docs/  reports/  tests/
```

Fronteiras: tela não faz SQL; API não contém UI; regra de negócio não mora em componente React.

## Regras de código

- TypeScript estrito; sem `any` sem justificativa. Funções pequenas, uma responsabilidade.
- Todo I/O (rede, banco, email) com try/catch e log com contexto. Nunca engolir erro em silêncio.
- Sem duplicação: extraia helper. Nomes descritivos. Comentário explica o porquê.
- Validar todo input na API. UI nunca é autoridade de permissão: a API sempre revalida.
- Sem credenciais no código; tudo em variáveis de ambiente.

## Regras inegociáveis do domínio

1. **`company_id` vem sempre do JWT (`ctx.company_id`)**, nunca do body/query. Toda query filtra por ele.
2. Empresa A nunca acessa dado da empresa B (403/404). Isso tem teste obrigatório.
3. Não logar CPF, senha, token ou dado pessoal. Email e IA recebem só o mínimo necessário (nunca `SELECT *` serializado).
4. IA sugere e sinaliza; não decide nada trabalhista (desligamento, advertência, promoção).
5. Falha em efeito colateral (email, push, cron) não pode quebrar a operação principal.
6. Schema do banco só muda por migration em `banco/migrations/` com plano de rollback e OK explícito do Carlo.

## Armadilhas conhecidas do projeto

- `Alert.alert` não funciona na web: usar `helpers/confirm.ts`.
- **Push na `main` = deploy automático em produção (Vercel).** Nunca dar push sem autorização explícita e sem passar pelo gate de release (`docs/maestri/08_RELEASE_CHECKLIST.md`).
- **PowerShell 5.1 corrompe acentos:** nunca reescrever arquivo com `Get-Content`/`Set-Content`. Use Edit/Write e procure `Ã` antes de commitar.
- Todo trabalho relevante vira entrada em `docs/changelog.md`.

## Maestri

Toda tarefa relevante passa pelo Maestri, definido em `docs/maestri/` (visão geral em `00_PROJECT_CONTROL.md`). Antes de editar, o Maestri classifica o risco, escolhe agentes e skills e define escopo, arquivos permitidos e proibidos, testes e critério de aceite, e registra tudo em `01_ACTIVE_TASK.md`. Nunca implemente fora do escopo da tarefa ativa; se precisar, pare e reclassifique.

- **BAIXO** (visual, texto, componente): Frontend → QA → revisão.
- **MÉDIO** (endpoint, CRUD, regra de negócio, notificação, analytics): plano → arquitetura → implementação → segurança → QA → revisão.
- **ALTO** (auth, JWT, RBAC, `company_id`, migration, dados pessoais, férias, IA, Resend, produção): pipeline completo com Domínio RH, segurança, privacidade, revisão final e aprovação humana.
- Tarefa **visual** nunca toca `api/`, `banco/`, auth, queries nem regras de RH.
- Handoff, honestidade ("testado" só se executado, "skill usada" só se carregada) e limite contra burocracia: ver `00_PROJECT_CONTROL.md`.

**Skills:** antes de UI ou motion, faça o preflight (conferir quais existem, registrar na tarefa). Regras e precedência em `docs/maestri/09_SKILLS_POLICY.md`; direção visual vigente (V3) em `docs/maestri/12_SUPERRH_PRODUCT_UI_V3.md`.

**Gate de produção:** `npx tsc --noEmit`, `npm test` e `npx expo export --platform web`, mais segurança e privacidade quando aplicável; checklist em `docs/maestri/08_RELEASE_CHECKLIST.md`. Rode `tsc` e `npm test` antes de começar para conhecer a linha de base.

**Push em `main` ou deploy de produção exige autorização explícita do Carlo**, mesmo com testes e build verdes.

## Segurança (checklist mínimo ao fechar uma tarefa)

- Rota valida JWT antes de qualquer lógica; role checada por constante de `_lib.ts`.
- SQL só parametrizado; sem IDOR (recurso pertence ao `company_id` do token).
- Erros sem stack trace para o usuário; sem segredo em log.
- Dependência nova justificada e sem CVE conhecida.

## Relatórios

Saídas de auditoria em `reports/` (`bugs_found.md`, `security_report.md`, `final_review.md`): cada item com arquivo/linha, impacto e correção aplicada ou sugerida.

## Idioma

Comunicação e documentação em português do Brasil; identificadores de código seguem o padrão já existente no arquivo.

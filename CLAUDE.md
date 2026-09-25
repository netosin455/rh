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
- **Push na `main` = deploy automático em produção (Vercel).** Nunca dar push sem passar pelo gate de release (`docs/maestri/08_RELEASE_CHECKLIST.md`).
- **PowerShell 5.1 corrompe acentos:** nunca reescrever arquivo com `Get-Content`/`Set-Content`. Use Edit/Write e procure `Ã` antes de commitar.
- Todo trabalho relevante vira entrada em `docs/changelog.md`.

## Workflow

Classifique a tarefa antes de começar (detalhes em `docs/maestri/00_PROJECT_CONTROL.md`):

- **BAIXO** (estilo, texto, componente visual): implementar → testes/tsc → revisão.
- **MÉDIO** (endpoint, CRUD, regra de negócio, notificação): planejar → implementar → segurança → testes → revisão.
- **ALTO** (auth, RBAC, `company_id`, migration, férias, dados pessoais, IA, integração externa, produção): planejar → arquitetura → implementar → segurança + privacidade → testes → revisão independente → preview → aprovação humana → produção.

## Skill routing (Maestri)

Trabalho de UI ou motion passa por pré-flight: conferir as skills disponíveis, declarar quais serão usadas e avisar se faltar alguma. UI: `impeccable` + `redesign-existing-projects` (Taste como referência estética). Motion: `find-animation-opportunities` → `animate-expo`. Backend, banco e auth não usam skill de design. Precedência: regras do projeto > Maestri > Impeccable > motion > Taste. Detalhes em `docs/maestri/09_SKILLS_POLICY.md`.

Antes de qualquer etapa de implementação: rodar `npx tsc --noEmit` e `npm test` para conhecer a linha de base.

## Segurança (checklist mínimo ao fechar uma tarefa)

- Rota valida JWT antes de qualquer lógica; role checada por constante de `_lib.ts`.
- SQL só parametrizado; sem IDOR (recurso pertence ao `company_id` do token).
- Erros sem stack trace para o usuário; sem segredo em log.
- Dependência nova justificada e sem CVE conhecida.

## Relatórios

Saídas de auditoria em `reports/` (`bugs_found.md`, `security_report.md`, `final_review.md`): cada item com arquivo/linha, impacto e correção aplicada ou sugerida.

## Idioma

Comunicação e documentação em português do Brasil; identificadores de código seguem o padrão já existente no arquivo.

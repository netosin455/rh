# Log de decisões (ADR)

Formato: ID · Data · Problema · Decisão · Motivo · Alternativas · Consequências. Decisão nova entra no fim; decisão superada ganha "Superada por ADR-XXX" e não é apagada. ADR-001 a ADR-011 foram registrados a partir do histórico (changelog e commits) em 2026-09-29.

### ADR-001 · 2026-09-25 · Papéis de Security, Privacy, QA e AI como checklists
- **Problema:** a equipe real é um Maestri e agentes de código, não um agente por papel.
- **Decisão:** esses papéis viram checklists/documentos (`04`–`07`) aplicados pelo Maestri.
- **Motivo:** evitar burocracia sem perder a checagem.
- **Alternativas:** um agente dedicado por papel.
- **Consequências:** revisor independente só existe quando outro agente é recrutado (registrar quando não houve).

### ADR-002 · 2026-09-25 · Um agente por branch e por área de arquivos
- **Problema:** dois agentes editando as mesmas telas geram conflito.
- **Decisão:** frontend e backend em branches separadas; nunca dois agentes no mesmo arquivo.
- **Consequências:** ao fim de cada ciclo, worktrees velhos devem ser removidos (em 2026-09-28 agentes foram recrutados em worktrees obsoletos e tiveram de ser redirecionados para `C:\Users\carlo\rh`).

### ADR-003 · 2026-09-25 · Push na `main` só após preview e checklist de release
- **Problema:** push na `main` deploya em produção (Vercel).
- **Decisão:** nenhum agente decide push ou deploy sozinho; exige autorização explícita do Carlo e o gate de `08_RELEASE_CHECKLIST.md`.
- **Consequências:** reforçada em 2026-09-29 (ver ADR-013).

### ADR-004 · 2026-09-25 · Migration 012 (`employees.email`) antes do código que a usa
- **Problema:** o código novo lê e grava a coluna.
- **Decisão:** aplicar a migration antes do deploy do código.
- **Consequências:** sem ela, editar colaborador e criar reconhecimento quebrariam.

### ADR-005 · 2026-09-25 · Conjunto completo `docs/maestri` (00 a 09)
- **Decisão:** Security, Privacy, IA e QA viram documentos e checklists.

### ADR-006 · 2026-09-25 · Tema claro seguindo o Araujo Prev (login incluído)
- **Problema:** o app era escuro.
- **Decisão:** tema claro nos moldes do Araujo Prev (fundo `#f4f0ea`, dourado `#b8973a`, Inter + Cormorant).
- **Superada por:** ADR-008 (login) e ADR-011 (paleta).

### ADR-007 · 2026-09-25 · Redesign V2 em fases
- **Problema:** a direção visual foi trocada quatro vezes sem fechar.
- **Decisão:** ordem sistema → motion → shell → login → dashboard → telas (plano em `12_UI_V2_PLAN.md`).
- **Consequências:** concluído e mergeado em 2026-09-28.

### ADR-008 · 2026-09-25 · Login próprio do SuperRH
- **Decisão:** o login deixa de copiar o Araujo Prev.
- **Motivo:** o SuperRH precisa de identidade própria.

### ADR-009 · 2026-09-28 · Kudos notifica por canal interno, sem depender de email
- **Problema:** o remetente padrão (`noreply@super-rh.vercel.app`) não pode ser verificado no Resend, e o Carlo não vai comprar domínio agora.
- **Decisão:** Kudos cria notificação interna; o email continua no código, pronto para ativar com domínio.
- **Consequências:** nenhum dos 43 colaboradores tem email ou login vinculado; o gargalo real é o cadastro, não o canal.

### ADR-010 · 2026-09-28 · Máscaras de telefone e CPF no cliente
- **Decisão:** `maskPhone` e `maskCPF` em `helpers/validacoes.ts`, mesmo padrão de `maskDate`.

### ADR-011 · 2026-09-28 · Rejeição do "Modern Law" e nova identidade V3
- **Problema:** a direção bege + dourado + Cormorant + sidebar preta foi rejeitada.
- **Decisão:** índigo (`#4F5BD5`) + grafite claro, referência SaaS moderno, **somente visual**. Protótipo isolado validado com o Carlo antes do código real.
- **Alternativas:** manter o dourado como accent principal.
- **Consequências:** chaves `accent.dourado*` mantidas como nomes legados com valor índigo; dourado só como traço da marca. Direção em `12_SUPERRH_PRODUCT_UI_V3.md`.

### ADR-012 · 2026-09-29 · Araujo Prev é referência de engenharia visual, não de identidade
- **Problema:** o SuperRH herdou a identidade visual do Araujo Prev.
- **Decisão:** o Araujo Prev serve de referência de engenharia (tokens, componentes, método), não de identidade.
- **Consequências:** o SuperRH ganha identidade própria (V3).

### ADR-013 · 2026-09-29 · Push e deploy só com autorização explícita
- **Problema:** `00_PROJECT_CONTROL.md` listava o Claude como quem "faz merge e push".
- **Decisão:** o Claude prepara commit e merge; `git push origin main` e deploy exigem autorização explícita do Carlo, mesmo com testes e build verdes.
- **Consequências:** vale para qualquer agente.

### ADR-014 · 2026-09-29 · `CLAUDE.md` curto, regras detalhadas em `docs/maestri/`
- **Problema:** `CLAUDE.md` grande é ignorado com o tempo.
- **Decisão:** o `CLAUDE.md` guarda a constituição e um bloco `## Maestri` que aponta para `docs/maestri/`.

### ADR-015 · 2026-09-29 · Gate de tipos usa `npx tsc --noEmit`
- **Problema:** a spec cita `npm run typecheck`, que não existe em `package.json`.
- **Decisão:** os docs usam o comando real; adicionar o script exigiria mexer fora de `docs/`.
- **Alternativas:** criar o script `typecheck`.

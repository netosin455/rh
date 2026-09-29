# Backlog do SuperRH

Tarefas combinadas com o Carlo e ainda **não iniciadas** (ou pausadas). Nenhuma será executada sem a ficha em `core/01_ACTIVE_TASK.md` e o gate de cada workflow. Atualizado em 2026-09-29.

## Ordem sugerida

1. **RH-009** (pausada) ou **RH-NAV-001**: ver a dependência abaixo antes de escolher.
2. **RH-SURVEY-002**
3. **RH-FEEDBACK-003**

## RH-NAV-001 · Sincronização da sidebar · LOW/MEDIUM

Plano completo: `core/PLAN_FEEDBACK_SURVEYS_NAV.md`, seção 1.

- **Regra:** a rota atual é a única fonte de verdade do item ativo (nada de último clique, hover ou índice local). Subrotas mantêm o item do pai (`/colaborador/27` acende Equipe; `/onboarding/15` acende Onboarding; `/pesquisas/12` acende Pesquisas; `/feedbacks/12` acende Feedbacks).
- **Desktop:** a sidebar persistente nunca fecha ao navegar. **Mobile:** o menu temporário pode fechar.
- **Indicador:** 180 a 220 ms, ease-out, respeita reduced motion, nunca some entre duas rotas válidas.
- **Hipótese de causa (lida no código de `app/(tabs)/_layout.tsx`, ainda NÃO reproduzida):** `activeItem` procura primeiro por `tabName === activeTab` (a última aba visitada) e só depois por `pathname.startsWith(href)`. Numa rota fora das abas (`/onboarding/15`, `/pesquisas/12`, `/colaborador/27`) a aba anterior continua "ativa" e vence, então o destaque fica no item errado. A correção é um mapa explícito rota → item derivado só do `pathname`, como o plano propõe.
- **Testes:** os 15 destinos da lista do plano, desktop e mobile, reduced motion.

## RH-SURVEY-002 · Pesquisas com até 10 perguntas · **HIGH**

Plano: seção 2. Motivos do risco: migration, rota pública `/responder/[id]`, dados existentes, mudança estrutural das respostas.

- **Modelo:** manter `pulse_surveys`; novas `survey_questions` (posição 1 a 10, tipo `scale` 1 a 5 ou `choice`, `options`, `required`), `survey_submissions` (participação, `voter_token`) e `survey_answers`.
- **Regras:** mínimo 1 e máximo 10 perguntas; backend valida tipo, opção e que a pergunta pertence à pesquisa; frontend nunca é autoridade; pesquisa continua anônima; double-submit bloqueado.
- **Compatibilidade:** pesquisas antigas viram uma pergunta na posição 1, com as respostas migradas e contagens conferidas antes e depois. Nada em produção sem migration versionada e revisão.
- **Telas:** criação com adicionar, remover e subir/descer (sem drag and drop); resposta pública em etapas com progresso ("3 de 6"); resultados **por pergunta**, sem juntar perguntas num gráfico.

## RH-FEEDBACK-003 · Módulo de Feedbacks · **HIGH**

Plano: seções 3 e 4. Motivos: migration, dado pessoal, link público, PDF, confirmação de leitura. Feedback **não é** Pesquisa (módulos separados).

- **Fluxo:** RH escolhe colaborador, escreve título e conteúdo, publica e copia o link individual; o colaborador abre o link (sem sidebar), lê, baixa o PDF e confirma "Li e estou ciente".
- **Link:** token público imprevisível (sem employee_id, company_id, CPF ou email; fora dos logs), sem expiração por padrão, revogável.
- **Status:** `draft`, `published`, `acknowledged`, `revoked`. Confirmação idempotente, gravada no backend; o cliente nunca manda `company_id`, `employee_id` nem `acknowledged_at`.
- **PDF:** montado pelo backend a partir do registro persistido (nunca HTML do cliente); mostra "Leitura confirmada em..." ou "Aguardando confirmação de leitura".
- **Texto jurídico:** é confirmação de ciência no sistema; não chamar de assinatura digital nem aceite jurídico.
- **Permissões:** super_admin, admin, rh e adm criam e administram; gestor **não** é liberado automaticamente (decisão futura). Público só com token válido.
- **Notificação:** interna se o colaborador tem `user_id`; email opcional; "Copiar link" sempre existe.
- **Navegação:** Feedbacks entra no grupo Pessoas (Equipe, Férias, Onboarding, Feedbacks).
- **Segurança e LGPD:** `company_id` administrativo vem do JWT; isolamento entre empresas; conteúdo e token fora de log; avaliar rate limit no endpoint público.

## Gate antes de codar (SURVEY e FEEDBACK)

O Maestri apresenta ao Carlo, nesta ordem: estrutura atual, migration proposta, modelo final, endpoints, rotas de frontend, permissões, segurança, compatibilidade, testes e rollback. **Sem migration em produção e sem push na `main` sem autorização explícita.** Workflows: `workflows/HIGH_RISK.md` e `workflows/DATABASE_CHANGE.md`.

## Ordem de implementação do plano

1. corrigir sidebar; 2. estabilizar navegação; 3. planejar migration de pesquisas; 4. backend multi-pergunta; 5. criação de pesquisa; 6. resposta pública por etapas; 7. resultados por pergunta; 8. testar e migrar pesquisas antigas; 9. planejar migration de Feedback; 10. gestão administrativa; 11. link público; 12. confirmação; 13. PDF; 14. notificações; 15. QA completo.

## Dependência importante: RH-009 mexe na mesma sidebar

O redesign de composição (RH-009, pausado, código no `git stash`) reescreve `app/(tabs)/_layout.tsx`, incluindo o cálculo do item ativo. Se as duas tarefas forem feitas em separado, uma vai conflitar com a outra. **Decidir antes:** (a) corrigir o bug da sidebar primeiro sobre o código publicado e depois reaplicar o RH-009; ou (b) retomar o RH-009 e incluir o mapa rota → item nele. Recomendação: (a), porque o bug é pequeno e o RH-009 ainda não foi visto renderizado.

## Pausada

- **RH-009:** recomposição de Dashboard, Login, Sidebar e Equipe (ficha completa em `core/01_ACTIVE_TASK.md`).

## Outras pendências de produto

- `GROQ_API_KEY` inválida em produção (Insights de IA e chat fora do ar).
- Exportação em PDF ainda em dourado (`helpers/pdf.ts`).
- Comentário de `estilo/cores.ts` ainda cita "Modern Law".
- Nenhum dos 43 colaboradores tem email ou login vinculado.

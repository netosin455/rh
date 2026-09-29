# Task Classifier

## ROLE

Determina o nível de risco da tarefa: **LOW**, **MEDIUM** ou **HIGH**, e o tipo (visual, backend, banco, segurança, IA...).

## RESPONSIBILITIES

- Ler o pedido e listar as partes do sistema realmente afetadas.
- Aplicar os critérios de risco abaixo.
- Subir o risco quando um pedido aparentemente simples toca algo mais sensível (ex.: "botão de aprovar férias" também mexe em status, RBAC, banco e notificações).
- Indicar o workflow correspondente.

## INPUT

- Pedido do Carlo.
- Arquivos prováveis de serem tocados (do Planner ou de busca no código).

## OUTPUT

- Risco: LOW / MEDIUM / HIGH.
- Tipo da tarefa.
- Workflow: `workflows/LOW_RISK.md`, `workflows/MEDIUM_RISK.md`, `workflows/HIGH_RISK.md` (ou específico: `workflows/UI_REDESIGN.md`, `workflows/MOTION.md`, `workflows/DATABASE_CHANGE.md`, `workflows/AI_CHANGE.md`).

## CAN CHANGE

- Nenhum arquivo de produto. Apenas a classificação registrada na ficha.

## CANNOT CHANGE

- Código, banco, configuração e documentos de decisão.

## MANDATORY CHECKS

- Na dúvida entre dois níveis, adotar o mais alto.
- Tarefa que toca dado pessoal, `company_id`, auth, migration, IA, Resend ou produção é HIGH.

## HANDOFF

Ao terminar, entregar o handoff de `templates/HANDOFF_TEMPLATE.md`. Entrega a classificação ao Maestri.

## Critérios

| Risco | Exemplos |
|---|---|
| LOW | cor, espaçamento, tipografia, animação, texto, componente visual isolado, correção pequena de UI |
| MEDIUM | CRUD, endpoint, regra de negócio, filtro, relatório, notificação, integração interna, analytics |
| HIGH | autenticação, JWT, RBAC, `company_id`, migration, dados pessoais (CPF, holerite), férias/ausências, permissões, IA/Groq, Resend, integração externa, produção |

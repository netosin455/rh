# Regras de RH (domínio)

Este documento reúne **somente** regras que já estão implementadas ou foram confirmadas pelo Carlo. **O Domain RH não inventa regra trabalhista**: o que não está aqui é dúvida a esclarecer com o Carlo antes de implementar.

## Perfis e permissões (fonte de verdade: `api/_lib.ts`)

Constantes `CAN_MANAGE_EMPLOYEES`, `CAN_APPROVE_ABSENCES` e `IS_ADMIN`. O frontend não decide permissão; a API revalida sempre.

## Regras implementadas (ver `docs/changelog.md`)

| Área | Regra |
|---|---|
| Férias e ausências | Fluxo de aprovação completo: solicitação, aprovação ou recusa por quem tem `CAN_APPROVE_ABSENCES`; correção de `approveAbsence` já feita |
| Colaboradores | Remoção por soft-delete; histórico salarial em `salary_history`; validação de CPF |
| Licença médica | Mostrar o status, não o motivo |
| Pesquisas de pulso | Anônimas: nunca ligar resposta a usuário |
| Kudos | Notifica por canal interno; email só se o colaborador tem email na ficha; destinatário sempre da mesma empresa |
| IA | Sugere e sinaliza; não decide nada trabalhista (`domains/AI_GOVERNANCE.md`) |

## Lacunas conhecidas (perguntar antes de implementar)

- Regras de banco de horas.
- Prazos e limites legais de férias e licenças (CLT): não codificar sem confirmação.
- Critérios de turnover e de "atenção" no Dashboard: indicadores, não classificações.

Quando o Carlo confirmar uma regra, registre-a aqui com a data.

> Plano recebido do Carlo em 2026-09-29 (cópia de Downloads/FEEDBACK_SURVEYS_NAV_PLAN.md). Registrado, NÃO implementado. Ver core/BACKLOG.md. Observação: o gate de tipos deste plano cita npm run typecheck, que não existe; usar npx tsc --noEmit.

# SuperRH — Plano de correções e novas funcionalidades

Status: **planejamento para leitura pelo Claude/Maestri**

Escopo deste documento:

1. corrigir a sincronização visual da sidebar;
2. evoluir Pesquisas para até 10 perguntas;
3. criar o módulo de Feedback com link permanente, confirmação de leitura e PDF;
4. preservar segurança, multi-tenant e separação entre Pesquisa e Feedback.

> Este documento deve ser lido pelo Maestri antes da implementação.

---

## 1. Bug atual da sidebar

### Problema

Ao navegar por alguns botões e subrotas:

- a sidebar pode perder o estado visual;
- o indicador/tracinho da aba ativa pode desaparecer ou ficar apontando para a aba anterior;
- algumas navegações internas fazem o shell parecer fechar/reabrir;
- a rota real e o item destacado podem ficar fora de sincronia.

### Regra correta

A **rota atual** deve ser a única fonte de verdade do item ativo.

O estado ativo não deve depender de:

- último botão clicado;
- hover;
- índice local;
- estado visual mantido separadamente da rota;
- valor temporário que não acompanha subrotas.

### Comportamento esperado

Exemplos:

- `/(tabs)/colaboradores` → **Equipe** ativa
- `/colaborador/27` → **Equipe** continua ativa
- `/(tabs)/ferias` → **Férias** ativa
- `/onboarding/15` → **Onboarding** ativa
- `/pesquisas/12` → **Pesquisas** ativa
- `/feedbacks` → **Feedbacks** ativa
- `/feedbacks/12` → **Feedbacks** continua ativa

### Desktop

A sidebar persistente **não deve fechar** durante navegação interna.

### Mobile

Menu temporário, drawer ou sheet pode fechar após navegação.

Desktop e mobile não devem compartilhar comportamento incorreto por conveniência.

### Implementação recomendada

Criar mapa explícito entre rota e item de navegação.

Exemplo conceitual:

```ts
const routeToNavItem = [
  { test: /^\/$/, key: 'dashboard' },
  { test: /^\/colaboradores/, key: 'colaboradores' },
  { test: /^\/colaborador\//, key: 'colaboradores' },
  { test: /^\/ferias/, key: 'ferias' },
  { test: /^\/onboarding/, key: 'onboarding' },
  { test: /^\/pesquisas/, key: 'pesquisas' },
  { test: /^\/feedbacks/, key: 'feedbacks' },
];
```

Usar pathname/segments do Expo Router.

O indicador ativo deve derivar disso.

### Motion

Indicador:

- duração: 180–220ms;
- curva: ease-out;
- respeitar reduced motion;
- nunca desaparecer entre duas rotas válidas.

### Testes obrigatórios

Testar:

- Dashboard;
- Equipe;
- perfil de colaborador;
- Férias;
- Agenda;
- Avisos;
- Kudos;
- Pesquisas;
- detalhe de pesquisa;
- Onboarding;
- detalhe de onboarding;
- Analytics;
- Assistente;
- Admin;
- Feedbacks.

---

# 2. Pesquisas — até 10 perguntas

## 2.1 Estado atual

A implementação atual é centrada em uma única pergunta por pesquisa:

- `pulse_surveys.question`
- `pulse_surveys.type`
- `pulse_surveys.options`

e uma resposta diretamente associada à pesquisa.

Isso deve mudar.

## 2.2 Nova regra de produto

Uma pesquisa deve possuir:

- mínimo: 1 pergunta;
- máximo: 10 perguntas.

Tipos iniciais:

- `scale` — escala 1 a 5;
- `choice` — múltipla escolha.

Não adicionar novos tipos nesta primeira versão.

## 2.3 Arquitetura de dados proposta

Manter:

```text
pulse_surveys
```

como entidade principal da pesquisa.

Adicionar:

```text
survey_questions
```

Campos conceituais:

```text
id
survey_id
position
question
type
options
required
created_at
```

Regras:

- `position`: 1–10;
- cada pergunta pertence a uma única pesquisa;
- no máximo 10 perguntas;
- `options` só é necessário para `choice`;
- `scale` aceita somente 1–5.

## 2.4 Participações e respostas

Separar a participação das respostas individuais.

Estrutura proposta:

```text
survey_submissions

id
survey_id
voter_token
submitted_at
```

e:

```text
survey_answers

id
submission_id
question_id
score
choice
```

### Regras

- uma submission representa uma participação;
- uma submission pode possuir até 10 answers;
- uma pessoa/dispositivo não deve enviar duas submissions para a mesma pesquisa segundo a regra atual;
- cada answer deve referenciar pergunta da mesma pesquisa;
- backend deve validar tipo;
- frontend não é autoridade sobre pergunta, opções ou tipo;
- pesquisa continua anônima.

## 2.5 Compatibilidade com pesquisas existentes

As pesquisas antigas não podem ser perdidas.

Estratégia preferida:

1. criar novas tabelas;
2. para cada pesquisa antiga, criar uma `survey_question` com `position = 1`;
3. migrar respostas existentes para `survey_submissions` + `survey_answers`;
4. validar contagens antes e depois;
5. só então remover dependência do modelo antigo.

Não executar isso diretamente em produção sem migration versionada e revisão.

## 2.6 Criação de pesquisa

Fluxo administrativo:

```text
Nova pesquisa

Título
[____________________________]

Perguntas

1.
Pergunta
[________________________________]

Tipo
[ Escala 1–5 ▾ ]

Obrigatória
[✓]

+ Adicionar pergunta
```

Para múltipla escolha:

```text
Pergunta
[________________________________]

Tipo
[ Múltipla escolha ▾ ]

Opções
[ Excelente ]
[ Bom       ]
[ Regular   ]

+ Adicionar opção
```

Permitir:

- adicionar pergunta;
- remover pergunta;
- reordenar;
- marcar como obrigatória.

Primeira versão de reordenação pode usar:

- subir;
- descer.

Não é obrigatório drag and drop.

Ao atingir 10 perguntas:

```text
Limite de 10 perguntas atingido.
```

e desabilitar o botão de adicionar.

## 2.7 Página pública de resposta

Manter o conceito:

```text
/responder/[id]
```

mas mudar para fluxo por etapas.

Exemplo:

```text
Pesquisa de clima

Pergunta 1 de 6

Como você avalia sua semana?

1  2  3  4  5

[ Próxima ]
```

Depois:

```text
Pergunta 2 de 6

Como você avalia a comunicação da equipe?

○ Excelente
○ Boa
○ Regular
○ Ruim

[ Voltar ]   [ Próxima ]
```

Última:

```text
[ Enviar respostas ]
```

### Progresso

Exibir:

```text
3 de 6

████████░░░░
```

### Motion

Troca de pergunta:

- saída curta;
- próxima entra com opacity + deslocamento leve;
- 180–220ms;
- reduced motion → instantâneo.

### Validação

Antes do envio:

- validar todas as obrigatórias;
- validar tipos;
- validar opções no backend.

## 2.8 Resultados

Resultados precisam ser exibidos **por pergunta**.

Exemplo:

```text
Pesquisa — Clima da equipe

47 respostas

1. Como você avalia sua semana?

Média 4,2 / 5

5  ███████████  21
4  ████████     15
3  ████          7
2  ██            3
1  █             1
```

Para choice:

```text
2. Como está a comunicação?

Excelente   18
Boa         20
Regular      7
Ruim         2
```

Não juntar perguntas diferentes no mesmo gráfico.

---

# 3. Novo módulo — Feedbacks

## 3.1 Conceito

Feedback **não é Pesquisa**.

### Pesquisa

- coleta informação;
- pode ser anônima;
- várias pessoas respondem.

### Feedback

- RH comunica algo para uma pessoa específica;
- colaborador lê;
- confirma ciência;
- documento continua acessível;
- PDF pode ser baixado.

Esses módulos devem permanecer separados.

## 3.2 Fluxo do RH

```text
Feedbacks
→ Novo feedback
→ selecionar colaborador
→ escrever título
→ escrever conteúdo
→ salvar/publicar
→ gerar link individual
→ copiar/compartilhar link
```

## 3.3 Fluxo do colaborador

```text
abre link
→ lê feedback
→ pode baixar PDF
→ marca "Li e estou ciente"
→ confirma leitura
→ sistema registra data/hora
```

Depois da confirmação:

- link continua funcionando;
- colaborador pode reler;
- colaborador pode baixar PDF novamente.

## 3.4 Link público permanente

Nunca usar URL previsível:

```text
/feedback/1
/feedback/2
```

Usar token público imprevisível.

Exemplo conceitual:

```text
/feedback/4fef9c4a-....
```

O token:

- não deve conter employee_id;
- não deve conter company_id;
- não deve conter CPF;
- não deve conter email;
- deve possuir entropia suficiente;
- não deve aparecer em logs.

Por padrão:

```text
expires_at = NULL
```

Ou seja: não expira automaticamente.

Mas o RH deve poder revogar o link futuramente.

## 3.5 Modelo de dados proposto

```text
feedbacks

id
company_id
employee_id
created_by
title
content
public_token
status
published_at
acknowledged_at
revoked_at
created_at
updated_at
```

Status:

```text
draft
published
acknowledged
revoked
```

### Regras

`draft`

- não acessível publicamente.

`published`

- link público ativo.

`acknowledged`

- link continua ativo.

`revoked`

- link deixa de funcionar.

## 3.6 Conteúdo inicial

Primeira versão:

- colaborador;
- título;
- conteúdo com parágrafos.

Não criar editor complexo nesta etapa.

Quebras de linha devem ser preservadas.

Registrar:

- autor;
- criação;
- publicação;
- confirmação.

## 3.7 Tela do RH

Exemplo:

```text
Feedbacks

[ Buscar colaborador... ]     + Novo feedback

Ana Souza
Feedback — Setembro/2026
Enviado em 28/09/2026

● Leitura confirmada
29/09/2026 09:42

[ Abrir ] [ Copiar link ] [...]

--------------------------------------

João Silva
Feedback — Agosto/2026

○ Aguardando leitura

[ Abrir ] [ Copiar link ] [...]
```

Filtros:

- Todos;
- Aguardando leitura;
- Confirmados;
- Rascunhos, se necessário.

## 3.8 Página pública do colaborador

Rota conceitual:

```text
/feedback/[token]
```

Sem sidebar.

Exemplo:

```text
SuperRH

Feedback

Para:
Ana Souza

Feedback — Setembro/2026

28 de setembro de 2026

----------------------------------------

Ana,

[conteúdo escrito pelo RH]

----------------------------------------

Enviado por:
Arielle

[ Baixar PDF ]

[ ] Li e estou ciente deste feedback

[ Confirmar leitura ]
```

Texto explicativo:

```text
A confirmação registra que você teve acesso ao conteúdo.
```

Não chamar isso automaticamente de:

- assinatura digital;
- assinatura eletrônica qualificada;
- aceite jurídico.

É confirmação de ciência no sistema.

## 3.9 Confirmação de leitura

Checkbox sozinha não grava nada.

Fluxo:

1. usuário marca checkbox;
2. botão "Confirmar leitura" é habilitado;
3. endpoint confirma;
4. backend grava `acknowledged_at`.

A confirmação deve ser idempotente.

Se confirmar novamente:

- não criar outra confirmação;
- retornar timestamp já existente.

O frontend não pode mandar como autoridade:

- company_id;
- employee_id;
- acknowledged_at.

Esses dados vêm do feedback identificado pelo token.

## 3.10 PDF

Gerar PDF profissional a partir dos dados persistidos.

Conteúdo:

- marca SuperRH;
- empresa;
- título;
- colaborador;
- data;
- autor;
- conteúdo integral.

Se confirmado:

```text
Leitura confirmada em DD/MM/AAAA às HH:mm
```

Se não:

```text
Aguardando confirmação de leitura
```

Rodapé:

```text
Documento gerado pelo SuperRH
```

Nome:

```text
feedback-ana-souza-2026-09.pdf
```

ou equivalente sanitizado.

Não aceitar HTML arbitrário enviado pelo cliente para montar PDF.

Backend monta o documento a partir do registro persistido.

## 3.11 Permissões

Criar e administrar feedbacks:

- super_admin;
- admin;
- rh;
- adm.

Gestor:

- não liberar automaticamente;
- requer decisão explícita futura.

Página pública:

- acesso somente via token válido.

## 3.12 Notificação

Ao publicar feedback:

se colaborador tiver `user_id`:

criar notificação interna.

Título sugerido:

```text
Você recebeu um novo feedback
```

Ação:

```text
Abrir feedback
```

Se email estiver configurado e funcionando:

pode enviar o link também.

Mas Feedback não pode depender de email.

Sempre deve existir:

```text
Copiar link
```

na gestão do RH.

---

# 4. Segurança e LGPD

Feedback contém dado pessoal e deve ser tratado como HIGH RISK.

Obrigatório:

- company_id administrativo vindo do JWT;
- empresa A nunca acessa feedback da empresa B;
- public_token imprevisível;
- token não aparece em log;
- conteúdo do feedback não aparece em log;
- endpoints administrativos exigem auth/RBAC;
- endpoint público retorna apenas dados daquele feedback;
- feedback revogado fica indisponível;
- avaliar rate limit no endpoint público.

Pesquisa:

- resultado administrativo isolado por company_id;
- pergunta/resposta de uma empresa não deve vazar para outra;
- frontend nunca define company_id.

---

# 5. Navegação

Adicionar Feedbacks na sidebar em grupo coerente.

Sugestão:

```text
PESSOAS

Equipe
Férias
Onboarding
Feedbacks
```

Não criar uma categoria inteira só para Feedback.

A correção do indicador ativo deve considerar:

- `/feedbacks`
- `/feedbacks/[id]`

A página pública:

- `/feedback/[token]`

não deve exibir sidebar autenticada.

---

# 6. Migrations

Essas mudanças exigem migrations versionadas.

Possíveis novas estruturas:

- `survey_questions`;
- `survey_submissions`;
- `survey_answers`;
- `feedbacks`;
- índices;
- constraints.

Não editar banco manualmente em produção.

Antes de qualquer migration de produção, mostrar:

- SQL;
- impacto;
- rollback;
- compatibilidade com dados atuais.

---

# 7. Testes obrigatórios

## Sidebar

- item ativo acompanha rota;
- subrotas mantêm item correto;
- desktop não fecha;
- mobile fecha quando apropriado;
- indicador não fica atrasado;
- reduced motion funciona.

## Pesquisas

- mínimo 1 pergunta;
- máximo 10;
- rejeita 11;
- scale aceita somente 1–5;
- choice aceita somente opção cadastrada;
- obrigatória não fica vazia;
- question de outra survey é rejeitada;
- double-submit é bloqueado;
- resultado é calculado por pergunta;
- pesquisa antiga é preservada;
- empresa A não vê resultado da empresa B.

## Feedbacks

- RH cria;
- colaborador correto é vinculado;
- token público é criado;
- ID não é usado como segredo;
- token válido funciona;
- token inválido não retorna dado;
- draft não é público;
- revogado não é público;
- confirmação grava timestamp;
- confirmação repetida não duplica;
- link permanece acessível após confirmação;
- PDF funciona antes e depois da confirmação;
- PDF mostra status correto;
- empresa A não acessa feedback administrativo da empresa B;
- página pública não permite alterar conteúdo.

Gate:

```bash
npm run typecheck
npm test
npx expo export --platform web
```

Também fazer teste manual real.

---

# 8. Tarefas Maestri

Criar tarefas separadas.

## RH-NAV-001

Correção de sincronização da sidebar.

Risco:

LOW/MEDIUM.

## RH-SURVEY-002

Pesquisas multi-pergunta.

Risco:

HIGH.

Motivos:

- migration;
- rota pública;
- dados existentes;
- mudança estrutural de resposta.

## RH-FEEDBACK-003

Módulo de Feedback e ciência.

Risco:

HIGH.

Motivos:

- migration;
- dados pessoais;
- link público;
- PDF;
- confirmação de leitura.

---

# 9. Ordem de implementação

1. corrigir sidebar;
2. estabilizar e testar navegação;
3. planejar migration de pesquisas;
4. implementar backend multi-question;
5. implementar criação de pesquisa;
6. implementar resposta pública por etapas;
7. implementar resultados por pergunta;
8. testar/migrar pesquisas antigas;
9. planejar migration de Feedback;
10. implementar gestão administrativa;
11. implementar link público;
12. implementar confirmação;
13. implementar PDF;
14. integrar notificações;
15. QA completo.

---

# 10. Gate antes de codar

Antes de implementar Survey/Feedback, o Maestri deve apresentar:

1. estrutura atual;
2. migration proposta;
3. modelo final;
4. endpoints;
5. rotas frontend;
6. permissões;
7. segurança;
8. compatibilidade;
9. testes;
10. rollback.

Não executar migration de produção sem aprovação explícita.

Não alterar main/deploy de produção sem autorização explícita.

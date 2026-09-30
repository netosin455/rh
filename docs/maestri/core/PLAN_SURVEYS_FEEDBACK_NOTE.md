# Pesquisas com perguntas próprias + observação do colaborador no feedback

Decidido em 2026-09-30 (Carlo). Detalha e ajusta RH-SURVEY-002 / RH-FEEDBACK-003 de `PLAN_FEEDBACK_SURVEYS_NAV.md`. Risco: HIGH (migrations, API pública). Gate: SQL, impacto e rollback passam pelo chefe antes de qualquer execução em produção. Nada de push sem revisão do chefe.

## Restrições
- Vercel Hobby: limite de funções. NÃO criar arquivos novos de handler em `api/`; estender `api/surveys/index.ts` e `api/feedback/_handler.ts` por query param, como já é feito.
- Sem banco de dev: testes com mock; nenhuma escrita em produção.
- Só o RH tem conta. Colaboradores respondem por link público, sem login, em geral no celular. Mobile-first na tela pública.

## Estado atual (verificado)
- `pulse_surveys` tem `question`, `type` ('scale'|'choice'), `options` jsonb. `pulse_responses` tem `score`, `choice`, `voter_token`. Uma pergunta por pesquisa.
- `feedbacks` tem `acknowledged_at`, sem campo de observação.

## 1. Observação do colaborador no feedback
- Página pública `app/feedback/[token].tsx`: ao confirmar leitura, campo opcional "Quer deixar uma observação?" (até 1000 caracteres, contador, sem obrigar). Enviar junto com a confirmação.
- Coluna nova `feedbacks.acknowledgment_note text NULL` com CHECK de tamanho (1..1000 após trim, ou NULL). Branco vira NULL.
- Idempotente: se já confirmado, devolve o timestamp e a nota existentes, não sobrescreve.
- Depois de confirmar, a página mostra "Você confirmou em DD/MM e escreveu: ..." (somente leitura).
- RH vê a observação no detalhe do feedback (`app/feedbacks/[id].tsx`), na lista (indicador "com observação") e no PDF.
- Autoridade: company_id, employee_id e acknowledged_at vêm do token, nunca do corpo.

## 2. Pesquisas com perguntas personalizadas
Tipos: `scale` (1 a 5), `choice` (escolha única, 2 a 8 opções), `text` (aberta, até 1000 caracteres). De 1 a 10 perguntas por pesquisa; cada uma com `required`.

### Dados (migration versionada, ver Gate)
- `survey_questions(id, survey_id, position 1..10, question, type, options jsonb, required, created_at)`, UNIQUE(survey_id, position).
- `survey_submissions(id, survey_id, voter_token, submitted_at)`, UNIQUE(survey_id, voter_token) quando token não nulo.
- `survey_answers(id, submission_id, question_id, score, choice, text)`, com CHECK: exatamente um de score/choice/text conforme o tipo, validado também no backend.
- Backfill: cada pesquisa antiga vira 1 `survey_question` (position 1) e cada `pulse_response` vira 1 submission + 1 answer. Conferir contagens antes e depois. Não remover as tabelas antigas nesta entrega.

### Contrato da API (estende `api/surveys/index.ts`, sem arquivo novo)
- `POST /api/surveys` (auth RH): `{ title, expires_at?, target_dept?, questions: [{ question, type, options?, required }] }` com 1..10 perguntas. Aceitar o formato antigo (`question`/`type`/`options` soltos) embrulhando em `questions[0]`.
- `GET /api/surveys/:id` (público para o respondente e auth para o RH): devolve a pesquisa com `questions[]` ordenadas por `position`, sem expor nada de outros respondentes.
- `POST /api/surveys/:id/respond` (público): `{ voter_token, answers: [{ question_id, score?, choice?, text? }] }`. O servidor valida TUDO: perguntas pertencem à pesquisa, obrigatórias presentes, tipo e opção válidos, tamanho do texto, pesquisa não expirada, token não repetido (409). Tudo numa transação: ou grava a participação inteira ou nada. Aceitar o corpo antigo `{score|choice}` para pesquisas de 1 pergunta.
- `GET /api/surveys/:id/results` (auth RH): por pergunta. `scale`: média e distribuição 1..5. `choice`: contagem por opção. `text`: lista de textos anônimos (mais recentes primeiro, teto de 200). Total de participações.
- Pesquisas antigas continuam funcionando e aparecem com 1 pergunta.

### Regras de privacidade (LGPD)
- Continua anônima. Nenhum dado do respondente além do `voter_token` do dispositivo.
- Respostas abertas podem identificar alguém: aviso fixo na tela de resposta ("Não escreva nomes nem dados pessoais. Sua resposta é anônima.") e nos resultados.

### UX (o ponto principal do pedido: nada confuso)
**Criar pesquisa (RH):**
- Abre já com a 1ª pergunta em branco e um botão claro "Adicionar pergunta".
- Tipo escolhido por 3 botões grandes lado a lado, não por lista suspensa: `Escala 1 a 5` | `Escolha` | `Aberta`, cada um com uma linha de explicação e ícone.
- Escolha: já com 2 campos de opção; `+ opção` ou Enter adiciona a próxima; remover opção com um toque.
- Cada pergunta é um cartão numerado com: subir, descer, duplicar, excluir (com confirmação), e o interruptor "Obrigatória".
- Contador "3 de 10 perguntas". No 10, botão desabilitado e mensagem "Limite de 10 perguntas atingido."
- Erros no próprio campo ("Escreva a pergunta", "Coloque pelo menos 2 opções"), sem alerta genérico no topo.
- Botão "Ver como o colaborador vai ver" (pré-visualização, sem gravar).
**Responder (colaborador, celular primeiro):**
- Uma pergunta por tela, "Pergunta 2 de 6", barra de progresso, alvos de toque grandes.
- Voltar e Próxima sem perder respostas; obrigatória bloqueia o avançar com mensagem simples; a última tela troca Próxima por "Enviar respostas".
- Aberta: caixa de texto com contador e o aviso de anonimato.
- Tela final "Obrigado, sua resposta foi enviada".
**Resultados (RH):** por pergunta, sem misturar gráficos; barras simples para escala e escolha; lista para respostas abertas.

## Divisão de trabalho
- **Codex (back):** migrations 016 (pesquisas) e 017 (observação do feedback) como ARQUIVOS, sem executar; endpoints acima em `api/`; testes Vitest. Entrega ao chefe o SQL, o impacto, o rollback e a evidência das contagens do backfill (em transação de teste ou dry-run) antes de qualquer execução.
- **Claude Code #2 (front):** tipos em `tipos/modelos.ts`, `conexoes/`, criação, resposta pública, resultados e a observação no feedback (público + detalhe do RH), seguindo o contrato acima. Pode usar API simulada para verificar, sem escrita em produção.
- **Claude Code #3:** revisão independente (só leitura) dos dois lados antes do push.
- **Chefe:** aprova o SQL, revisa diffs, roda tsc/testes/build, commita, e só executa a migration em produção com o OK do Carlo.

## Critérios de aceite
- Uma pesquisa antiga continua abrindo, respondendo e mostrando resultado.
- Uma pesquisa nova com 10 perguntas mistas (escala, escolha, aberta) é criada, respondida e apurada por pergunta.
- Resposta inválida (opção fora da lista, obrigatória ausente, texto acima do limite, pergunta de outra pesquisa) é recusada no servidor, sem gravar nada parcial.
- Segunda resposta do mesmo dispositivo dá 409.
- Feedback: confirmar com e sem observação; confirmar de novo não altera nada; RH vê a observação no detalhe e no PDF.
- `tsc`, testes e build verdes; nenhuma tela quebrada no celular (390 px) e no desktop (1280 px).

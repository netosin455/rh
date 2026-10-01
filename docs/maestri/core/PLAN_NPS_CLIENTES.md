# NPS e pesquisa de satisfação do cliente

Registrado em 2026-10-01 (Carlo). Complementa `PLAN_SURVEYS_FEEDBACK_NOTE.md`: mesmo modelo de pesquisa (perguntas, link público, resultados), mas o público é o CLIENTE do escritório, não o colaborador. Risco: HIGH (migration, dados de terceiros, LGPD). Entra DEPOIS da Fase 1 de estabilização (isolamento entre empresas e notificações). Migration prevista: 019 (a 018 é de notificações).

## O que já existe e vamos reaproveitar
- Pesquisa com 1 a 10 perguntas, link público `/responder/[id]`, uma pergunta por tela, resultados por pergunta, anonimato por `voter_token`.
- Não existe cadastro de clientes. Só `legal_cases.client_name` (texto livre). Por isso a primeira versão NÃO depende de cadastro.

## Decisões de produto (propostas, aguardando confirmação do Carlo)
1. **Público da pesquisa:** novo campo `audience` em `pulse_surveys`: `employees` (hoje) ou `customers`. Pesquisa de cliente nunca é anunciada por notificação interna, não usa `target_dept` e mostra identidade visual/linguagem de cliente ("nosso escritório"), não "sua empresa".
2. **Novo tipo de pergunta `nps`:** nota de 0 a 10 ("De 0 a 10, quanto você recomendaria nosso escritório a um amigo ou colega?"). Os tipos escala 1–5, escolha e aberta continuam disponíveis.
3. **Modelo pronto "Satisfação do cliente":** ao criar, o RH escolhe o modelo e já vem montado: (a) NPS 0–10 obrigatória; (b) "Qual o principal motivo da sua nota?" aberta e opcional; (c) escala 1–5 "Como avalia o atendimento?"; (d) escala 1–5 "Como avalia a clareza das informações sobre seu processo?". Tudo editável.
4. **Anonimato:** padrão anônimo. Campo opcional no final, "Quer que entremos em contato?" com nome e telefone/e-mail, só se o cliente marcar o consentimento. Sem isso nenhum dado pessoal é guardado.
5. **Como o cliente recebe:** um link único por campanha (copiar para WhatsApp/e-mail) e QR code para imprimir/mostrar. Link individual por cliente fica para uma segunda fase, quando existir cadastro de clientes.
6. **Um aparelho, uma resposta** por campanha (como hoje), com tela de agradecimento.

## Cálculo do NPS (regra única, no servidor e testada)
- Promotores: notas 9 e 10. Neutros: 7 e 8. Detratores: 0 a 6.
- NPS = % promotores − % detratores, arredondado para inteiro, de −100 a +100.
- Sem respostas: "sem dados", nunca 0. Com menos de 10 respostas, mostrar o valor com aviso "poucas respostas, use com cautela".
- Notas fora de 0..10 ou não inteiras são recusadas pelo servidor.

## Resultados (RH)
- Número grande do NPS com a faixa (promotores, neutros, detratores) em barra única e a contagem de cada grupo.
- Distribuição de 0 a 10.
- Evolução por campanha/mês (linha simples) quando houver mais de uma campanha.
- Comentários da pergunta aberta numa lista, com a nota ao lado de cada comentário (sem identificar quem escreveu, a menos que o cliente tenha pedido contato).
- Detratores que pediram contato aparecem em destaque "Retornar contato", com marcação de "já contatado".
- Filtro por período. Exportar resumo em PDF reaproveitando o gerador existente.

## Dados (migration 019, aprovada pelo chefe antes de rodar)
- `pulse_surveys.audience text NOT NULL DEFAULT 'employees' CHECK (audience IN ('employees','customers'))`.
- `survey_questions.type` aceita `nps`; `survey_answers.score` aceita 0..10 quando a pergunta é `nps` (hoje CHECK 1..5: o CHECK passa a depender do tipo da pergunta, validado também no servidor).
- `survey_submissions`: colunas opcionais `contact_name`, `contact_phone`, `contact_email`, `contact_consent boolean`, `contact_resolved_at`, todas NULL por padrão, com CHECK de que contato só existe com consentimento.
- Compatível com tudo que já existe: pesquisas atuais ficam `employees`.

## LGPD e segurança (obrigatório)
- Dados de cliente de escritório de advocacia são sensíveis pelo contexto. Coletar o mínimo; contato só com consentimento explícito e finalidade descrita na tela ("usaremos seu contato apenas para falar sobre esta avaliação").
- Texto aberto pode conter informação de processo: aviso na tela "Não escreva dados do seu processo, números de documentos ou informações sigilosas."
- Resposta pública não retorna nada de outros respondentes. Resultados e contatos só para quem tem permissão no RH (mesma regra de hoje, sempre filtrando por `company_id`).
- Contato de cliente nunca vai para logs. Exclusão: poder apagar o contato de uma resposta a pedido do titular.
- Proteção contra spam no endpoint público: limite por IP/aparelho e tamanho máximo de texto.

## Divisão de trabalho (quando for a hora)
- **Codex (back):** migration 019, tipo `nps` e `audience` na API de pesquisas, regra do NPS e resultados agregados no servidor, contato com consentimento, testes (validação 0..10, cálculo com bordas 6/7 e 8/9, sem dados, consentimento obrigatório, isolamento por empresa).
- **Claude Code #2 (front):** seletor de público e modelo "Satisfação do cliente" no criar pesquisa, pergunta NPS na tela pública (11 botões de 0 a 10 grandes, de fácil toque no celular, com rótulos "Nada provável" e "Muito provável"), campo de contato com consentimento, painel de resultados do NPS, QR code e copiar link.
- **Chefe:** gate do SQL, revisão, verify e push.

## Critérios de aceite
- Criar campanha de cliente a partir do modelo, copiar o link e abrir em celular sem login.
- Responder com e sem contato; sem consentimento nenhum dado pessoal é gravado.
- NPS calculado no servidor bate com o cálculo manual para um conjunto de respostas de teste (inclusive bordas).
- Detrator que deixou contato aparece em "Retornar contato" e pode ser marcado como contatado.
- Pesquisa de colaborador continua igual; nenhuma pesquisa de cliente gera notificação interna.
- `tsc`, testes e build verdes; isolamento por empresa testado.

## Perguntas em aberto para o Carlo
1. Anônimo por padrão com contato opcional está bom, ou o escritório precisa sempre saber quem respondeu?
2. O link será enviado por WhatsApp/e-mail manualmente, ou vale um fluxo de envio (ex.: ao encerrar um processo)? A primeira versão prevê só link e QR.
3. Perguntas do modelo (NPS, motivo, atendimento, clareza) estão certas, ou quer outras?

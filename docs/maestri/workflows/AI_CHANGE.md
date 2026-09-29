# Workflow AI_CHANGE

**Quando:** Groq, prompts, insights, chatbot, resumo automático, análise de pessoas, turnover. Risco: **HIGH**.

```
Maestri → Planner → Architect → Domain RH → Builder → Security → Privacy → AI Reviewer → QA → Final Reviewer → aprovação
```

## Regra absoluta

IA pode **resumir, sugerir, organizar e sinalizar**. IA **não** decide sozinha: demitir, advertir, promover, decidir férias, classificar funcionário para punição. Detalhes: `domains/AI_GOVERNANCE.md`.

## Checklist do AI Reviewer

- [ ] Fluxo `dados internos → construtor de contexto (minimiza) → Groq`; nunca `SELECT *` serializado
- [ ] Sem CPF, salário, dado de saúde ou senha no prompt
- [ ] Prompt injection: texto de usuário (avisos, nomes) não vira instrução
- [ ] Números e datas na resposta vêm dos dados fornecidos (sem alucinação)
- [ ] Linguagem de indicador ("pode merecer atenção do RH"), nunca veredito sobre pessoa
- [ ] Ferramentas do assistente restritas e revalidadas pela mesma lógica do REST
- [ ] Custo e limite de uso por empresa
- [ ] Falha do Groq não quebra a tela (erro tratado e visível ao usuário, sem engolir em silêncio)
- [ ] Chave em variável de ambiente; testar a chave antes de declarar que "funciona"

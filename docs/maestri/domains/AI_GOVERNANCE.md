# Governança de IA (Groq)

Regra central: **a IA sugere, resume e sinaliza. Não decide nada trabalhista** (desligamento, advertência, promoção, reprovação de férias sozinha).

## Fluxo obrigatório de contexto
```
dados internos → construtor de contexto (minimiza/redige) → Groq
```
Nunca `SELECT *` → `JSON.stringify` → LLM. Sem CPF, salário, dados de saúde ou senhas no prompt.

## Ferramentas do assistente (`api/chat.ts`)
Somente `criar_ausencia`, `listar_ausencias_pendentes`, `aprovar_ausencia`, e só para perfis que já podem aprovar. Sem ferramenta para salário, desligamento ou exclusão. Ação de escrita usa as mesmas funções de `api/_lib.ts` que o REST (mesmas validações).

## Revisão de mudança em IA
- Prompt injection: texto vindo de usuário (avisos, nomes) não pode virar instrução.
- Alucinação: respostas com números/datas devem vir de dados fornecidos.
- Linguagem: "há indicadores que podem merecer atenção do RH", nunca "demita fulano".
- Custo e limite de uso por empresa.
- Indicadores (ex.: risco de turnover) são contexto, não classificação definitiva de pessoa.

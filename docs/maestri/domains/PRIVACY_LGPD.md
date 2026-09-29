# Privacidade / LGPD

Segurança pergunta "alguém rouba o dado?". Privacidade pergunta "devemos coletar/mostrar/enviar este dado assim?".

Dados sensíveis do SuperRH: CPF, dados pessoais, salário e histórico salarial, férias, afastamentos e licenças médicas, avaliações, pesquisas, holerite.

## Regras
1. **Minimização:** resposta de API, email e log levam só o necessário para a finalidade.
2. **Visibilidade por perfil:** colaborador vê o próprio; gestor e RH conforme `api/_lib.ts`. Licença médica: mostrar o status, não o motivo.
3. **Email:** destinatário sempre da mesma empresa de quem originou; sem CPF, salário ou dado de saúde no corpo.
4. **Pesquisas de pulso anônimas:** nunca ligar resposta a usuário, nem em log.
5. **Logs:** sem dado pessoal; identificar por id.
6. **Retenção e exclusão:** colaborador removido usa soft-delete; definir prazo de retenção antes de qualquer exportação.
7. **IA:** ver `domains/AI_GOVERNANCE.md`.

## Perguntas antes de mergear (dados pessoais)
- Precisamos mesmo deste campo? Quem passa a poder vê-lo? Vai para log, email ou LLM?

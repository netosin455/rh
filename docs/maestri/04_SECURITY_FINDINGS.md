# Achados de segurança

Registro vivo. Cada item: data, local, impacto, status.

## Checklist por mudança
- JWT validado antes de qualquer lógica; role por constante de `api/_lib.ts`
- `company_id` só do JWT; nada de `company_id` vindo de body/query
- SQL parametrizado; sem IDOR entre empresas
- CORS restrito (allowlist); rate limit no login (5 / 15 min por email)
- Sem segredo, CPF ou token em log, resposta de erro ou email
- Endpoints de cron e de IA protegidos; dependências novas sem CVE conhecida

## Histórico
| Data | Achado | Status |
|---|---|---|
| 2026-08-04 | CORS permissivo (`*`) em `api/_lib.ts` | corrigido (allowlist) |
| 2026-08-04 | Senha do Neon em arquivo local de debug | corrigido (arquivo apagado, senha rotacionada) |
| — | JWT com 7 dias e sem revogação | risco aceito no MVP; reduzir para 24h + refresh |

# Relatório de release

Preencher em toda publicação em produção (`workflows/RELEASE.md`). Só marque PASS o que foi executado.

```
COMMIT: (hash e mensagem)
TESTS: (npm test: resultado real)
BUILD: (npx expo export --platform web: resultado; tsc: resultado)
SECURITY: (PASS | FAIL | N/A e motivo)
PRIVACY: (PASS | FAIL | N/A e motivo)
PREVIEW: (URL e o que foi testado manualmente; o que NÃO foi)
APPROVAL: (quem autorizou o push na main e quando)
DEPLOY STATUS: (deploy concluído? conferido? erros?)
```

Sem "APPROVAL" preenchido, não há push.

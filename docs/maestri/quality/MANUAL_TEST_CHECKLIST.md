# Checklist de teste manual

Executar na tela ou fluxo afetado. Marque o que foi **realmente** testado; o que não foi testado fica declarado como não testado. Sem banco de dev: cuidado com escritas em dados reais.

| Área | O que verificar |
|---|---|
| **Desktop** | Largura ≥ 1024 px: sidebar, layout em colunas, hover, foco |
| **Mobile** | 390 px: nenhuma coluna espremida, alvos de toque ≥ 44 px, sem scroll horizontal |
| **Responsive** | Redimensionar entre 390, 768 e 1280 px; layouts lado a lado empilham em `width <= 768` |
| **Keyboard** | Tab percorre em ordem lógica; foco visível (`foco.anel`); Enter e Esc funcionam em modal e drawer |
| **Loading** | Skeleton ou indicador aparece imediatamente; sem tela em branco |
| **Empty** | Estado vazio com mensagem e ação (`EmptyState`) |
| **Error** | Falha de rede e erro 4xx/5xx mostram mensagem clara, sem engolir em silêncio |
| **Success** | Confirmação visível após criar, editar, aprovar |
| **Permissions** | Cada perfil (admin, rh, gestor, colaborador) vê só o que pode; ação negada mostra aviso |
| **Regression** | Fluxos vizinhos ainda funcionam: login, navegação, a tela ao lado, o CRUD principal |

## Extras

- `prefers-reduced-motion` ligado: movimento some ou vira fade curto.
- Nomes e mensagens longas: sem corte estranho ou quebra de layout.
- Acentos corretos na tela (sem `Ã` ou `?` no lugar).
- Confirmações usam `helpers/confirm.ts` (nunca `Alert.alert`, que não funciona na web).

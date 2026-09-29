# Sistema de motion

Fonte de verdade: `estilo/movimento.ts` (`movimento.duracao`, `movimento.curva`, hook `useMotion()`). Rotas e skills: `workflows/MOTION.md`, `skills/MOTION_SKILLS.md`.

## Tempos

| Token | Duração | Uso |
|---|---|---|
| instant | **100 ms** | Feedback imediato (press, hover) e modo de movimento reduzido |
| fast | **140 ms** | Troca de estado de badge, hover animado |
| normal | **200 ms** | Entrada de cartão ou modal |
| structural | **260 ms** | Mudança de estrutura (drawer, sidebar) |
| celebration | **400 ms MÁXIMO** | Momento de conquista (ex.: Kudos publicado); nunca mais que isso |

Nota: no código o token `estrutural` já vale 260 ms; celebração não tem token próprio (usar no máximo 400 ms, sem confete).

## Curvas

Entrada com ease-out (`Easing.out(Easing.cubic)`); saída mais rápida, com ease-in. Press: escala 0.98.

## Reduced motion

`prefers-reduced-motion` é **obrigatório**. `useMotion()` faz cada transição durar 100 ms e remove deslocamento e escala, mantendo só um fade curto ou a troca imediata.

## Proibido

- Sem bounce.
- Sem glow pulsante.
- Sem animação infinita.
- Sem efeito decorativo.
- Sem scroll reveal sem propósito e sem `FadeInDown` idêntico repetido em toda seção.

## Princípios

Motion comunica estado, feedback, hierarquia ou relação espacial. Não mascara lentidão: o feedback começa imediatamente. Um movimento com propósito por interação.

// ============================================================
// contextos/usarSubida.ts — SuperRH
// Detecta que um contador MUDOU (fluidez F4): devolve um número que aumenta a cada mudança, para um efeito reagir
// (sino balançando, badge dando o "pop"). Nunca dispara na montagem nem na 1ª leitura (`pronto` ainda falso).
// Com `soSobe`, só conta quando o valor SOBE (chegou notificação nova), nunca quando desce.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { contadorSubiu } from '../helpers/microinteracoes';

export function usarSubida(valor: number, pronto: boolean, soSobe = true): number {
  const anterior = useRef<number | undefined>(undefined);
  const [pulso, setPulso] = useState(0);

  useEffect(() => {
    if (!pronto) { anterior.current = undefined; return; }
    const mudou = anterior.current !== undefined && Number.isFinite(valor) && valor !== anterior.current;
    if (soSobe ? contadorSubiu(anterior.current, valor) : mudou) setPulso((p) => p + 1);
    anterior.current = valor;
  }, [valor, pronto, soSobe]);

  return pulso;
}

// ============================================================
// componentes/DateField.tsx — SuperRH
// Campo de DATA. Esta é a versão NATIVA (iOS/Android): campo com máscara DD/MM/AAAA que
// converte de/para ISO. Na web o Metro usa DateField.web.tsx (seletor nativo do navegador).
// O valor que sai e entra é sempre ISO "AAAA-MM-DD".
// ============================================================

import { useEffect, useState } from 'react';
import { foraDoIntervalo, isoParaBr, lerDataBr, mascararData, mensagemDeData } from '../helpers/camposData';
import type { PropsCampoTempo } from './camposTipos';
import { Input } from './Input';

export function DateField({ label, value, onChange, required, error, disabled, min, max, hint, containerStyle, accessibilityLabel }: PropsCampoTempo) {
  const [texto, setTexto] = useState(isoParaBr(value));
  const [saiu, setSaiu] = useState(false);

  // Quando quem usa o campo troca o valor (ex.: dia tocado no calendário), o texto acompanha.
  useEffect(() => {
    const atual = lerDataBr(texto);
    const isoAtual = atual.estado === 'ok' ? atual.iso : '';
    if (value !== isoAtual) setTexto(isoParaBr(value));
    // só reage a `value`: `texto` muda a cada tecla e não deve disparar a sincronização.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function aoDigitar(bruto: string) {
    const mascarado = mascararData(bruto);
    setTexto(mascarado);
    const leitura = lerDataBr(mascarado);
    onChange(leitura.estado === 'ok' ? leitura.iso : '');
  }

  const leitura = lerDataBr(texto);
  let erroInterno: string | undefined;
  if (leitura.estado === 'invalido') erroInterno = mensagemDeData(leitura) ?? undefined;
  else if (leitura.estado === 'incompleto' && saiu) erroInterno = mensagemDeData(leitura, 'a data') ?? undefined;
  else if (leitura.estado === 'ok' && foraDoIntervalo(leitura.iso, min, max)) {
    erroInterno = min && leitura.iso < min ? `A data não pode ser antes de ${isoParaBr(min)}.` : `A data não pode ser depois de ${isoParaBr(max)}.`;
  }

  return (
    <Input
      accessibilityLabel={accessibilityLabel}
      containerStyle={containerStyle}
      editable={!disabled}
      error={error ?? erroInterno}
      hint={hint ?? 'Formato: DD/MM/AAAA'}
      keyboardType="numeric"
      label={label}
      maxLength={10}
      onBlur={() => setSaiu(true)}
      onChangeText={aoDigitar}
      placeholder="DD/MM/AAAA"
      required={required}
      value={texto}
    />
  );
}

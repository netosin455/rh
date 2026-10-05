// ============================================================
// componentes/TimeField.tsx — SuperRH
// Campo de HORA. Versão NATIVA (iOS/Android): campo com máscara HH:mm que converte de/para
// "HH:mm". Na web o Metro usa TimeField.web.tsx (seletor nativo do navegador).
// ============================================================

import { useEffect, useState } from 'react';
import { lerHora, mascararHora, mensagemDeHora } from '../helpers/camposData';
import type { PropsCampoTempo } from './camposTipos';
import { Input } from './Input';

export function TimeField({ label, value, onChange, required, error, disabled, min, max, hint, containerStyle, accessibilityLabel }: PropsCampoTempo) {
  const [texto, setTexto] = useState(value);
  const [saiu, setSaiu] = useState(false);

  useEffect(() => {
    const atual = lerHora(texto);
    const horaAtual = atual.estado === 'ok' ? atual.iso : '';
    if (value !== horaAtual) setTexto(value);
    // só reage a `value` (ver DateField).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function aoDigitar(bruto: string) {
    const mascarado = mascararHora(bruto);
    setTexto(mascarado);
    const leitura = lerHora(mascarado);
    onChange(leitura.estado === 'ok' ? leitura.iso : '');
  }

  const leitura = lerHora(texto);
  let erroInterno: string | undefined;
  if (leitura.estado === 'invalido') erroInterno = mensagemDeHora(leitura) ?? undefined;
  else if (leitura.estado === 'incompleto' && saiu) erroInterno = mensagemDeHora(leitura) ?? undefined;
  else if (leitura.estado === 'ok' && min && leitura.iso < min) erroInterno = `O horário não pode ser antes de ${min}.`;
  else if (leitura.estado === 'ok' && max && leitura.iso > max) erroInterno = `O horário não pode ser depois de ${max}.`;

  return (
    <Input
      accessibilityLabel={accessibilityLabel}
      containerStyle={containerStyle}
      editable={!disabled}
      error={error ?? erroInterno}
      hint={hint ?? 'Formato: HH:mm'}
      keyboardType="numeric"
      label={label}
      maxLength={5}
      onBlur={() => setSaiu(true)}
      onChangeText={aoDigitar}
      placeholder="HH:mm"
      required={required}
      value={texto}
    />
  );
}

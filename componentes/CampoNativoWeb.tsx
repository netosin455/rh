// ============================================================
// componentes/CampoNativoWeb.tsx — SuperRH
// Base WEB de DateField e TimeField: <input type="date"> / <input type="time"> nativos do
// navegador (seletor de data/hora sem digitar formato), com rótulo associado, foco visível,
// alvo de toque >= 44 px e os tokens do projeto. Só é importado pelos arquivos *.web.tsx.
// ============================================================

import { CSSProperties, useId, useState } from 'react';
import { View } from 'react-native';
import { theme } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import type { PropsCampoTempo } from './camposTipos';

type CampoNativoWebProps = PropsCampoTempo & { tipo: 'date' | 'time' };

export function CampoNativoWeb({ tipo, label, value, onChange, required, error, disabled, min, max, hint, containerStyle, accessibilityLabel }: CampoNativoWebProps) {
  const id = useId();
  const [foco, setFoco] = useState(false);
  const dicaId = `${id}-dica`;
  const erroId = `${id}-erro`;
  const descritoPor = [hint ? dicaId : '', error ? erroId : ''].filter(Boolean).join(' ') || undefined;

  const estiloRotulo: CSSProperties = {
    color: theme.texto.discreto,
    fontFamily: tipografia.rotulo.fontFamily,
    fontSize: tipografia.rotulo.fontSize,
    letterSpacing: tipografia.rotulo.letterSpacing,
    lineHeight: `${tipografia.rotulo.lineHeight}px`,
    marginBottom: espaco.xs,
    textTransform: 'uppercase',
  };

  const estiloCampo: CSSProperties = {
    background: disabled ? theme.superficie.sutil : theme.superficie.elevada,
    border: `${borda.fina}px solid ${error ? theme.status.erro.forte : foco ? theme.foco.anel : theme.bordaSemantica.sutil}`,
    borderRadius: raio.controle,
    boxSizing: 'border-box',
    color: theme.texto.primario,
    fontFamily: tipografia.corpo.fontFamily,
    fontSize: tipografia.corpo.fontSize,
    minHeight: tamanho.toqueMinimo + espaco.xs,
    opacity: disabled ? 0.6 : 1,
    // Foco visível para quem navega com o teclado (Tab).
    outline: foco ? `${borda.foco}px solid ${theme.foco.anel}` : 'none',
    outlineOffset: 1,
    padding: `0 ${espaco.md}px`,
    width: '100%',
  };

  return (
    <View style={containerStyle}>
      <label htmlFor={id} style={estiloRotulo}>
        {label}
        {required ? <span style={{ fontWeight: 400, textTransform: 'none' }}> · obrigatório</span> : null}
      </label>
      <input
        aria-describedby={descritoPor}
        aria-invalid={error ? true : undefined}
        aria-label={accessibilityLabel ? `${accessibilityLabel}${required ? ', obrigatório' : ''}` : undefined}
        aria-required={required ? true : undefined}
        disabled={disabled}
        id={id}
        lang="pt-BR"
        max={max}
        min={min}
        onBlur={() => setFoco(false)}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFoco(true)}
        style={estiloCampo}
        type={tipo}
        value={value}
      />
      {hint ? <span id={dicaId} style={{ color: theme.texto.discreto, fontFamily: tipografia.legenda.fontFamily, fontSize: tipografia.legenda.fontSize, lineHeight: `${tipografia.legenda.lineHeight}px`, marginTop: espaco.xs }}>{hint}</span> : null}
      {error ? <span aria-live="polite" id={erroId} role="alert" style={{ color: theme.status.erro.forte, fontFamily: tipografia.legenda.fontFamily, fontSize: tipografia.legenda.fontSize, lineHeight: `${tipografia.legenda.lineHeight}px`, marginTop: espaco.xs }}>{error}</span> : null}
    </View>
  );
}

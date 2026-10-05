// ============================================================
// componentes/camposTipos.ts — SuperRH
// Props COMUNS de DateField e TimeField (mesma API nos dois).
// O valor da aplicação é sempre ISO: "AAAA-MM-DD" (data) ou "HH:mm" (hora); "" = vazio.
// ============================================================

import type { StyleProp, ViewStyle } from 'react-native';

export interface PropsCampoTempo {
  label: string;
  /** ISO ("AAAA-MM-DD" / "HH:mm") ou "" quando vazio. Nunca o texto exibido. */
  value: string;
  /** Recebe ISO, ou "" se o campo foi limpo ou ainda está incompleto/inválido. */
  onChange: (valor: string) => void;
  required?: boolean;
  /** Erro de quem usa o campo (ex.: "Escolha a data do evento."). Tem prioridade sobre o erro interno. */
  error?: string;
  disabled?: boolean;
  /** Limites em ISO (inclusivos). */
  min?: string;
  max?: string;
  /** Dica de formato; o fallback nativo já traz uma padrão. */
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

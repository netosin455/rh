// ============================================================
// componentes/DateField.web.tsx — SuperRH
// Campo de DATA na WEB: seletor nativo do navegador (<input type="date">).
// Valor sempre ISO "AAAA-MM-DD". Mesma API do DateField nativo (componentes/camposTipos.ts).
// ============================================================

import type { PropsCampoTempo } from './camposTipos';
import { CampoNativoWeb } from './CampoNativoWeb';

export function DateField(props: PropsCampoTempo) {
  return <CampoNativoWeb {...props} tipo="date" />;
}

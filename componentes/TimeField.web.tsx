// ============================================================
// componentes/TimeField.web.tsx — SuperRH
// Campo de HORA na WEB: seletor nativo do navegador (<input type="time">).
// Valor sempre "HH:mm". Mesma API do TimeField nativo (componentes/camposTipos.ts).
// ============================================================

import type { PropsCampoTempo } from './camposTipos';
import { CampoNativoWeb } from './CampoNativoWeb';

export function TimeField(props: PropsCampoTempo) {
  return <CampoNativoWeb {...props} tipo="time" />;
}

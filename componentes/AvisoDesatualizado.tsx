// ============================================================
// componentes/AvisoDesatualizado.tsx — SuperRH
// Aviso discreto quando a atualização em segundo plano falhou: o conteúdo antigo continua na tela.
// ============================================================

import { StyleSheet, Text } from 'react-native';
import { cores } from '../estilo/cores';
import { espaco } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';

export function AvisoDesatualizado({ visivel }: { visivel: boolean }) {
  if (!visivel) return null;
  return (
    <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.texto}>
      Não foi possível atualizar. Mostrando o que já estava na tela.
    </Text>
  );
}

const styles = StyleSheet.create({
  texto: { ...tipografia.legenda, color: cores.status.pendente.forte, paddingVertical: espaco.xs },
});

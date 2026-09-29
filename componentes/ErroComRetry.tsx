import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { Button } from './Button';

type ErroComRetryProps = {
  /** O que falhou, ex.: "Não foi possível carregar os avisos." */
  mensagem: string;
  onTentarNovamente: () => void;
  carregando?: boolean;
};

/** Aviso de falha visível com ação de repetir: evita que erro de API pareça "lista vazia". */
export function ErroComRetry({ mensagem, onTentarNovamente, carregando }: ErroComRetryProps) {
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Ionicons name="warning-outline" size={tamanho.iconeMedio} color={theme.status.erro.forte} />
      <Text style={styles.texto}>{mensagem}</Text>
      <Button label="Tentar de novo" icon="refresh" variant="secondary" onPress={onTentarNovamente} loading={carregando} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: theme.status.erro.superficie,
    borderColor: theme.status.erro.borda,
    borderRadius: raio.controle,
    borderWidth: borda.fina,
    gap: espaco.md,
    padding: espaco.lg,
  },
  texto: { ...tipografia.corpo, color: theme.texto.primario, textAlign: 'center' },
});

import { Alert, Platform } from 'react-native';

// Alert.alert do React Native não tem efeito nenhum na versão web
// (react-native-web implementa como função vazia) — sem isso, todo
// diálogo de confirmação fica mudo quando o app roda como site.
export function confirmAction(title: string, message: string, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', onPress: onConfirm },
  ]);
}

// ============================================================
// componentes/BotaoWhatsApp.tsx — SuperRH
// "Enviar no WhatsApp": abre https://wa.me/?text=MENSAGEM (o RH escolhe o contato) ou, quando há
// telefone válido, direto na conversa daquela pessoa. Web: nova aba. Nativo: Linking.
// A mensagem e o link vêm prontos de helpers/whatsapp.ts (sem conteúdo sensível).
// ============================================================

import { Linking, Platform, StyleProp, ViewStyle } from 'react-native';
import { useToast } from '../contextos/Toast';
import { urlWhatsapp } from '../helpers/whatsapp';
import { Button } from './Button';

type BotaoWhatsAppProps = {
  mensagem: string;
  /** Telefone do destinatário (opcional). Inválido é ignorado e cai no wa.me sem número. */
  telefone?: string | null;
  /** Nome acessível mais específico quando há vários botões na tela (ex.: "Enviar no WhatsApp: Clima"). */
  accessibilityLabel?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function BotaoWhatsApp({ mensagem, telefone, accessibilityLabel, label = 'Enviar no WhatsApp', style, variant = 'ghost' }: BotaoWhatsAppProps) {
  const toast = useToast();

  function abrir() {
    const url = urlWhatsapp(mensagem, telefone);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Sem "noopener" na lista de recursos: com ele window.open sempre devolve null e não dá para detectar o bloqueio.
      const janela = window.open(url, '_blank');
      if (!janela) { toast.error('O navegador bloqueou a nova aba. Libere pop-ups para este site.'); return; }
      janela.opener = null;
      return;
    }
    Linking.openURL(url).catch(() => toast.error('Não foi possível abrir o WhatsApp.'));
  }

  return <Button accessibilityLabel={accessibilityLabel ?? label} icon="logo-whatsapp" label={label} onPress={abrir} style={style} variant={variant} />;
}

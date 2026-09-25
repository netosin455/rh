import { Ionicons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode } from 'react';
import { Modal as NativeModal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius, theme } from '../estilo/cores';
import { fonts } from '../estilo/tipografia';

type AppModalProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
}>;

export function AppModal({ visible, title, subtitle, onClose, footer, children }: AppModalProps) {
  return (
    <NativeModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar modal" onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </NativeModal>
  );
}

export { AppModal as Modal };

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(26,22,15,0.34)', flex: 1, justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: theme.card, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, maxWidth: 520, shadowColor: theme.shadowStrong, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 1, shadowRadius: 40, width: '100%' },
  header: { alignItems: 'flex-start', borderBottomColor: theme.border, borderBottomWidth: 1, flexDirection: 'row', gap: 12, padding: 16 },
  headerCopy: { flex: 1 },
  title: { color: theme.textPrimary, fontFamily: fonts.display, fontSize: 24 },
  subtitle: { color: theme.textMuted, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', marginTop: -10, marginRight: -10, width: 44 },
  body: { padding: 16 },
  footer: { borderTopColor: theme.border, borderTopWidth: 1, padding: 16 },
});

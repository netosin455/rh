import { Image, StyleSheet, Text, View } from 'react-native';
import { theme } from '../estilo/cores';
import { raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';

type AvatarSize = 'small' | 'medium' | 'large';

type AvatarProps = {
  name: string;
  source?: string;
  size?: AvatarSize;
  accessibilityLabel?: string;
};

const dimensions: Record<AvatarSize, number> = {
  small: tamanho.avatarPequeno,
  medium: tamanho.avatarMedio,
  large: tamanho.avatarGrande,
};

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function Avatar({ name, source, size = 'medium', accessibilityLabel }: AvatarProps) {
  const dimension = dimensions[size];
  const label = accessibilityLabel ?? `Avatar de ${name}`;

  if (source) {
    return <Image accessibilityLabel={label} accessibilityRole="image" source={{ uri: source }} style={[styles.image, { height: dimension, width: dimension }]} />;
  }

  return (
    <View accessibilityRole="image" accessibilityLabel={label} style={[styles.avatar, { height: dimension, width: dimension }]}>
      <Text style={styles.initials}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', backgroundColor: theme.accent.superficie, borderRadius: raio.pill, justifyContent: 'center' },
  image: { backgroundColor: theme.superficie.sutil, borderRadius: raio.pill },
  initials: { ...tipografia.legenda, color: theme.accent.douradoProfundo },
});

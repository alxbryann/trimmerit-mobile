import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../../theme';
import { useColors, useTheme } from '../../theme/ThemeContext';

/**
 * Header común para las pantallas de estadísticas.
 * @param {{ navigation: any, title: string, subtitle?: string }} props
 */
export default function StatsHeader({ navigation, title, subtitle }) {
  const colors = useColors();
  const { mode } = useTheme();
  const isLight = mode === 'light';
  const styles = StyleSheet.create({
    wrap: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    back: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isLight ? colors.acidDim : colors.cardBorder,
      backgroundColor: isLight ? colors.acidSoft : colors.dark2,
    },
    body: { flex: 1 },
    title: {
      fontFamily: fonts.display,
      fontSize: 24,
      color: colors.white,
      letterSpacing: 0.5,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.grayMid,
      lineHeight: 16,
      marginTop: 2,
    },
  });

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <Ionicons name="chevron-back" size={20} color={isLight ? colors.acid : colors.white} />
      </TouchableOpacity>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

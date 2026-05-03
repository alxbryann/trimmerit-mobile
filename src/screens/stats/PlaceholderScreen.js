import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../../theme';
import { useColors } from '../../theme/ThemeContext';
import StatsHeader from '../../components/stats/StatsHeader';

/**
 * Pantalla placeholder reutilizable para vistas estadísticas en construcción.
 * @param {{ navigation: any, title: string, subtitle?: string, icon?: string, hint?: string }} props
 */
export default function PlaceholderScreen({
  navigation,
  title,
  subtitle,
  icon = 'construct',
  hint,
}) {
  const colors = useColors();
  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.black },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    iconWrap: {
      width: 88,
      height: 88,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.dark2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 20,
    },
    label: {
      fontFamily: fonts.display,
      fontSize: 16,
      letterSpacing: 3,
      color: colors.acid,
      marginBottom: 8,
    },
    msg: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.grayMid,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <StatsHeader navigation={navigation} title={title} subtitle={subtitle} />
        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={36} color={colors.grayMid} />
          </View>
          <Text style={styles.label}>EN CONSTRUCCIÓN</Text>
          <Text style={styles.msg}>
            {hint ?? 'Esta vista estará disponible próximamente. Estamos preparando los datos y los gráficos.'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

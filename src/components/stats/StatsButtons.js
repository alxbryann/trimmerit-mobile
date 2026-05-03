import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts, radii } from '../../theme';
import { useColors } from '../../theme/ThemeContext';

const ADMIN_BUTTONS = [
  {
    id: 'resumen',
    title: 'Resumen',
    subtitle: 'Flujo y KPIs',
    icon: 'stats-chart',
    route: 'ResumenGeneral',
  },
  {
    id: 'equipo',
    title: 'Equipo',
    subtitle: 'Productividad y comisiones',
    icon: 'people',
    route: 'EquipoStats',
  },
  {
    id: 'clientes',
    title: 'Clientes',
    subtitle: 'Retención y recurrencia',
    icon: 'person-circle',
    route: 'ClientesStats',
    params: { scope: 'barberia' },
  },
  {
    id: 'caja',
    title: 'Caja',
    subtitle: 'Ingresos, gastos y margen',
    icon: 'cash',
    route: 'CajaStats',
  },
];

const EMPLEADO_BUTTONS = [
  {
    id: 'clientes',
    title: 'Mis Clientes',
    subtitle: 'Retención de tu cartera',
    icon: 'person-circle',
    route: 'ClientesStats',
    params: { scope: 'barbero' },
  },
  {
    id: 'billetera',
    title: 'Billetera',
    subtitle: 'Tus ingresos y comisiones',
    icon: 'wallet',
    route: 'Billetera',
  },
];

/**
 * Sección "Estadísticas" con botones según rol.
 * @param {{ navigation: any, role: 'admin' | 'empleado' }} props
 */
export default function StatsButtons({ navigation, role }) {
  const colors = useColors();
  const buttons = role === 'admin' ? ADMIN_BUTTONS : EMPLEADO_BUTTONS;

  const styles = StyleSheet.create({
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    sectionNum: { fontFamily: fonts.display, fontSize: 14, color: colors.acid, letterSpacing: 1 },
    sectionTitle: { fontFamily: fonts.display, fontSize: 14, letterSpacing: 2, color: colors.grayLight },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    },
    card: {
      width: '48%',
      backgroundColor: colors.dark2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.md,
      padding: 14,
      minHeight: 110,
      justifyContent: 'space-between',
    },
    cardWide: {
      width: '100%',
    },
    iconWrap: {
      width: 36,
      height: 36,
      backgroundColor: colors.acidSoft,
      borderWidth: 1,
      borderColor: colors.acidDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 18,
      color: colors.white,
      letterSpacing: 0.5,
      marginTop: 10,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.grayMid,
      lineHeight: 14,
      marginTop: 2,
    },
  });

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionNum}>※</Text>
        <Text style={styles.sectionTitle}>ESTADÍSTICAS</Text>
      </View>
      <View style={styles.grid}>
        {buttons.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={[styles.card, role === 'empleado' && styles.cardWide]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate(b.route, b.params)}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={b.icon} size={18} color={colors.acid} />
            </View>
            <View>
              <Text style={styles.title}>{b.title}</Text>
              <Text style={styles.subtitle}>{b.subtitle}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

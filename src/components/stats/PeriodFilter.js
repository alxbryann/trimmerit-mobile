import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { fonts, radii } from '../../theme';
import { useColors } from '../../theme/ThemeContext';

const OPTIONS = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'anio', label: 'Año' },
];

/**
 * Chips para filtrar por periodo.
 * @param {{ value: 'dia'|'semana'|'mes'|'anio', onChange: (v: string) => void }} props
 */
export default function PeriodFilter({ value, onChange }) {
  const colors = useColors();

  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      backgroundColor: colors.dark2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.md,
      padding: 4,
      marginBottom: 16,
    },
    chip: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: radii.sm,
    },
    chipActive: {
      backgroundColor: colors.acid,
    },
    label: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 1.2,
      color: colors.grayMid,
    },
    labelActive: {
      color: colors.black,
    },
  });

  return (
    <View style={styles.row}>
      {OPTIONS.map((o) => {
        const active = value === o.id;
        return (
          <TouchableOpacity
            key={o.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(o.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {o.label.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { fonts } from '../../theme';
import { useColors } from '../../theme/ThemeContext';

/**
 * Donut chart con porcentaje al centro.
 * @param {{ percentage: number, size?: number, strokeWidth?: number, label?: string }} props
 */
export default function DonutChart({
  percentage,
  size = 160,
  strokeWidth = 14,
  label,
}) {
  const colors = useColors();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const dashOffset = circumference * (1 - clamped / 100);

  const styles = StyleSheet.create({
    wrap: { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
    center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    pct: { fontFamily: fonts.display, fontSize: 36, color: colors.acid, letterSpacing: 1 },
    label: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.5, color: colors.grayMid, marginTop: 2 },
  });

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.cardBorder}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.acid}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={styles.center}>
        <Text style={styles.pct}>{clamped}%</Text>
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </View>
    </View>
  );
}

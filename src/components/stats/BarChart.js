import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { fonts } from '../../theme';
import { useColors } from '../../theme/ThemeContext';

/**
 * Barras dobles (Ingresos vs Gastos) con eje Y simple.
 * @param {{ data: Array<{ label: string, ingresos: number, gastos: number }>, height?: number }} props
 */
export default function BarChart({ data, height = 160 }) {
  const colors = useColors();
  const [activeIndex, setActiveIndex] = useState(null);
  const max = Math.max(
    1,
    ...data.flatMap((d) => [d.ingresos, d.gastos]),
  );
  const ticks = [0, 0.33, 0.66, 1].map((p) => Math.round(max * p));

  const styles = StyleSheet.create({
    root: { flexDirection: 'row', height: height + 24 },
    yAxis: {
      width: 38,
      justifyContent: 'space-between',
      paddingVertical: 4,
      paddingRight: 6,
    },
    yLabel: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.grayMid,
      textAlign: 'right',
    },
    plot: { flex: 1, justifyContent: 'flex-end' },
    bars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      overflow: 'visible',
    },
    group: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end', overflow: 'visible' },
    pair: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: '100%' },
    bar: {
      width: 14,
      borderTopWidth: 0,
    },
    barIngresos: { backgroundColor: colors.acid },
    barGastos: { backgroundColor: colors.terracota ?? colors.danger },
    xLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    xLabel: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.grayMid,
      textAlign: 'center',
      flex: 1,
    },
    tooltip: {
      position: 'absolute',
      top: -72,
      left: '50%',
      transform: [{ translateX: -52 }],
      width: 104,
      backgroundColor: colors.ink ?? '#0a0a0a',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 8,
      zIndex: 99,
    },
    tooltipRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    tooltipLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.grayMid },
    tooltipVal: { fontFamily: fonts.bodyBold, fontSize: 9 },
    tooltipIng: { color: colors.acid },
    tooltipGas: { color: colors.terracota ?? colors.danger },
    legend: {
      flexDirection: 'row',
      gap: 14,
      marginTop: 10,
      paddingLeft: 38,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8 },
    dotIng: { backgroundColor: colors.acid },
    dotGas: { backgroundColor: colors.terracota ?? colors.danger },
    legendTxt: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.grayLight, letterSpacing: 0.5 },
  });

  return (
    <View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.dotIng]} />
          <Text style={styles.legendTxt}>Ingresos</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.dotGas]} />
          <Text style={styles.legendTxt}>Gastos</Text>
        </View>
      </View>

      <View style={[styles.root, { marginTop: 8 }]}>
        <View style={[styles.yAxis, { height }]}>
          {[...ticks].reverse().map((t, i) => (
            <Text key={i} style={styles.yLabel}>
              {formatShort(t)}
            </Text>
          ))}
        </View>
        <View style={styles.plot}>
          <View style={styles.bars}>
            {data.map((d, i) => {
              const ingH = (d.ingresos / max) * (height - 4);
              const gasH = (d.gastos / max) * (height - 4);
              const isActive = activeIndex === i;
              return (
                <Pressable
                  key={i}
                  style={styles.group}
                  onHoverIn={() => setActiveIndex(i)}
                  onHoverOut={() => setActiveIndex(null)}
                  onPressIn={() => setActiveIndex(i)}
                  onPressOut={() => setActiveIndex(null)}
                >
                  {isActive && (
                    <View style={styles.tooltip}>
                      <View style={styles.tooltipRow}>
                        <Text style={styles.tooltipLabel}>Ingresos</Text>
                        <Text style={[styles.tooltipVal, styles.tooltipIng]}>{formatShort(d.ingresos)}</Text>
                      </View>
                      <View style={styles.tooltipRow}>
                        <Text style={styles.tooltipLabel}>Gastos</Text>
                        <Text style={[styles.tooltipVal, styles.tooltipGas]}>{formatShort(d.gastos)}</Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.pair}>
                    <View style={[styles.bar, styles.barIngresos, { height: Math.max(2, ingH) }]} />
                    <View style={[styles.bar, styles.barGastos, { height: Math.max(2, gasH) }]} />
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.xLabels}>
            {data.map((d, i) => (
              <Text key={i} style={styles.xLabel}>{d.label}</Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function formatShort(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

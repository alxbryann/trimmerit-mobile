import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radii, shadows } from '../theme';

/**
 * Tarjeta de fidelización visual
 *
 * Props:
 *  - nombreBarberia  : string
 *  - sellosAcumulados: number
 *  - sellosRequeridos: number
 *  - beneficioDesc   : string
 *  - completada      : bool  (true si llegó al objetivo, pendiente de canje)
 *  - accentColor     : string (hex, opcional — usa colors.acid por defecto)
 */
export default function LoyaltyCard({
  nombreBarberia = 'Barbería',
  sellosAcumulados = 0,
  sellosRequeridos = 10,
  beneficioDesc = '',
  completada = false,
  accentColor,
}) {
  const accent = accentColor ?? colors.acid;
  const filled = Math.min(sellosAcumulados, sellosRequeridos);
  const pct = sellosRequeridos > 0 ? (filled / sellosRequeridos) * 100 : 0;

  // Mostrar hasta 12 sellos visibles; si hay más, agrupar
  const maxVisible = 12;
  const total = Math.min(sellosRequeridos, maxVisible);

  return (
    <View style={[styles.wrapper, shadows.md]}>
      {/* Fondo con gradiente sutil */}
      <LinearGradient
        colors={['#1a1a1a', '#0f0f0f']}
        style={[styles.card, completada && styles.cardComplete]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Línea de acento lateral */}
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="ribbon" size={14} color={accent} style={styles.headerIcon} />
            <Text style={[styles.label, { color: accent }]}>FIDELIZACIÓN</Text>
          </View>
          {completada && (
            <View style={[styles.readyBadge, { backgroundColor: accent }]}>
              <Text style={styles.readyText}>¡LISTO!</Text>
            </View>
          )}
        </View>

        <Text style={styles.barberia} numberOfLines={1}>{nombreBarberia.toUpperCase()}</Text>

        {/* Sellos */}
        <View style={styles.stampsGrid}>
          {Array.from({ length: total }).map((_, i) => {
            const stamped = i < filled;
            return (
              <View
                key={i}
                style={[
                  styles.stamp,
                  stamped
                    ? [styles.stampFilled, { backgroundColor: accent, borderColor: accent }]
                    : styles.stampEmpty,
                ]}
              >
                {stamped && (
                  <Ionicons name="cut" size={13} color={colors.black} />
                )}
              </View>
            );
          })}
          {/* Si el programa tiene más de 12 sellos, mostrar el restante como texto */}
          {sellosRequeridos > maxVisible && (
            <View style={[styles.stamp, styles.stampEmpty]}>
              <Text style={[styles.overflowText, { color: accent }]}>
                +{sellosRequeridos - maxVisible}
              </Text>
            </View>
          )}
        </View>

        {/* Barra de progreso */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: accent }]} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.countText}>
            <Text style={[styles.countBig, { color: accent }]}>{filled}</Text>
            <Text style={styles.countOf}> / {sellosRequeridos} cortes</Text>
          </Text>
          {beneficioDesc ? (
            <Text style={styles.beneficio} numberOfLines={1}>
              🎁 {beneficioDesc}
            </Text>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
    paddingLeft: 24,
    gap: 12,
    overflow: 'hidden',
  },
  cardComplete: {
    borderColor: colors.acid,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: radii.lg,
    borderBottomLeftRadius: radii.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIcon: { opacity: 0.9 },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2.5,
  },
  readyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  readyText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.black,
  },
  barberia: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.white,
    letterSpacing: 1,
    marginTop: -4,
  },
  stampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  stamp: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampEmpty: {
    borderColor: colors.grayMid,
    backgroundColor: 'transparent',
  },
  stampFilled: {
    borderWidth: 0,
  },
  overflowText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.gray,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: radii.pill,
    minWidth: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  countText: {},
  countBig: {
    fontFamily: fonts.display,
    fontSize: 20,
  },
  countOf: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.grayLight,
  },
  beneficio: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.grayLight,
    flex: 1,
    textAlign: 'right',
  },
});

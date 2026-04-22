import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.inner}>

          <View style={styles.top}>
            <Text style={styles.kicker}>trimmerit™{' '}·{' '}vol. 01 · 2026</Text>
          </View>

          <View style={styles.middle}>
            <Text style={styles.tagline}>— the chair, refined —</Text>
            <Text style={styles.phrase}>tu silla,{'\n'}<Text style={styles.accentPhrase}>agendada.</Text></Text>
            <View style={styles.rule} />
            <Text style={styles.sub}>
              Reservá con Trimmerit en segundos. Sin llamadas, sin plantones, sin apps de más.
            </Text>
          </View>

          <View style={styles.bottom}>
            <TouchableOpacity
              style={styles.primary}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryText}>iniciar sesión</Text>
              <Text style={styles.primaryArrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondary}
              onPress={() => navigation.navigate('Registro')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryText}>crear cuenta</Text>
            </TouchableOpacity>

            <Text style={styles.barberHint}>¿sos profesional? unite al catálogo →</Text>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },

  top: { paddingTop: 16 },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.muted2,
  },

  middle: { flex: 1, justifyContent: 'center' },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: colors.champagne,
    marginBottom: 18,
  },
  phrase: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 58,
    lineHeight: 56,
    color: colors.paper,
    letterSpacing: -1,
  },
  accentPhrase: { color: colors.champagne },
  rule: {
    width: 56,
    height: 1,
    backgroundColor: colors.champagne,
    marginTop: 24,
    marginBottom: 18,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.muted,
    maxWidth: 280,
  },

  bottom: { gap: 10 },
  primary: {
    backgroundColor: colors.champagne,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 20,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  primaryArrow: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 22,
    color: colors.ink,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.paper,
  },
  barberHint: {
    textAlign: 'center',
    marginTop: 6,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
});

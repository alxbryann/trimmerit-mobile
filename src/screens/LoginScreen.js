import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { colors, fonts } from '../theme';
import { resolvePostAuthDestination, applyPostAuthDestination } from '../navigation/postAuthRouting';

export default function LoginScreen({ navigation, route }) {
  const redirect = route.params?.redirect;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  async function afterAuthSuccess(userId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || session.user.id !== userId) {
      setError('No se pudo validar la sesión.');
      return false;
    }
    const dest = await resolvePostAuthDestination(session);
    if (redirect?.screen && dest.kind === 'route' && dest.name === 'MainTabs') {
      navigation.reset({ index: 0, routes: [{ name: redirect.screen, params: redirect.params ?? {} }] });
      return true;
    }
    applyPostAuthDestination(navigation, dest, { redirect: redirect ?? null });
    return true;
  }

  async function handleSubmit() {
    if (!supabaseConfigured) { setError('Configura Supabase en las variables de entorno.'); return; }
    setError('');
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : signInError.message);
      setLoading(false);
      return;
    }
    await afterAuthSuccess(data.user.id);
    setLoading(false);
  }

  async function handleGoogle() {
    if (!supabaseConfigured) { setError('Configura Supabase en las variables de entorno.'); return; }
    setError('');
    setLoading(true);
    try {
      const { cancelled, session } = await signInWithGoogle();
      if (cancelled) { setLoading(false); return; }
      if (!session?.user) { setError('No se pudo obtener la sesión.'); setLoading(false); return; }
      const { data: existing } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
      if (!existing) {
        const nombre = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? '';
        navigation.reset({ index: 0, routes: [{ name: 'CompletarPerfil', params: { suggestedNombre: nombre, redirect: redirect ?? null } }] });
        setLoading(false);
        return;
      }
      await afterAuthSuccess(session.user.id);
    } catch (e) {
      setError(String(e.message ?? e));
    }
    setLoading(false);
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.navigate('Welcome')}>
                <Text style={styles.backText}>← inicio</Text>
              </TouchableOpacity>
              <Text style={styles.logo}>trimmerit<Text style={styles.logoAccent}>.</Text></Text>
            </View>

            <View style={styles.heroBlock}>
              <Text style={styles.tagline}>— entrar —</Text>
              <Text style={styles.title}>bienvenido{'\n'}de vuelta.</Text>
              <Text style={styles.sub}>
                ¿No tenés cuenta?{' '}
                <Text style={styles.link} onPress={() => navigation.navigate('Registro', { redirect })}>
                  Registrate
                </Text>
              </Text>
            </View>

            <View style={styles.card}>
              <Field
                label="correo"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                focused={focusedField === 'email'}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="none"
              />
              <Field
                label="contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                focused={focusedField === 'pass'}
                onFocus={() => setFocusedField('pass')}
                onBlur={() => setFocusedField(null)}
              />

              {error ? (
                <View style={styles.errBox}>
                  <Text style={styles.err}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primary, loading && styles.primaryOff]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryTxt}>{loading ? 'entrando...' : 'entrar'}</Text>
                <Text style={styles.primaryArrow}>→</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divTxt}>o continuá con</Text>
              <View style={styles.divLine} />
            </View>

            <TouchableOpacity style={styles.google} onPress={handleGoogle} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleTxt}>Google</Text>
            </TouchableOpacity>

            <View style={styles.hintRow}>
              <Text style={styles.hint}>¿Sos barbero? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Registro')}>
                <Text style={styles.link}>Únete →</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType, secureTextEntry, focused, onFocus, onBlur, autoCapitalize }) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.lbl}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[fieldStyles.input, focused && fieldStyles.inputFocused]}
        placeholderTextColor={colors.muted2}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? 'none'}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  lbl: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.champagne,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    color: colors.paper,
    fontFamily: fonts.body,
    fontSize: 17,
    paddingVertical: 10,
  },
  inputFocused: {
    borderBottomColor: colors.champagne,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  logo: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 16,
    color: colors.paper,
    letterSpacing: -0.5,
  },
  logoAccent: { color: colors.champagne },

  heroBlock: { marginBottom: 28 },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.champagne,
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 50,
    lineHeight: 50,
    color: colors.paper,
    letterSpacing: -1,
    marginBottom: 10,
  },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  link: { color: colors.champagne, fontFamily: fonts.bodySemi },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(242,239,231,0.02)',
    padding: 20,
    marginBottom: 24,
  },

  errBox: {
    borderWidth: 1,
    borderColor: 'rgba(184,94,76,0.3)',
    backgroundColor: colors.dangerSoft,
    padding: 12,
    marginBottom: 14,
  },
  err: { fontFamily: fonts.body, color: colors.terracota, fontSize: 13, lineHeight: 18 },

  primary: {
    backgroundColor: colors.champagne,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryOff: { opacity: 0.55 },
  primaryTxt: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 18,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  primaryArrow: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 20,
    color: colors.ink,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  google: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  googleIcon: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 18,
    color: colors.paper,
  },
  googleTxt: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.paper,
  },

  hintRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});

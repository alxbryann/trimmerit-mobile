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
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { colors, fonts, radii, shadows } from '../theme';
import { RESET_MAIN_AGENDA, resetToBarberMainTabs } from '../navigation/resetMainTabs';

export default function RegistroScreen({ navigation, route }) {
  const redirect = route.params?.redirect;
  const [role, setRole] = useState('cliente');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [slugFinalSent, setSlugFinalSent] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  async function handleGoogle() {
    if (!supabaseConfigured) { setError('Configura Supabase.'); return; }
    setError(''); setLoading(true);
    try {
      const { cancelled } = await signInWithGoogle();
      if (cancelled) { setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setError('No se pudo obtener la sesión.'); setLoading(false); return; }
      const { data: existing } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
      const suggested = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? '';
      if (!existing) {
        navigation.reset({ index: 0, routes: [{ name: 'CompletarPerfil', params: { suggestedNombre: suggested, redirect, role } }] });
      } else if (existing.role === 'barbero') {
        const { data: barbero } = await supabase.from('barberos').select('slug').eq('id', session.user.id).maybeSingle();
        if (barbero?.slug) { navigation.reset(resetToBarberMainTabs(barbero.slug)); }
        else { navigation.reset({ index: 0, routes: [{ name: 'CompletarPerfil', params: { suggestedNombre: suggested, redirect, role: 'barbero' } }] }); }
      } else if (role === 'barbero') {
        navigation.reset({ index: 0, routes: [{ name: 'CompletarPerfil', params: { suggestedNombre: suggested, redirect, role: 'barbero' } }] });
      } else {
        navigation.reset(RESET_MAIN_AGENDA);
      }
    } catch (e) { setError(String(e.message ?? e)); }
    setLoading(false);
  }

  async function handleSubmit() {
    if (!supabaseConfigured) { setError('Configura Supabase.'); return; }
    setError(''); setLoading(true);
    const slugFinal = slug || nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre, role, telefono, ...(role === 'barbero' ? { slug: slugFinal } : {}) } },
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }
    if (signUpData.session && signUpData.user) {
      const userId = signUpData.user.id;
      const { error: profileErr } = await supabase.from('profiles').upsert({ id: userId, role, nombre, telefono });
      if (profileErr) { setError(profileErr.message); setLoading(false); return; }
      if (role === 'barbero') {
        const { error: barberErr } = await supabase.from('barberos').upsert({ id: userId, slug: slugFinal });
        if (barberErr) { setError(barberErr.message); setLoading(false); return; }
        navigation.reset(resetToBarberMainTabs(slugFinal));
      } else if (role === 'admin_barberia') {
        navigation.reset({ index: 0, routes: [{ name: 'CrearBarberia' }] });
      } else if (role === 'barbero_empleado') {
        navigation.reset({ index: 0, routes: [{ name: 'UnirseBarberia' }] });
      } else {
        if (redirect?.screen) { navigation.reset({ index: 0, routes: [{ name: redirect.screen, params: redirect.params ?? {} }] }); }
        else { navigation.reset(RESET_MAIN_AGENDA); }
      }
    } else if (signUpData.user) {
      setSlugFinalSent(slugFinal);
      setEmailSent(true);
    } else {
      setError('Ocurrió un error. Intenta iniciar sesión.');
    }
    setLoading(false);
  }

  if (emailSent) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.logo}>BARBER<Text style={styles.logoA}>.IT</Text></Text>
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>✓</Text>
              </View>
              <Text style={styles.title}>REVISA TU{'\n'}CORREO</Text>
              <Text style={styles.successBody}>
                Te enviamos un link a{'\n'}
                <Text style={{ color: colors.white, fontFamily: fonts.bodyBold }}>{email}</Text>
                {'\n\n'}
                {role === 'barbero'
                  ? `Tras confirmar, tu perfil estará en barberit.vercel.app/barbero/${slugFinalSent}`
                  : 'Tras confirmar, ya puedes iniciar sesión.'}
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Login')}>
                <LinearGradient colors={[colors.acid, colors.acidDim]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
                  <Text style={styles.primaryTxt}>IR A INICIAR SESIÓN</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEmailSent(false)} style={styles.ghostLink}>
                <Text style={styles.link}>Volver al registro</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Welcome')}
                style={styles.backBtn}
              >
                <Text style={styles.backText}>← INICIO</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Welcome')}>
                <Text style={styles.logo}>BARBER<Text style={styles.logoA}>.IT</Text></Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroBlock}>
              <Text style={styles.title}>CREAR{'\n'}CUENTA</Text>
              <Text style={styles.sub}>
                ¿Ya tienes cuenta?{' '}
                <Text style={styles.link} onPress={() => navigation.navigate('Login', { redirect })}>Inicia sesión</Text>
              </Text>
            </View>

            {/* Role selector */}
            <View style={styles.roles}>
              {[
                { id: 'cliente', icon: '◉', title: 'SOY CLIENTE', sub: 'Quiero reservar' },
                { id: 'barbero', icon: '✂', title: 'SOY BARBERO', sub: 'Aliado profesional' },
                { id: 'admin_barberia', icon: '⊕', title: 'ADMIN BARBERÍA', sub: 'Gestiona tu barbería y equipo' },
                { id: 'barbero_empleado', icon: '⊙', title: 'BARBERO COLABORADOR', sub: 'Únete a una barbería' },
              ].map((r) => {
                const active = role === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleBtn, active && styles.roleBtnOn]}
                    onPress={() => setRole(r.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.roleIcon, active && styles.roleIconOn]}>{r.icon}</Text>
                    <Text style={[styles.roleTitle, active && styles.roleTitleOn]}>{r.title}</Text>
                    <Text style={[styles.roleSub, active && styles.roleSubOn]}>{r.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Google */}
            <TouchableOpacity style={styles.google} onPress={handleGoogle} disabled={loading} activeOpacity={0.8}>
              <View style={styles.googleInner}>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleTxt}>CONTINUAR CON GOOGLE</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divTxt}>O CON CORREO</Text>
              <View style={styles.divLine} />
            </View>

            {/* Form card */}
            <View style={styles.card}>
              <Field label="NOMBRE" value={nombre} onChangeText={setNombre}
                focused={focusedField === 'nombre'} onFocus={() => setFocusedField('nombre')} onBlur={() => setFocusedField(null)} />
              <Field label="CORREO" value={email} onChangeText={setEmail} keyboardType="email-address"
                focused={focusedField === 'email'} onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)} />
              <Field label="TELÉFONO" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad"
                focused={focusedField === 'tel'} onFocus={() => setFocusedField('tel')} onBlur={() => setFocusedField(null)} />
              <Field label="CONTRASEÑA" value={password} onChangeText={setPassword} secureTextEntry
                focused={focusedField === 'pass'} onFocus={() => setFocusedField('pass')} onBlur={() => setFocusedField(null)} />

              {role === 'barbero' && (
                <View style={styles.slugWrap}>
                  <Field
                    label="URL DE TU PERFIL"
                    value={slug}
                    onChangeText={(v) => setSlug(v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                    placeholder="jovan-rivera"
                    focused={focusedField === 'slug'}
                    onFocus={() => setFocusedField('slug')}
                    onBlur={() => setFocusedField(null)}
                  />
                  <View style={styles.slugPreview}>
                    <Text style={styles.slugPreviewLabel}>barberit.vercel.app/barbero/</Text>
                    <Text style={styles.slugPreviewValue}>{slug || 'tu-nombre'}</Text>
                  </View>
                </View>
              )}

              {error ? (
                <View style={styles.errBox}>
                  <Text style={styles.errIcon}>⚠</Text>
                  <Text style={styles.err}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryOff]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={loading ? [colors.gray, colors.gray] : [colors.acid, colors.acidDim]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryGrad}
                >
                  <Text style={styles.primaryTxt}>
                    {loading ? 'CREANDO...' : role === 'barbero' ? 'CREAR PERFIL BARBERO →' : 'CREAR CUENTA →'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType, secureTextEntry, placeholder, focused, onFocus, onBlur }) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.lbl}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[fieldStyles.input, focused && fieldStyles.inputFocused]}
        placeholder={placeholder}
        placeholderTextColor={colors.grayMid}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  lbl: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.grayLight,
    marginBottom: 7,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.dark3,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.sm,
  },
  inputFocused: {
    borderColor: colors.acid,
    backgroundColor: '#131500',
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 2 },
  backText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.grayMid },
  logo: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, color: colors.white },
  logoA: { color: colors.acid },

  heroBlock: { marginBottom: 24 },
  title: { fontFamily: fonts.display, fontSize: 44, color: colors.white, letterSpacing: 1, lineHeight: 42, marginBottom: 8 },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.grayLight },
  link: { color: colors.acid, fontFamily: fonts.bodyBold },

  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  roleBtn: {
    width: '47%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.dark2,
    padding: 14,
    alignItems: 'center',
    borderRadius: radii.md,
    gap: 4,
  },
  roleBtnOn: { backgroundColor: '#111500', borderColor: colors.acid },
  roleIcon: { fontSize: 20, color: colors.grayMid, marginBottom: 2 },
  roleIconOn: { color: colors.acid },
  roleTitle: { fontFamily: fonts.display, fontSize: 14, letterSpacing: 1, color: colors.grayLight },
  roleTitleOn: { color: colors.acid },
  roleSub: { fontFamily: fonts.body, fontSize: 11, color: colors.grayMid },
  roleSubOn: { color: colors.acidDim },

  google: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.sm,
    backgroundColor: colors.dark2,
    marginBottom: 16,
    ...shadows.sm,
  },
  googleInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 10 },
  googleIcon: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  googleTxt: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 2, color: colors.white },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  divLine: { flex: 1, height: 1, backgroundColor: colors.gray },
  divTxt: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.grayMid, letterSpacing: 2 },

  card: {
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: 20,
    ...shadows.sm,
  },

  slugWrap: { marginBottom: 14 },
  slugPreview: {
    flexDirection: 'row',
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  slugPreviewLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.grayMid },
  slugPreviewValue: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.acid },

  errBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: radii.sm,
    marginBottom: 12,
  },
  errIcon: { fontSize: 14, color: colors.danger },
  err: { fontFamily: fonts.body, color: colors.danger, fontSize: 13, flex: 1, lineHeight: 18 },

  primaryBtn: { borderRadius: radii.sm, overflow: 'hidden', marginTop: 4, ...shadows.acid },
  primaryOff: { opacity: 0.55 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center' },
  primaryTxt: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 3, color: colors.black },

  // Email sent
  successCard: {
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.2)',
    borderRadius: radii.lg,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.acidSoft,
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successIconText: { fontFamily: fonts.display, fontSize: 28, color: colors.acid },
  successBody: { fontFamily: fonts.body, fontSize: 15, color: colors.grayLight, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  ghostLink: { marginTop: 16 },
});

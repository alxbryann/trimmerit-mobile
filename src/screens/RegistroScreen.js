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
import { RESET_MAIN_AGENDA } from '../navigation/resetMainTabs';
import {
  resolvePostAuthDestination,
  applyPostAuthDestination,
  extractGoogleMetadata,
} from '../navigation/postAuthRouting';

const ROLES = [
  { id: 'cliente',          icon: '◉', title: 'SOY CLIENTE',         sub: 'Quiero reservar cortes' },
  { id: 'admin_barberia',   icon: '⊕', title: 'DUEÑO TRIMMERIT',     sub: 'Gestiono mi local y equipo' },
  { id: 'barbero_empleado', icon: '⊙', title: 'COLABORADOR',         sub: 'Me uno a un local con código' },
];

export default function RegistroScreen({ navigation, route }) {
  const redirect = route.params?.redirect;
  const [step, setStep] = useState('role'); // 'role' | 'method' | 'form'
  const [role, setRole] = useState('cliente');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const currentRole = ROLES.find((r) => r.id === role) ?? ROLES[0];

  function goBackStep() {
    setError('');
    if (step === 'form') setStep('method');
    else if (step === 'method') setStep('role');
    else navigation.navigate('Welcome');
  }

  async function handleGoogle() {
    if (!supabaseConfigured) { setError('Configura Supabase.'); return; }
    setError('');
    setLoading(true);
    try {
      const { cancelled } = await signInWithGoogle();
      if (cancelled) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setError('No se pudo obtener la sesión.'); return; }

      const dest = await resolvePostAuthDestination(session);

      if (dest.kind === 'completar') {
        // Primer registro con Google: fuerza el rol elegido y reenvía la metadata.
        const metadata = extractGoogleMetadata(session);
        navigation.reset({
          index: 0,
          routes: [{
            name: 'CompletarPerfil',
            params: { ...metadata, ...dest.params, role, redirect: redirect ?? null },
          }],
        });
      } else {
        // Ya tenía perfil: respetamos el destino real (no el rol elegido en este form).
        applyPostAuthDestination(navigation, dest, { redirect: redirect ?? null });
      }
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!supabaseConfigured) { setError('Configura Supabase.'); return; }
    setError(''); setLoading(true);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre, role, telefono } },
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }
    if (signUpData.session && signUpData.user) {
      const userId = signUpData.user.id;
      const { error: profileErr } = await supabase.from('profiles').upsert({ id: userId, role, nombre, telefono });
      if (profileErr) { setError(profileErr.message); setLoading(false); return; }
      if (role === 'admin_barberia') {
        navigation.reset({ index: 0, routes: [{ name: 'CrearBarberia' }] });
      } else if (role === 'barbero_empleado') {
        navigation.reset({ index: 0, routes: [{ name: 'UnirseBarberia' }] });
      } else {
        if (redirect?.screen) { navigation.reset({ index: 0, routes: [{ name: redirect.screen, params: redirect.params ?? {} }] }); }
        else { navigation.reset(RESET_MAIN_AGENDA); }
      }
    } else if (signUpData.user) {
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
            <Text style={styles.logo}>TRIMMER<Text style={styles.logoA}>IT</Text></Text>
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>✓</Text>
              </View>
              <Text style={styles.title}>REVISA TU{'\n'}CORREO</Text>
              <Text style={styles.successBody}>
                Te enviamos un link a{'\n'}
                <Text style={{ color: colors.white, fontFamily: fonts.bodyBold }}>{email}</Text>
                {'\n\n'}
                {'Tras confirmar, ya puedes iniciar sesión.'}
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

  const stepIndex = step === 'role' ? 1 : step === 'method' ? 2 : 3;
  const totalSteps = step === 'form' ? 3 : 2;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={goBackStep} style={styles.backBtn}>
                <Text style={styles.backText}>← {step === 'role' ? 'INICIO' : 'ATRÁS'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Welcome')}>
                <Text style={styles.logo}>TRIMMER<Text style={styles.logoA}>IT</Text></Text>
              </TouchableOpacity>
            </View>

            {/* Progress */}
            <View style={styles.progressRow}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i + 1 === stepIndex && styles.progressDotActive,
                    i + 1 < stepIndex && styles.progressDotDone,
                  ]}
                />
              ))}
              <Text style={styles.progressTxt}>PASO {stepIndex} DE {totalSteps}</Text>
            </View>

            {step === 'role' && (
              <StepRole
                role={role}
                setRole={setRole}
                onContinue={() => { setError(''); setStep('method'); }}
                onGoLogin={() => navigation.navigate('Login', { redirect })}
              />
            )}

            {step === 'method' && (
              <StepMethod
                currentRole={currentRole}
                loading={loading}
                error={error}
                onGoogle={handleGoogle}
                onEmail={() => { setError(''); setStep('form'); }}
              />
            )}

            {step === 'form' && (
              <StepForm
                currentRole={currentRole}
                nombre={nombre} setNombre={setNombre}
                email={email} setEmail={setEmail}
                telefono={telefono} setTelefono={setTelefono}
                password={password} setPassword={setPassword}
                focusedField={focusedField} setFocusedField={setFocusedField}
                loading={loading}
                error={error}
                onSubmit={handleSubmit}
              />
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ────────────────── Paso 1: Rol ────────────────── */
function StepRole({ role, setRole, onContinue, onGoLogin }) {
  return (
    <View>
      <View style={styles.heroBlock}>
        <Text style={styles.title}>CREAR{'\n'}CUENTA</Text>
        <Text style={styles.sub}>
          ¿Ya tienes cuenta?{' '}
          <Text style={styles.link} onPress={onGoLogin}>Inicia sesión</Text>
        </Text>
      </View>

      <Text style={styles.sectionLbl}>¿CUÁL ES TU ROL EN TRIMMERIT?</Text>
      <Text style={styles.sectionHint}>Elige uno para continuar.</Text>

      <View style={styles.roles}>
        {ROLES.map((r) => {
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

      <TouchableOpacity style={styles.primaryBtn} onPress={onContinue} activeOpacity={0.88}>
        <LinearGradient
          colors={[colors.acid, colors.acidDim]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.primaryGrad}
        >
          <Text style={styles.primaryTxt}>CONTINUAR →</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

/* ────────────────── Paso 2: Método ────────────────── */
function StepMethod({ currentRole, loading, error, onGoogle, onEmail }) {
  return (
    <View>
      <View style={styles.heroBlock}>
        <Text style={styles.title}>¿CÓMO CREAMOS{'\n'}TU CUENTA?</Text>
        <Text style={styles.sub}>
          Registrándote como{' '}
          <Text style={styles.link}>{currentRole.title.toLowerCase()}</Text>.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.methodCard, loading && styles.primaryOff]}
        onPress={onGoogle}
        disabled={loading}
        activeOpacity={0.85}
      >
        <View style={styles.methodIconCircle}>
          <Text style={styles.methodGoogleIcon}>G</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.methodTitle}>CONTINUAR CON GOOGLE</Text>
          <Text style={styles.methodSub}>Un toque, sin contraseña.</Text>
        </View>
        <Text style={styles.methodArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.methodCard, loading && styles.primaryOff]}
        onPress={onEmail}
        disabled={loading}
        activeOpacity={0.85}
      >
        <View style={styles.methodIconCircle}>
          <Text style={styles.methodEmailIcon}>@</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.methodTitle}>CONTINUAR CON CORREO</Text>
          <Text style={styles.methodSub}>Te pedimos tus datos en el siguiente paso.</Text>
        </View>
        <Text style={styles.methodArrow}>→</Text>
      </TouchableOpacity>

      {error ? (
        <View style={styles.errBox}>
          <Text style={styles.errIcon}>⚠</Text>
          <Text style={styles.err}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ────────────────── Paso 3: Formulario (correo) ────────────────── */
function StepForm({
  currentRole,
  nombre, setNombre,
  email, setEmail,
  telefono, setTelefono,
  password, setPassword,
  focusedField, setFocusedField,
  loading, error,
  onSubmit,
}) {
  const titleLine = currentRole.id === 'cliente'        ? 'TUS\nDATOS'
                  : currentRole.id === 'admin_barberia' ? 'TU CUENTA\nDE DUEÑO'
                  : 'TU CUENTA\nCOLABORADOR';

  return (
    <View>
      <View style={styles.heroBlock}>
        <Text style={styles.title}>{titleLine}</Text>
        <Text style={styles.sub}>
          Como <Text style={styles.link}>{currentRole.title.toLowerCase()}</Text>.
        </Text>
      </View>

      <View style={styles.card}>
        <Field label="NOMBRE" value={nombre} onChangeText={setNombre}
          focused={focusedField === 'nombre'} onFocus={() => setFocusedField('nombre')} onBlur={() => setFocusedField(null)} />
        <Field label="CORREO" value={email} onChangeText={setEmail} keyboardType="email-address"
          focused={focusedField === 'email'} onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)} />
        <Field label="TELÉFONO" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad"
          focused={focusedField === 'tel'} onFocus={() => setFocusedField('tel')} onBlur={() => setFocusedField(null)} />
        <Field label="CONTRASEÑA" value={password} onChangeText={setPassword} secureTextEntry
          focused={focusedField === 'pass'} onFocus={() => setFocusedField('pass')} onBlur={() => setFocusedField(null)} />

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errIcon}>⚠</Text>
            <Text style={styles.err}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.primaryOff]}
          onPress={onSubmit}
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
              {loading ? 'CREANDO...' : 'CREAR CUENTA →'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
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

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  progressDot: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
  },
  progressDotActive: { backgroundColor: colors.acid },
  progressDotDone: { backgroundColor: colors.acidDim },
  progressTxt: {
    marginLeft: 8,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.grayMid,
  },

  sectionLbl: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.grayLight,
    marginBottom: 4,
  },
  sectionHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.grayMid,
    marginBottom: 16,
  },

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

  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    backgroundColor: colors.dark2,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    ...shadows.sm,
  },
  methodIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.dark3,
  },
  methodGoogleIcon: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.white },
  methodEmailIcon: { fontFamily: fonts.display, fontSize: 20, color: colors.acid },
  methodTitle: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 2, color: colors.white, marginBottom: 2 },
  methodSub: { fontFamily: fonts.body, fontSize: 12, color: colors.grayMid },
  methodArrow: { fontFamily: fonts.display, fontSize: 20, color: colors.grayLight },

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

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts } from '../theme';
import { RESET_MAIN_AGENDA, resetToBarberMainTabs } from '../navigation/resetMainTabs';

const ROLES = [
  { id: 'cliente', title: 'SOY CLIENTE', sub: 'Reservar citas' },
  { id: 'barbero', title: 'SOY BARBERO', sub: 'Perfil profesional' },
  { id: 'admin_barberia', title: 'ADMIN BARBERÍA', sub: 'Crear tu barbería' },
  { id: 'barbero_empleado', title: 'COLABORADOR', sub: 'Unirme con código' },
];

function normalizeIntentRole(r) {
  if (r === 'barbero' || r === 'cliente' || r === 'admin_barberia' || r === 'barbero_empleado') return r;
  return null;
}

export default function CompletarPerfilScreen({ navigation, route }) {
  const suggestedNombre = route.params?.suggestedNombre ?? '';
  const redirect = route.params?.redirect;
  /** Rol elegido en Registro (o null si entró por Login / arranque sin perfil) */
  const intentRole = useMemo(() => normalizeIntentRole(route.params?.role), [route.params?.role]);
  const [role, setRole] = useState(() => intentRole ?? 'cliente');
  const [nombre, setNombre] = useState(suggestedNombre);
  const [telefono, setTelefono] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState({
    email: route.params?.suggestedEmail ?? '',
    avatar: route.params?.suggestedAvatar ?? '',
    nombre: suggestedNombre,
  });

  const roleLocked = intentRole != null;
  const showRolePicker = !roleLocked;
  const isClienteFlow = role === 'cliente';
  const needsBarberSlug = role === 'barbero';
  const needsNombreField = role !== 'cliente';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigation.replace('Login');
        return;
      }
      const meta = session.user?.user_metadata || {};
      setSessionInfo((prev) => ({
        email: prev.email || session.user?.email || meta.email || '',
        avatar: prev.avatar || meta.avatar_url || meta.picture || '',
        nombre: prev.nombre || meta.full_name || meta.name || '',
      }));
    });
  }, [navigation]);

  useEffect(() => {
    if (role !== 'barbero') return;
    const s = (suggestedNombre || sessionInfo.nombre || '').trim();
    if (!s) return;
    setNombre((prev) => (prev.trim() ? prev : s));
  }, [role, suggestedNombre, sessionInfo.nombre]);

  async function handleSubmit() {
    if (!supabaseConfigured) {
      setError('Configura Supabase.');
      return;
    }
    setError('');
    const tel = telefono.trim();
    const nameBarber = nombre.trim();

    if (role === 'cliente') {
      if (!tel) {
        setError('Ingresá tu número de teléfono.');
        return;
      }
    } else if (role === 'barbero') {
      if (!nameBarber) {
        setError('Ingresá tu nombre.');
        return;
      }
      if (!tel) {
        setError('Ingresá tu teléfono.');
        return;
      }
    } else if (role === 'admin_barberia' || role === 'barbero_empleado') {
      if (!nameBarber) {
        setError('Ingresá tu nombre.');
        return;
      }
      if (!tel) {
        setError('Ingresá tu teléfono.');
        return;
      }
    }

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigation.replace('Login');
      setLoading(false);
      return;
    }
    const userId = session.user.id;
    const clientNameFallback =
      (suggestedNombre || sessionInfo.nombre || '').trim() ||
      (sessionInfo.email ? sessionInfo.email.split('@')[0] : '') ||
      'Cliente';
    const nombreParaPerfil = role === 'cliente' ? clientNameFallback : nameBarber;
    const slugFinal =
      role === 'barbero'
        ? (slug || nameBarber.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
        : '';

    if (role === 'barbero' && !slugFinal) {
      setError('Definí la URL de tu perfil o completá tu nombre.');
      setLoading(false);
      return;
    }

    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: userId,
      role,
      nombre: nombreParaPerfil,
      telefono: tel || null,
    });
    if (profileErr) {
      setError(profileErr.message);
      setLoading(false);
      return;
    }
    if (role === 'barbero') {
      const { error: barberErr } = await supabase.from('barberos').upsert({
        id: userId,
        slug: slugFinal,
      });
      if (barberErr) {
        setError(barberErr.message);
        setLoading(false);
        return;
      }
      navigation.reset(resetToBarberMainTabs(slugFinal));
    } else if (role === 'admin_barberia') {
      navigation.reset({ index: 0, routes: [{ name: 'CrearBarberia' }] });
    } else if (role === 'barbero_empleado') {
      navigation.reset({ index: 0, routes: [{ name: 'UnirseBarberia' }] });
    } else if (redirect?.screen) {
      navigation.reset({
        index: 0,
        routes: [{ name: redirect.screen, params: redirect.params ?? {} }],
      });
    } else {
      navigation.reset(RESET_MAIN_AGENDA);
    }
    setLoading(false);
  }

  const heroTitle = isClienteFlow ? 'TU TELÉFONO' : 'UN PASO MÁS';
  const heroSub = isClienteFlow
    ? 'Con esto podemos avisarte por SMS cuando confirmes una reserva.'
    : 'Completá los datos para continuar.';

  const showIdentityCard = !!(sessionInfo.email || sessionInfo.nombre);
  const identityInitial = (sessionInfo.nombre || sessionInfo.email || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{heroTitle}</Text>
            <Text style={styles.sub}>{heroSub}</Text>

            {showIdentityCard ? (
              <View style={styles.identityCard}>
                {sessionInfo.avatar ? (
                  <Image source={{ uri: sessionInfo.avatar }} style={styles.identityAvatar} />
                ) : (
                  <View style={styles.identityAvatarFallback}>
                    <Text style={styles.identityAvatarTxt}>{identityInitial}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.identityBadge}>CONECTADO CON GOOGLE</Text>
                  {sessionInfo.nombre ? (
                    <Text style={styles.identityName} numberOfLines={1}>
                      {sessionInfo.nombre}
                    </Text>
                  ) : null}
                  {sessionInfo.email ? (
                    <Text style={styles.identityEmail} numberOfLines={1}>
                      {sessionInfo.email}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {showRolePicker ? (
              <>
                <Text style={styles.sectionLbl}>¿CÓMO VAS A USAR LA APP?</Text>
                <View style={styles.rolesGrid}>
                  {ROLES.map((r) => {
                    const active = role === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.roleCard, active && styles.roleCardOn]}
                        onPress={() => setRole(r.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.roleCardTitle, active && styles.roleCardTitleOn]}>{r.title}</Text>
                        <Text style={[styles.roleCardSub, active && styles.roleCardSubOn]}>{r.sub}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.roleLocked}>
                <Text style={styles.roleLockedLbl}>REGISTRÁNDOTE COMO</Text>
                <Text style={styles.roleLockedVal}>
                  {ROLES.find((x) => x.id === role)?.title ?? role}
                </Text>
              </View>
            )}

            {needsNombreField ? (
              <Field label="NOMBRE" value={nombre} onChangeText={setNombre} />
            ) : null}

            <Field label="TELÉFONO" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />

            {needsBarberSlug ? (
              <View style={{ marginBottom: 14 }}>
                <Field
                  label="URL DE TU PERFIL"
                  value={slug}
                  onChangeText={(v) =>
                    setSlug(v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
                  }
                />
              </View>
            ) : null}

            {error ? (
              <View style={styles.errBox}>
                <Text style={styles.err}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primary, loading && styles.primaryOff]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.primaryTxt}>
                {loading ? 'GUARDANDO...' : isClienteFlow ? 'LISTO' : 'CONTINUAR'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.lbl}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholderTextColor={colors.grayMid}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  safe: { flex: 1 },
  scroll: { padding: 24 },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: colors.white,
    marginBottom: 8,
    letterSpacing: 1,
  },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.grayLight, marginBottom: 24 },
  rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  roleCard: {
    width: '47%',
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.dark2,
    padding: 12,
    borderRadius: 4,
    gap: 4,
  },
  roleCardOn: { borderColor: colors.acid, backgroundColor: '#111500' },
  roleCardTitle: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 0.5,
    color: colors.white,
  },
  roleCardTitleOn: { color: colors.acid },
  roleCardSub: { fontFamily: fonts.body, fontSize: 10, color: colors.grayMid },
  roleCardSubOn: { color: colors.acid },
  roleLocked: {
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.dark2,
    padding: 14,
    marginBottom: 20,
  },
  roleLockedLbl: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.grayLight,
    marginBottom: 6,
  },
  roleLockedVal: { fontFamily: fonts.display, fontSize: 16, color: colors.acid },

  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.25)',
    backgroundColor: 'rgba(205,255,0,0.04)',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
  },
  identityAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.dark2 },
  identityAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.acid,
  },
  identityAvatarTxt: { fontFamily: fonts.display, fontSize: 18, color: colors.acid },
  identityBadge: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.acid,
    marginBottom: 2,
  },
  identityName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  identityEmail: { fontFamily: fonts.body, fontSize: 12, color: colors.grayLight },

  sectionLbl: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.grayLight,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  lbl: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.grayLight,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.dark2,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.35)',
    padding: 12,
    marginBottom: 12,
  },
  err: { fontFamily: fonts.body, color: colors.danger, fontSize: 14 },
  primary: { backgroundColor: colors.acid, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  primaryOff: { opacity: 0.6 },
  primaryTxt: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.black,
  },
});

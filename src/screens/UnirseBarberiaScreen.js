import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { colors, fonts, radii, shadows } from '../theme';

export default function UnirseBarberiaScreen({ navigation }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  function handleCodeChange(val) {
    const clean = val.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(clean);
    if (error) setError('');
  }

  async function handleUnirse() {
    if (code.length !== 6) {
      setError('El código debe tener 6 dígitos.');
      return;
    }
    setError('');
    setLoading(true);

    const now = new Date().toISOString();
    const { data: barberia, error: findErr } = await supabase
      .from('barberias')
      .select('id, nombre, slug')
      .eq('invite_code', code)
      .eq('activo', true)
      .gt('invite_code_expires_at', now)
      .maybeSingle();

    if (findErr || !barberia) {
      setError('Código inválido o expirado. Pide uno nuevo al admin.');
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('No autenticado.'); setLoading(false); return; }

    const barberSlug = user.id.substring(0, 8);
    const { error: barberoErr } = await supabase.from('barberos').upsert({
      id: user.id,
      slug: barberSlug,
      barberia_id: barberia.id,
    });
    if (barberoErr) { setError(barberoErr.message); setLoading(false); return; }

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ role: 'barbero_empleado' })
      .eq('id', user.id);
    if (profileErr) { setError(profileErr.message); setLoading(false); return; }

    // Invalidate code after use
    await supabase
      .from('barberias')
      .update({ invite_code: null, invite_code_expires_at: null })
      .eq('id', barberia.id);

    setLoading(false);
    navigation.replace('MainTabs');
  }

  const isReady = code.length === 6 && !loading;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Text style={styles.backText}>← ATRÁS</Text>
              </TouchableOpacity>
              <Text style={styles.logo}>TRIMMER<Text style={styles.logoA}>IT</Text></Text>
            </View>

            <View style={styles.heroBlock}>
              <Text style={styles.title}>ÚNETE A{'\n'}LA PARTY</Text>
              <Text style={styles.sub}>Ingresa el código de 6 dígitos que te compartió tu admin.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>CÓDIGO</Text>

              {/* Tap the display to focus hidden input */}
              <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
                <View style={[styles.codeRow, focused && styles.codeRowFocused]}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.codeBox,
                        code[i] && styles.codeBoxFilled,
                        focused && i === code.length && styles.codeBoxCursor,
                      ]}
                    >
                      <Text style={styles.codeChar}>{code[i] ?? ''}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>

              {/* Hidden actual input */}
              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={handleCodeChange}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.hiddenInput}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoFocus
              />

              {error ? (
                <View style={styles.errBox}>
                  <Text style={styles.errIcon}>⚠</Text>
                  <Text style={styles.err}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryBtn, !isReady && styles.primaryOff]}
                onPress={handleUnirse}
                disabled={!isReady}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={isReady ? [colors.acid, colors.acidDim] : [colors.gray, colors.gray]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryGrad}
                >
                  {loading
                    ? <ActivityIndicator color={colors.black} />
                    : <Text style={styles.primaryTxt}>UNIRME →</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.hint}>El código expira 5 minutos después de ser generado</Text>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 2 },
  backText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.grayMid },
  logo: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, color: colors.white },
  logoA: { color: colors.acid },

  heroBlock: { marginBottom: 28 },
  title: { fontFamily: fonts.display, fontSize: 44, color: colors.white, letterSpacing: 1, lineHeight: 42, marginBottom: 8 },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.grayLight },

  card: {
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: 20,
    ...shadows.sm,
  },

  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.grayLight,
    marginBottom: 12,
    textTransform: 'uppercase',
  },

  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.sm,
    padding: 12,
    backgroundColor: colors.dark3,
  },
  codeRowFocused: { borderColor: colors.acid, backgroundColor: '#131500' },
  codeBox: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.gray,
  },
  codeBoxFilled: { borderBottomColor: colors.acid },
  codeBoxCursor: { borderBottomColor: colors.acid },
  codeChar: { fontFamily: fonts.display, fontSize: 32, color: colors.white, letterSpacing: 0 },

  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },

  errBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: radii.sm,
    marginTop: 12,
    marginBottom: 4,
  },
  errIcon: { fontSize: 14, color: colors.danger },
  err: { fontFamily: fonts.body, color: colors.danger, fontSize: 13, flex: 1, lineHeight: 18 },

  primaryBtn: { borderRadius: radii.sm, overflow: 'hidden', marginTop: 16, ...shadows.acid },
  primaryOff: { opacity: 0.45 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center' },
  primaryTxt: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 3, color: colors.black },

  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.grayMid, textAlign: 'center', marginTop: 12 },
});

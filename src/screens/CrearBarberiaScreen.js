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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { fonts, radii, shadows } from '../theme';
import { useColors } from '../theme/ThemeContext';

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function Field({
  colors,
  fieldStyles,
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
  numberOfLines,
  placeholder,
  hint,
  focused,
  onFocus,
  onBlur,
}) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.lbl}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[fieldStyles.input, focused && fieldStyles.inputFocused, multiline && fieldStyles.inputMulti]}
        placeholder={placeholder}
        placeholderTextColor={colors.grayMid}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        autoCapitalize="none"
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
    </View>
  );
}

function createFieldStyles(colors) {
  return StyleSheet.create({
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
      backgroundColor: colors.acidSoft,
    },
    inputMulti: {
      textAlignVertical: 'top',
      minHeight: 80,
    },
    hint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.grayMid,
      marginTop: 5,
    },
  });
}

export default function CrearBarberiaScreen({ navigation }) {
  const colors = useColors();
  const fieldStyles = createFieldStyles(colors);
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
  });

  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  function handleNombreChange(v) {
    setNombre(v);
    if (!slug || slug === slugify(nombre)) {
      setSlug(slugify(v));
    }
  }

  async function handleCrear() {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!slug.trim()) { setError('El slug es obligatorio.'); return; }
    setError('');
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('No autenticado.'); setLoading(false); return; }
    const slugTrim = slug.trim();
    const { data: created, error: insertErr } = await supabase
      .from('barberias')
      .insert({
        nombre: nombre.trim(),
        slug: slugTrim,
        admin_id: user.id,
        direccion: direccion.trim() || null,
        telefono: telefono.trim() || null,
        descripcion: descripcion.trim() || null,
      })
      .select('id, slug')
      .single();
    if (insertErr) {
      if (insertErr.message?.includes('unique') || insertErr.code === '23505') {
        setError('Ese slug ya está tomado. Elige otro.');
      } else {
        setError(insertErr.message);
      }
      setLoading(false);
      return;
    }
    const { error: barberoErr } = await supabase.from('barberos').upsert({
      id: user.id,
      barberia_id: created.id,
      slug: created.slug,
      nombre_barberia: nombre.trim(),
    });
    if (barberoErr) {
      setError(barberoErr.message);
      setLoading(false);
      return;
    }
    setLoading(false);
    navigation.replace('MainTabs');
  }

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
              <Text style={styles.title}>TU{'\n'}LOCAL TRIMMERIT</Text>
              <Text style={styles.sub}>Configura tu espacio.</Text>
            </View>

            <View style={styles.card}>
              <Field
                colors={colors}
                fieldStyles={fieldStyles}
                label="NOMBRE"
                value={nombre}
                onChangeText={handleNombreChange}
                placeholder="Mi local"
                focused={focusedField === 'nombre'}
                onFocus={() => setFocusedField('nombre')}
                onBlur={() => setFocusedField(null)}
              />
              <Field
                colors={colors}
                fieldStyles={fieldStyles}
                label="SLUG"
                value={slug}
                onChangeText={(v) => setSlug(slugify(v))}
                placeholder="mi-barberia"
                hint={`Tu URL: trimmerit.vercel.app/barberia/${slug || 'mi-barberia'}`}
                focused={focusedField === 'slug'}
                onFocus={() => setFocusedField('slug')}
                onBlur={() => setFocusedField(null)}
              />
              <Field
                colors={colors}
                fieldStyles={fieldStyles}
                label="DIRECCIÓN"
                value={direccion}
                onChangeText={setDireccion}
                placeholder="Calle 123 #45-67, Bogotá"
                focused={focusedField === 'direccion'}
                onFocus={() => setFocusedField('direccion')}
                onBlur={() => setFocusedField(null)}
              />
              <Field
                colors={colors}
                fieldStyles={fieldStyles}
                label="TELÉFONO"
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
                placeholder="+57 300 000 0000"
                focused={focusedField === 'telefono'}
                onFocus={() => setFocusedField('telefono')}
                onBlur={() => setFocusedField(null)}
              />
              <Field
                colors={colors}
                fieldStyles={fieldStyles}
                label="DESCRIPCIÓN"
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                numberOfLines={3}
                placeholder="Describe tu local..."
                focused={focusedField === 'desc'}
                onFocus={() => setFocusedField('desc')}
                onBlur={() => setFocusedField(null)}
              />

              {error ? (
                <View style={styles.errBox}>
                  <Text style={styles.errIcon}>⚠</Text>
                  <Text style={styles.err}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryOff]}
                onPress={handleCrear}
                disabled={loading}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={loading ? [colors.gray, colors.gray] : [colors.acid, colors.acidDim]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryGrad}
                >
                  {loading
                    ? <ActivityIndicator color={colors.black} />
                    : <Text style={styles.primaryTxt}>CREAR LOCAL →</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}


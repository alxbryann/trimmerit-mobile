import { useState, useRef, useEffect } from 'react';
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
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { colors, fonts, radii, shadows } from '../theme';

// ── OWASP A03/A04: geocodificación con Nominatim (OpenStreetMap) ──────────────
// Llamada solo en blur del campo dirección (no en cada tecla).
// User-Agent requerido por los ToS de Nominatim.
// No se loguea la dirección completa ni las coordenadas (OWASP A02).
async function geocodeAddress(rawAddress) {
  const address = rawAddress?.trim();
  // OWASP A03: validar longitud para no mandar queries arbitrariamente largas
  if (!address || address.length < 5 || address.length > 200) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Trimmerit/1.0 (contacto@trimmerit.app)',
        'Accept-Language': 'es',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.length) return null;
    const { lat, lon, address: addr } = data[0];
    return {
      lat: parseFloat(lat),
      lng: parseFloat(lon),
      ciudad: addr?.city ?? addr?.town ?? addr?.municipality ?? addr?.county ?? null,
    };
  } catch {
    return null; // Falla silenciosa — la dirección de texto se guarda igual
  }
}

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

// ── Abre la ubicación en la app de mapas del dispositivo ─────────────────────
// OWASP A02: lat/lng solo van al OS Maps, nunca se loguean
function abrirEnMaps(lat, lng, nombre) {
  const label = encodeURIComponent(nombre || 'Mi barbería');
  const url = Platform.select({
    ios:     `maps://maps.apple.com/?ll=${lat},${lng}&z=16&q=${label}`,
    android: `geo:${lat},${lng}?z=16`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  });
  Linking.canOpenURL(url)
    .then((ok) => Linking.openURL(ok ? url : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`))
    .catch(() => {});
}

// ── Campo de texto reutilizable ───────────────────────────────────────────────
function Field({ label, value, onChangeText, keyboardType, multiline, numberOfLines, placeholder, hint, focused, onFocus, onBlur }) {
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

// ── Componente: preview de ubicación ─────────────────────────────────────────
function MapPreview({ geoCoords, nombre, onCoordsChange }) {
  const [showManual, setShowManual] = useState(false);
  const [latText, setLatText]       = useState('');
  const [lngText, setLngText]       = useState('');
  const [manualErr, setManualErr]   = useState('');
  const [imgOk, setImgOk]           = useState(true);

  // Sincronizar campos manuales cuando llegan nuevas coords del geocoder
  useEffect(() => {
    if (geoCoords) {
      setLatText(String(geoCoords.lat));
      setLngText(String(geoCoords.lng));
    }
  }, [geoCoords]);

  if (!geoCoords) return null;

  // Mapa estático de OpenStreetMap (sin API key)
  const { lat, lng } = geoCoords;
  const mapUri = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=16&size=320x140&markers=${lat},${lng},red-pushpin`;

  function aplicarManual() {
    const newLat = parseFloat(latText.replace(',', '.'));
    const newLng = parseFloat(lngText.replace(',', '.'));
    if (isNaN(newLat) || isNaN(newLng)) { setManualErr('Ingresa números válidos.'); return; }
    // OWASP A05: validar rangos geográficos razonables (Colombia: lat 12°N a -5°S, lng -67° a -79°)
    if (newLat < -5 || newLat > 13 || newLng < -80 || newLng > -66) {
      setManualErr('Las coordenadas parecen estar fuera de Colombia.');
      // Aún así aplicamos (el barbero puede estar en otro país)
    }
    onCoordsChange({ ...geoCoords, lat: newLat, lng: newLng });
    setManualErr('');
    setShowManual(false);
  }

  return (
    <View style={mapStyles.wrap}>
      {/* Miniatura del mapa */}
      {imgOk ? (
        <Image
          source={{ uri: mapUri }}
          style={mapStyles.mapImg}
          resizeMode="cover"
          onError={() => setImgOk(false)}
        />
      ) : (
        <View style={mapStyles.mapFallback}>
          <Text style={mapStyles.mapFallbackTxt}>📍 {lat.toFixed(5)}, {lng.toFixed(5)}</Text>
        </View>
      )}

      {/* Acciones */}
      <View style={mapStyles.actions}>
        <TouchableOpacity
          style={mapStyles.mapsBtn}
          onPress={() => abrirEnMaps(lat, lng, nombre)}
          activeOpacity={0.8}
        >
          <Text style={mapStyles.mapsBtnTxt}>↗ Ver en Maps</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setShowManual((v) => !v); setManualErr(''); }}
          activeOpacity={0.8}
        >
          <Text style={mapStyles.ajustarLink}>
            {showManual ? 'Cancelar' : '✎ Ajustar pin'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Ajuste manual de coordenadas */}
      {showManual && (
        <View style={mapStyles.manualWrap}>
          <Text style={mapStyles.manualHint}>
            Copia las coordenadas desde Google Maps (mantén presionado el pin) y pégalas acá.
          </Text>
          <View style={mapStyles.coordRow}>
            <View style={{ flex: 1 }}>
              <Text style={mapStyles.coordLbl}>LATITUD</Text>
              <TextInput
                value={latText}
                onChangeText={(v) => { setLatText(v); setManualErr(''); }}
                style={mapStyles.coordInput}
                placeholder="4.6097"
                placeholderTextColor={colors.grayMid}
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={mapStyles.coordLbl}>LONGITUD</Text>
              <TextInput
                value={lngText}
                onChangeText={(v) => { setLngText(v); setManualErr(''); }}
                style={mapStyles.coordInput}
                placeholder="-74.0817"
                placeholderTextColor={colors.grayMid}
                keyboardType="numeric"
              />
            </View>
          </View>
          {manualErr ? <Text style={mapStyles.manualErr}>{manualErr}</Text> : null}
          <TouchableOpacity style={mapStyles.aplicarBtn} onPress={aplicarManual} activeOpacity={0.85}>
            <Text style={mapStyles.aplicarBtnTxt}>APLICAR COORDENADAS</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const mapStyles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  mapImg: {
    width: '100%',
    height: 140,
    backgroundColor: colors.dark3,
  },
  mapFallback: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark3,
  },
  mapFallbackTxt: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.grayMid,
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.dark3,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  mapsBtn: {
    borderWidth: 1,
    borderColor: colors.acid,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 2,
  },
  mapsBtnTxt: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.acid,
    textTransform: 'uppercase',
  },
  ajustarLink: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.grayMid,
  },
  manualWrap: {
    padding: 12,
    backgroundColor: colors.dark2,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    gap: 10,
  },
  manualHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.grayMid,
    lineHeight: 16,
  },
  coordRow: { flexDirection: 'row' },
  coordLbl: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.grayLight,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  coordInput: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.dark3,
    color: colors.white,
    fontFamily: fonts.mono,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radii.sm,
  },
  manualErr: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.danger,
  },
  aplicarBtn: {
    borderWidth: 1,
    borderColor: colors.grayMid,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  aplicarBtnTxt: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.white,
    textTransform: 'uppercase',
  },
});

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function CrearBarberiaScreen({ navigation }) {
  const [nombre, setNombre]         = useState('');
  const [slug, setSlug]             = useState('');
  const [direccion, setDireccion]   = useState('');
  const [telefono, setTelefono]     = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  // Geocodificación
  const [geoStatus, setGeoStatus]   = useState(null); // null | 'loading' | 'ok' | 'fail'
  const [geoCoords, setGeoCoords]   = useState(null);  // { lat, lng, ciudad }
  const lastGeoedAddress            = useRef('');

  function handleNombreChange(v) {
    setNombre(v);
    if (!slug || slug === slugify(nombre)) {
      setSlug(slugify(v));
    }
  }

  // Geocodificar al salir del campo dirección
  async function handleDireccionBlur() {
    const addr = direccion.trim();
    if (!addr || addr === lastGeoedAddress.current) return;
    lastGeoedAddress.current = addr;
    setGeoStatus('loading');
    const result = await geocodeAddress(addr);
    if (result) {
      setGeoCoords(result);
      setGeoStatus('ok');
    } else {
      setGeoCoords(null);
      setGeoStatus('fail');
    }
  }

  async function handleCrear() {
    if (!nombre.trim())    { setError('El nombre es obligatorio.'); return; }
    if (!slug.trim())      { setError('El slug es obligatorio.'); return; }
    if (!direccion.trim()) { setError('La dirección es obligatoria para que los clientes puedan encontrarte.'); return; }
    setError('');
    setLoading(true);

    // OWASP A07: getUser() valida el JWT en el servidor, no solo lo decodifica
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('No autenticado.'); setLoading(false); return; }

    const slugTrim = slug.trim();
    const { data: created, error: insertErr } = await supabase
      .from('barberias')
      .insert({
        nombre:    nombre.trim(),
        slug:      slugTrim,
        admin_id:  user.id,
        direccion: direccion.trim() || null,
        ciudad:    geoCoords?.ciudad ?? null,
        lat:       geoCoords?.lat    ?? null,
        lng:       geoCoords?.lng    ?? null,
        telefono:  telefono.trim()   || null,
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
      id:             user.id,
      barberia_id:    created.id,
      slug:           created.slug,
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

  // ── Back button: si no hay stack previo (llegamos via navigation.reset desde
  // postAuthRouting), goBack() no hace nada — ir a Welcome en su lugar.
  function handleBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Welcome');
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
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
                label="NOMBRE"
                value={nombre}
                onChangeText={handleNombreChange}
                placeholder="Mi local"
                focused={focusedField === 'nombre'}
                onFocus={() => setFocusedField('nombre')}
                onBlur={() => setFocusedField(null)}
              />
              <Field
                label="SLUG"
                value={slug}
                onChangeText={(v) => setSlug(slugify(v))}
                placeholder="mi-barberia"
                hint={`Tu URL: barberit.vercel.app/barberia/${slug || 'mi-barberia'}`}
                focused={focusedField === 'slug'}
                onFocus={() => setFocusedField('slug')}
                onBlur={() => setFocusedField(null)}
              />

              {/* Dirección + preview de mapa */}
              <View style={fieldStyles.wrap}>
                <Text style={fieldStyles.lbl}>DIRECCIÓN *</Text>
                <TextInput
                  value={direccion}
                  onChangeText={(v) => {
                    setDireccion(v);
                    setGeoStatus(null);
                    setGeoCoords(null);
                    lastGeoedAddress.current = '';
                  }}
                  style={[fieldStyles.input, focusedField === 'direccion' && fieldStyles.inputFocused]}
                  placeholder="Calle 123 #45-67, Bogotá"
                  placeholderTextColor={colors.grayMid}
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('direccion')}
                  onBlur={() => { setFocusedField(null); handleDireccionBlur(); }}
                />
                <Text style={[
                  fieldStyles.hint,
                  geoStatus === 'ok'   && styles.hintOk,
                  geoStatus === 'fail' && styles.hintFail,
                ]}>
                  {geoStatus === 'loading' ? '⟳ Verificando ubicación…'
                    : geoStatus === 'ok'   ? `✓ Ubicación encontrada${geoCoords?.ciudad ? ` · ${geoCoords.ciudad}` : ''}`
                    : geoStatus === 'fail' ? '⚠ No se encontró la dirección — verifica el texto o ajusta el pin manualmente.'
                    : 'Escribe la dirección completa. Al salir del campo se verificará en el mapa.'}
                </Text>

                {/* Preview de mapa inline */}
                <MapPreview
                  geoCoords={geoCoords}
                  nombre={nombre}
                  onCoordsChange={(updated) => setGeoCoords(updated)}
                />
              </View>

              <Field
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 2 },
  backText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.grayMid,
  },
  logo: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, color: colors.white },
  logoA: { color: colors.acid },

  heroBlock: { marginBottom: 28 },
  title: {
    fontFamily: fonts.display,
    fontSize: 44,
    color: colors.white,
    letterSpacing: 1,
    lineHeight: 42,
    marginBottom: 8,
  },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.grayLight },

  card: {
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: 20,
    ...shadows.sm,
  },

  hintOk:   { color: '#7ec87e' },
  hintFail: { color: colors.danger },

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
  err: {
    fontFamily: fonts.body,
    color: colors.danger,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  primaryBtn: {
    borderRadius: radii.sm,
    overflow: 'hidden',
    marginTop: 4,
    ...shadows.acid,
  },
  primaryOff: { opacity: 0.55 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center' },
  primaryTxt: {
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: 3,
    color: colors.black,
  },
});

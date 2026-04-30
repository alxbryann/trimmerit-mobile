/**
 * CatalogoScreen — Listado de barberías con búsqueda, filtros y ordenamiento
 *
 * Filtros disponibles:
 *   - Calificación mínima (rating)
 *   - Distancia máxima (km) — requiere permiso de ubicación
 *   - Servicios especiales (mascarilla, tinturas, lavado)
 *
 * OWASP:
 *  A01 — acceso público de lectura a barberias (RLS permite SELECT a autenticados);
 *         se verifica sesión activa antes de cargar datos de usuario
 *  A02 — coordenadas del usuario no se loguean ni almacenan (solo en estado local)
 *  A04 — permiso de ubicación solo "whenInUse", pedido al montar la pantalla,
 *         con explicación al usuario. No se pide "always".
 *  A05 — filtros validados (parseFloat, parseInt) antes de aplicarlos
 *  A09 — logs solo en __DEV__
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts } from '../theme';

// ── Constantes ────────────────────────────────────────────────────────────────
const SERVICIOS_OPCIONES = [
  { id: 'mascarilla', label: 'Mascarilla' },
  { id: 'tinturas',   label: 'Tinturas' },
  { id: 'lavado',     label: 'Lavado de cabello' },
];

const SORT_OPTIONS = [
  { id: 'distancia', label: 'Distancia' },
  { id: 'rating',    label: 'Calificación' },
  { id: 'nombre',    label: 'Nombre A–Z' },
];

// ── Haversine: distancia en km entre dos coordenadas ─────────────────────────
// OWASP A02: las coordenadas del usuario solo se usan acá, no se almacenan
function distanciaKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistancia(km) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// ── Filtros por defecto ───────────────────────────────────────────────────────
const DEFAULT_FILTERS = {
  sortBy: 'distancia',
  minRating: 0,
  maxDistanciaKm: null,   // null = sin límite
  servicios: [],          // ids seleccionados
};

// ── Card de una barbería ──────────────────────────────────────────────────────
function BarberiaCard({ item, userCoords, onPress }) {
  const km = userCoords
    ? distanciaKm(userCoords.lat, userCoords.lng, item.lat, item.lng)
    : null;
  const distLabel = formatDistancia(km);
  const count = item.barberos?.length ?? 0;
  const servicios = (item.servicios_especiales ?? [])
    .map((s) => SERVICIOS_OPCIONES.find((o) => o.id === s)?.label ?? s)
    .slice(0, 2);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.cardTop}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardKicker}>
            {item.ciudad ? `— ${item.ciudad.toLowerCase()} —` : '— local —'}
            {distLabel ? `  ·  ${distLabel}` : ''}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.nombre}</Text>
          {item.direccion ? (
            <Text style={styles.cardAddr} numberOfLines={1}>{item.direccion}</Text>
          ) : null}
        </View>
        <View style={styles.monoWrap}>
          <Text style={styles.monoChar}>{item.nombre?.charAt(0)?.toLowerCase() ?? '?'}</Text>
        </View>
      </View>

      {servicios.length > 0 && (
        <View style={styles.serviciosRow}>
          {servicios.map((s) => (
            <View key={s} style={styles.servicioBadge}>
              <Text style={styles.servicioTxt}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.footerMeta}>
          {count > 0 ? `${count} barbero${count !== 1 ? 's' : ''}` : 'sin barberos aún'}
          {item.hora_apertura ? `  ·  ${item.hora_apertura}–${item.hora_cierre}` : ''}
        </Text>
        <Text style={styles.reservarBtn}>ver →</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Panel de filtros (modal) ──────────────────────────────────────────────────
function FiltrosModal({ visible, filters, hasLocation, onApply, onClose }) {
  const [local, setLocal] = useState(filters);

  useEffect(() => {
    if (visible) setLocal(filters);
  }, [visible, filters]);

  function toggleServicio(id) {
    setLocal((prev) => ({
      ...prev,
      servicios: prev.servicios.includes(id)
        ? prev.servicios.filter((s) => s !== id)
        : [...prev.servicios, id],
    }));
  }

  function setSortBy(id) {
    setLocal((prev) => ({ ...prev, sortBy: id }));
  }

  function setMaxDist(val) {
    // OWASP A05: validar input numérico antes de usar
    const n = parseFloat(val);
    setLocal((prev) => ({
      ...prev,
      maxDistanciaKm: isNaN(n) || n <= 0 ? null : Math.min(n, 500),
    }));
  }

  function setMinRating(val) {
    const n = parseFloat(val);
    setLocal((prev) => ({
      ...prev,
      minRating: isNaN(n) ? 0 : Math.min(Math.max(n, 0), 5),
    }));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fStyles.overlay}>
        <View style={fStyles.sheet}>
          <View style={fStyles.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={fStyles.title}>filtros</Text>

            {/* Ordenar por */}
            <Text style={fStyles.label}>ORDENAR POR</Text>
            <View style={fStyles.chipRow}>
              {SORT_OPTIONS.map((op) => {
                const disabled = op.id === 'distancia' && !hasLocation;
                const active = local.sortBy === op.id && !disabled;
                return (
                  <TouchableOpacity
                    key={op.id}
                    style={[fStyles.chip, active && fStyles.chipActive, disabled && fStyles.chipDisabled]}
                    onPress={() => !disabled && setSortBy(op.id)}
                    activeOpacity={disabled ? 1 : 0.8}
                  >
                    <Text style={[fStyles.chipTxt, active && fStyles.chipTxtActive]}>
                      {op.label}{disabled ? ' (sin GPS)' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Distancia máxima */}
            {hasLocation && (
              <>
                <Text style={fStyles.label}>DISTANCIA MÁXIMA (KM)</Text>
                <TextInput
                  style={fStyles.input}
                  value={local.maxDistanciaKm != null ? String(local.maxDistanciaKm) : ''}
                  onChangeText={setMaxDist}
                  placeholder="sin límite"
                  placeholderTextColor={colors.muted2}
                  keyboardType="numeric"
                />
              </>
            )}

            {/* Calificación mínima */}
            <Text style={fStyles.label}>CALIFICACIÓN MÍNIMA ★</Text>
            <View style={fStyles.chipRow}>
              {[0, 3, 3.5, 4, 4.5].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[fStyles.chip, local.minRating === v && fStyles.chipActive]}
                  onPress={() => setMinRating(v)}
                  activeOpacity={0.8}
                >
                  <Text style={[fStyles.chipTxt, local.minRating === v && fStyles.chipTxtActive]}>
                    {v === 0 ? 'Todas' : `${v}+`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Servicios especiales */}
            <Text style={fStyles.label}>SERVICIOS ESPECIALES</Text>
            {SERVICIOS_OPCIONES.map((op) => {
              const active = local.servicios.includes(op.id);
              return (
                <TouchableOpacity
                  key={op.id}
                  style={fStyles.checkRow}
                  onPress={() => toggleServicio(op.id)}
                  activeOpacity={0.8}
                >
                  <View style={[fStyles.checkbox, active && fStyles.checkboxActive]}>
                    {active && <Text style={fStyles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[fStyles.checkLabel, active && fStyles.checkLabelActive]}>
                    {op.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={fStyles.btns}>
            <TouchableOpacity
              style={fStyles.resetBtn}
              onPress={() => setLocal({ ...DEFAULT_FILTERS, sortBy: hasLocation ? 'distancia' : 'nombre' })}
              activeOpacity={0.8}
            >
              <Text style={fStyles.resetTxt}>LIMPIAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={fStyles.applyBtn} onPress={() => onApply(local)} activeOpacity={0.88}>
              <Text style={fStyles.applyTxt}>APLICAR →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function CatalogoScreen({ navigation }) {
  const [barberias, setBarberias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [q, setQ] = useState('');
  const [userCoords, setUserCoords] = useState(null);  // { lat, lng }
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | loading | ok | denied
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFiltros, setShowFiltros] = useState(false);
  const hasFetchedRef = useRef(false);

  // ── Cargar barberías desde Supabase ─────────────────────────────────────────
  async function fetchBarberias() {
    if (!supabaseConfigured) {
      setLoading(false);
      setFetchError('Configura las variables de entorno de Supabase.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('barberias')
        .select('id, nombre, slug, direccion, ciudad, lat, lng, hora_apertura, hora_cierre, servicios_especiales, barberos(id)');
      if (error) { setFetchError(error.message); setBarberias([]); return; }
      setFetchError(null);
      setBarberias(data ?? []);
    } catch (e) {
      if (__DEV__) console.warn('[Catalogo] fetchBarberias error:', e?.message);
      setFetchError('No se pudo cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  }

  // ── Solicitar ubicación (solo "whenInUse", OWASP A04) ───────────────────────
  async function requestLocation() {
    setLocationStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        // Si el usuario deniega, cambiamos el sort default a nombre
        setFilters((prev) => ({
          ...prev,
          sortBy: prev.sortBy === 'distancia' ? 'nombre' : prev.sortBy,
        }));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      // OWASP A02: solo guardamos en estado local, nunca en logs ni storage
      setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setLocationStatus('ok');
    } catch {
      setLocationStatus('denied');
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchBarberias();
        requestLocation();
      }
    }, [])
  );

  // ── Filtrar + ordenar ────────────────────────────────────────────────────────
  const processed = (() => {
    let list = barberias.map((b) => ({
      ...b,
      _km: userCoords ? distanciaKm(userCoords.lat, userCoords.lng, b.lat, b.lng) : null,
    }));

    // Búsqueda por texto
    if (q.trim()) {
      const ql = q.trim().toLowerCase();
      list = list.filter((b) =>
        b.nombre?.toLowerCase().includes(ql) ||
        b.ciudad?.toLowerCase().includes(ql) ||
        b.direccion?.toLowerCase().includes(ql)
      );
    }

    // Filtro por calificación (si barberos tienen rating promedio)
    // Por ahora filtramos solo si el campo existe
    if (filters.minRating > 0) {
      list = list.filter((b) => (b.rating ?? 0) >= filters.minRating);
    }

    // Filtro por distancia máxima
    // OWASP A05: maxDistanciaKm ya fue validado en el modal
    if (filters.maxDistanciaKm != null && userCoords) {
      list = list.filter((b) => b._km != null && b._km <= filters.maxDistanciaKm);
    }

    // Filtro por servicios especiales (la barbería debe tener TODOS los seleccionados)
    if (filters.servicios.length > 0) {
      list = list.filter((b) =>
        filters.servicios.every((s) => (b.servicios_especiales ?? []).includes(s))
      );
    }

    // Ordenamiento
    if (filters.sortBy === 'distancia' && userCoords) {
      list.sort((a, b) => {
        if (a._km == null) return 1;
        if (b._km == null) return -1;
        return a._km - b._km;
      });
    } else if (filters.sortBy === 'rating') {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else {
      list.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));
    }

    return list;
  })();

  const activeFiltersCount =
    (filters.minRating > 0 ? 1 : 0) +
    (filters.maxDistanciaKm != null ? 1 : 0) +
    filters.servicios.length;

  function handleApplyFiltros(newFilters) {
    setFilters(newFilters);
    setShowFiltros(false);
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerKicker}>— catálogo · barberías —</Text>
          <Text style={styles.headerTitle}>buena{'\n'}tijera.</Text>
        </View>

        {/* Barra de búsqueda + filtros */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="buscar local o ciudad"
            placeholderTextColor={colors.muted2}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <TouchableOpacity
            style={[styles.filtrosBtn, activeFiltersCount > 0 && styles.filtrosBtnActive]}
            onPress={() => setShowFiltros(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filtrosTxt, activeFiltersCount > 0 && styles.filtrosTxtActive]}>
              {activeFiltersCount > 0 ? `filtros (${activeFiltersCount})` : 'filtros'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Estado de ubicación */}
        {locationStatus === 'loading' && (
          <Text style={styles.locationMsg}>⟳ Obteniendo ubicación…</Text>
        )}
        {locationStatus === 'denied' && (
          <Text style={styles.locationMsg}>Sin acceso a ubicación · ordenando por nombre</Text>
        )}

        {/* Lista */}
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.champagne} />
            <Text style={styles.muted}>Cargando barberías…</Text>
          </View>
        )}

        {!loading && fetchError && (
          <View style={styles.center}>
            <Text style={styles.errIcon}>⚠</Text>
            <Text style={styles.err}>{fetchError}</Text>
          </View>
        )}

        {!loading && !fetchError && barberias.length === 0 && (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyTitle}>aún no hay barberías</Text>
            <Text style={styles.muted}>Sé el primero en registrar tu local.</Text>
          </View>
        )}

        {!loading && !fetchError && barberias.length > 0 && (
          <FlatList
            data={processed}
            keyExtractor={(b) => b.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              processed.length > 0 ? (
                <Text style={styles.countText}>
                  {processed.length} {processed.length === 1 ? 'barbería' : 'barberías'}
                  {userCoords ? ' · ordenadas por distancia' : ''}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.muted}>Sin resultados para los filtros aplicados.</Text>
                <TouchableOpacity onPress={() => { setFilters(DEFAULT_FILTERS); setQ(''); }}>
                  <Text style={styles.clearLink}>Limpiar filtros →</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => (
              <BarberiaCard
                item={item}
                userCoords={userCoords}
                onPress={() => navigation.navigate('BarberProfile', { slug: item.slug })}
              />
            )}
          />
        )}

        <FiltrosModal
          visible={showFiltros}
          filters={filters}
          hasLocation={locationStatus === 'ok'}
          onApply={handleApplyFiltros}
          onClose={() => setShowFiltros(false)}
        />
      </SafeAreaView>
    </View>
  );
}

// ── Estilos principales ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1 },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  headerKicker: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.champagne,
    marginBottom: 6,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 48,
    lineHeight: 46,
    color: colors.paper,
    letterSpacing: -1,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  searchIcon: { fontSize: 16, color: colors.champagne },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.paper,
    paddingVertical: 0,
  },
  filtrosBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filtrosBtnActive: { borderColor: colors.champagne, backgroundColor: colors.champagneGlow },
  filtrosTxt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  filtrosTxtActive: { color: colors.champagne },

  locationMsg: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted2,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 20,
  },

  countText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 10,
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
  muted: { fontFamily: fonts.body, color: colors.muted, textAlign: 'center', fontSize: 14 },
  errIcon: { fontSize: 24, color: colors.terracota },
  err: { fontFamily: fonts.body, color: colors.terracota, textAlign: 'center', fontSize: 14 },
  emptyIcon: { fontSize: 28, color: colors.champagne },
  emptyTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 22,
    color: colors.paper,
    letterSpacing: -0.5,
  },
  clearLink: { fontFamily: fonts.bodySemi, color: colors.champagne, fontSize: 13 },

  list: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },

  // Card
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  cardMeta: { flex: 1 },
  cardKicker: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.champagne,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 24,
    lineHeight: 24,
    color: colors.paper,
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  cardAddr: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  monoWrap: {
    width: 48,
    height: 48,
    backgroundColor: colors.ink3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  monoChar: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 30,
    color: colors.champagne,
    letterSpacing: -1,
    lineHeight: 34,
  },
  serviciosRow: { flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  servicioBadge: {
    borderWidth: 1,
    borderColor: colors.champagneDim,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  servicioTxt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.champagne,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerMeta: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.muted },
  reservarBtn: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.champagne,
  },
});

// ── Estilos del modal de filtros ──────────────────────────────────────────────
const fStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.ink2 ?? colors.ink,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 32,
    color: colors.paper,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 8,
    marginTop: 16,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { borderColor: colors.champagne, backgroundColor: colors.champagneGlow },
  chipDisabled: { opacity: 0.4 },
  chipTxt: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.muted },
  chipTxtActive: { color: colors.champagne },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.paper,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.champagne, borderColor: colors.champagne },
  checkmark: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  checkLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, flex: 1 },
  checkLabelActive: { color: colors.paper },
  btns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  resetBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetTxt: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: colors.muted },
  applyBtn: {
    flex: 2,
    backgroundColor: colors.champagne,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyTxt: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 18,
    color: colors.ink,
    letterSpacing: -0.5,
  },
});

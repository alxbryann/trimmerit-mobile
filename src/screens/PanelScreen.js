import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts } from '../theme';

const SLOT_START = 9 * 60;
const SLOT_END = 20 * 60;
const STEP = 30;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function normalizeHora(t) {
  const raw = (t ?? '').trim();
  if (!raw) return '';
  const parts = raw.split(':');
  if (parts.length < 2) return raw;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return raw;
  return `${pad2(h)}:${pad2(m)}`;
}

function parseTimeToMin(t) {
  const key = normalizeHora(t);
  const [h, m] = key.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function slotsForDay() {
  const out = [];
  for (let m = SLOT_START; m < SLOT_END; m += STEP) {
    out.push(`${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`);
  }
  return out;
}

const DAY_SLOTS = slotsForDay();

export default function PanelScreen({ navigation, route }) {
  const slug = route.params?.slug;
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [barberoId, setBarberoId] = useState(null);

  const [day, setDay] = useState(() => {
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    return t;
  });

  const dateStr = useMemo(() => toISODate(day), [day]);
  const [reservas, setReservas] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loadErr, setLoadErr] = useState(null);
  const [completando, setCompletando] = useState(null);

  const loadReservas = useCallback(async () => {
    if (!barberoId) return;
    setLoadErr(null);
    const { data, error } = await supabase
      .from('reservas')
      .select('id, fecha, hora, precio, estado, cliente_id')
      .eq('barbero_id', barberoId)
      .eq('fecha', dateStr)
      .order('hora', { ascending: true });

    if (error) {
      setLoadErr(error.message);
      setReservas([]);
      return;
    }
    const rows = data ?? [];
    setReservas(rows);
    const ids = [...new Set(rows.map((r) => r.cliente_id))];
    if (ids.length === 0) {
      setProfiles({});
      return;
    }
    const { data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('id, nombre, telefono')
      .in('id', ids);
    if (pErr) {
      setLoadErr(pErr.message);
      return;
    }
    const map = {};
    for (const p of profs ?? []) map[p.id] = p;
    setProfiles(map);
  }, [barberoId, dateStr]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.replace('Login');
        return;
      }
      const { data: barbero, error } = await supabase
        .from('barberos')
        .select('id, slug')
        .eq('id', user.id)
        .maybeSingle();
      if (error || !barbero) {
        setAuthError(true);
        setLoading(false);
        return;
      }
      if (barbero.slug !== slug) {
        navigation.setParams({ slug: barbero.slug });
        return;
      }
      setBarberoId(barbero.id);
      setLoading(false);
    })();
  }, [slug, navigation]);

  useEffect(() => {
    if (!barberoId) return;
    loadReservas();
  }, [barberoId, loadReservas]);

  async function handleCompletar(reservaId) {
    setCompletando(reservaId);

    // Marcar reserva como completada
    await supabase.from('reservas').update({ estado: 'completada' }).eq('id', reservaId);

    // Agregar sello de fidelización (si la barbería tiene programa activo)
    try {
      const { data: stampResult } = await supabase.rpc('add_loyalty_stamp', {
        p_reserva_id: reservaId,
      });
      if (stampResult?.ok && stampResult?.completado) {
        Alert.alert(
          '🎉 ¡Tarjeta completada!',
          `El cliente completó su tarjeta de fidelización.\nBeneficio: ${stampResult.beneficio}`
        );
      }
    } catch (_) {
      // Si la función no existe todavía, ignorar silenciosamente
    }

    setReservas((prev) =>
      prev.map((r) => (r.id === reservaId ? { ...r, estado: 'completada' } : r))
    );
    setCompletando(null);
  }

  const byTime = useMemo(() => {
    const m = new Map();
    for (const r of reservas) {
      const slot = normalizeHora(r.hora);
      const list = m.get(slot) ?? [];
      list.push(r);
      m.set(slot, list);
    }
    return m;
  }, [reservas]);

  const sorted = useMemo(
    () => [...reservas].sort((a, b) => parseTimeToMin(a.hora) - parseTimeToMin(b.hora)),
    [reservas]
  );

  const isToday = useMemo(() => toISODate(new Date()) === dateStr, [dateStr]);

  const labelDay = useMemo(() => {
    const raw = day.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [day]);

  function shiftDay(delta) {
    setDay((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + delta);
      return n;
    });
  }

  function goToday() {
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    setDay(t);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.acid} size="large" />
        <Text style={styles.loadTxt}>CARGANDO...</Text>
      </View>
    );
  }

  if (authError) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.muted}>No tienes acceso a este panel.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dayTitle}>{labelDay}</Text>
            {isToday ? (
              <View style={styles.hoy}>
                <Text style={styles.hoyTxt}>HOY</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.navDay}>
            <TouchableOpacity style={styles.navBtn} onPress={() => shiftDay(-1)}>
              <Text style={styles.navBtnTxt}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navBtn, isToday && { opacity: 0.4 }]}
              onPress={goToday}
              disabled={isToday}
            >
              <Text style={styles.navBtnTxt}>HOY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => shiftDay(1)}>
              <Text style={styles.navBtnTxt}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loadErr ? <Text style={styles.err}>{loadErr}</Text> : null}

        <Text style={styles.section}>CITAS DEL DÍA ({sorted.length})</Text>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>Sin citas para este día.</Text>
        ) : (
          sorted.map((r) => {
            const p = profiles[r.cliente_id];
            const name = p?.nombre?.trim() || 'Cliente';
            const completada = r.estado === 'completada';
            const cancelada = r.estado === 'cancelada';
            return (
              <View
                key={r.id}
                style={[styles.card, completada && styles.cardOk, cancelada && { opacity: 0.45 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.meta}>
                    {normalizeHora(r.hora)}
                    {p?.telefono ? ` · ${p.telefono}` : ''}
                    {r.precio != null ? ` · $${r.precio.toLocaleString('es-CO')}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.estado}>{r.estado ?? 'pendiente'}</Text>
                  {!completada && !cancelada && (
                    <TouchableOpacity
                      style={styles.compBtn}
                      onPress={() => handleCompletar(r.id)}
                      disabled={completando === r.id}
                    >
                      <Text style={styles.compTxt}>{completando === r.id ? '...' : 'COMPLETAR'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        <Text style={[styles.section, { marginTop: 28 }]}>VISTA HORARIA · 09:00 – 20:00</Text>
        <View style={styles.grid}>
          {DAY_SLOTS.map((slot) => {
            const booked = byTime.get(slot) ?? [];
            const has = booked.length > 0;
            return (
              <View key={slot} style={styles.slotRow}>
                <Text style={[styles.slotTime, has && { color: colors.acid, fontFamily: fonts.bodyBold }]}>
                  {slot}
                </Text>
                <View style={[styles.slotCell, has && { backgroundColor: 'rgba(205,255,0,0.06)' }]}>
                  {has ? (
                    booked.map((r) => (
                      <Text key={r.id} style={styles.slotName}>
                        {profiles[r.cliente_id]?.nombre?.trim() || 'Cliente'}
                        {r.precio != null ? (
                          <Text style={{ color: colors.acid }}>
                            {' '}
                            ${r.precio.toLocaleString('es-CO')}
                          </Text>
                        ) : null}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.libre}>libre</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  loadTxt: {
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 3,
    color: colors.acid,
    marginTop: 12,
  },
  muted: { color: colors.grayLight, fontFamily: fonts.body, padding: 24 },
  scroll: { padding: 20, paddingBottom: 48 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  dayTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.white, letterSpacing: 1 },
  hoy: {
    alignSelf: 'flex-start',
    backgroundColor: colors.acid,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 8,
  },
  hoyTxt: { fontFamily: fonts.display, fontSize: 11, color: colors.black, letterSpacing: 2 },
  navDay: { flexDirection: 'row', gap: 6 },
  navBtn: {
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.dark2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  navBtnTxt: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 12 },
  err: { color: colors.danger, marginBottom: 12, fontFamily: fonts.body },
  section: {
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.acid,
    marginBottom: 12,
  },
  empty: { fontFamily: fonts.body, color: colors.grayMid, marginBottom: 16 },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.dark2,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  cardOk: { borderColor: 'rgba(205,255,0,0.35)', backgroundColor: 'rgba(205,255,0,0.05)' },
  name: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.grayLight, marginTop: 4 },
  estado: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.grayLight,
    textTransform: 'uppercase',
  },
  compBtn: { backgroundColor: colors.acid, paddingHorizontal: 10, paddingVertical: 4 },
  compTxt: { fontFamily: fonts.display, fontSize: 11, color: colors.black, letterSpacing: 1 },
  grid: { borderWidth: 1, borderColor: colors.gray, backgroundColor: colors.dark2 },
  slotRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  slotTime: {
    width: 56,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.grayMid,
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.black,
  },
  slotCell: { flex: 1, padding: 8, justifyContent: 'center' },
  slotName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
  libre: { fontFamily: fonts.body, fontSize: 11, color: '#444' },
});

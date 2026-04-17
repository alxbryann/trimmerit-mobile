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
import ReservaActionsCard from '../components/ReservaActionsCard';
import SolicitudPopup from '../components/SolicitudPopup';
import {
  notifCancelacionAlCliente,
  notifAplazamientoAlCliente,
} from '../lib/notifications';

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
  const [barberiaNombre, setBarberiaNombre] = useState('');

  const [day, setDay] = useState(() => {
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    return t;
  });

  const dateStr = useMemo(() => toISODate(day), [day]);
  const [reservas, setReservas] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loadErr, setLoadErr] = useState(null);
  const [tienePrograma, setTienePrograma] = useState(false);

  // Cola de notificaciones para el barbero (respuestas del cliente + acciones del cliente)
  const [solicitudQueue, setSolicitudQueue] = useState([]);
  const solicitudPendiente = solicitudQueue[0] ?? null;

  // ─── Carga de reservas del día ─────────────────────────────────────────────
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

  // ─── Verificar si tiene programa de fidelización activo ───────────────────
  const checkPrograma = useCallback(async (bId) => {
    const { data } = await supabase
      .from('loyalty_programs')
      .select('id')
      .eq('barbero_id', bId)
      .eq('activo', true)
      .maybeSingle();
    setTienePrograma(Boolean(data));
  }, []);

  // ─── Verificar solicitudes pendientes de lectura para el barbero ──────────
  const checkSolicitudesBarbero = useCallback(async (bId) => {
    const { data } = await supabase
      .from('reserva_solicitudes')
      .select('*')
      .eq('barbero_id', bId)
      .eq('leido_barbero', false)
      .order('updated_at', { ascending: true });
    if (data?.length) {
      // Solo incluir las que tienen estado final (no las pendientes de respuesta del cliente)
      const visibles = data.filter(
        (s) => s.estado === 'aceptado' || s.estado === 'rechazado'
      );
      if (visibles.length) setSolicitudQueue(visibles);
    }
  }, []);

  // ─── Auth + init ───────────────────────────────────────────────────────────
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
        .select('id, slug, nombre_barberia')
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
      setBarberiaNombre(barbero.nombre_barberia || '');
      setLoading(false);
    })();
  }, [slug, navigation]);

  useEffect(() => {
    if (!barberoId) return;
    loadReservas();
    checkPrograma(barberoId);
    checkSolicitudesBarbero(barberoId);
  }, [barberoId, loadReservas, checkPrograma, checkSolicitudesBarbero]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleCompletarReserva(reservaId, sellarFidelizacion) {
    await supabase.from('reservas').update({ estado: 'completada' }).eq('id', reservaId);

    if (sellarFidelizacion && tienePrograma) {
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
        // ignorar si el RPC no existe aún
      }
    }

    setReservas((prev) =>
      prev.map((r) => (r.id === reservaId ? { ...r, estado: 'completada' } : r))
    );
  }

  async function handleCancelarReserva(reservaId, razon) {
    const { data, error } = await supabase.rpc('cancelar_reserva', {
      p_reserva_id: reservaId,
      p_razon: razon,
    });

    if (error || !data?.ok) {
      Alert.alert('Error', error?.message || 'No se pudo cancelar la reserva.');
      return;
    }

    // Notificación local (actúa como simulación de push al cliente)
    await notifCancelacionAlCliente(barberiaNombre || 'La barbería');

    setReservas((prev) =>
      prev.map((r) => (r.id === reservaId ? { ...r, estado: 'cancelada' } : r))
    );
  }

  async function handleAplazarReserva(reservaId, razon, nuevaFecha, nuevaHora) {
    const { data, error } = await supabase.rpc('proponer_aplazamiento', {
      p_reserva_id: reservaId,
      p_razon: razon,
      p_nueva_fecha: nuevaFecha,
      p_nueva_hora: nuevaHora,
    });

    if (error || !data?.ok) {
      Alert.alert('Error', error?.message || 'No se pudo enviar la propuesta.');
      return;
    }

    // Notificación local simulando push al cliente
    const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const MON_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const [y, m, d] = nuevaFecha.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const fechaLabel = `${DAY_NAMES[dateObj.getDay()]} ${d} de ${MON_NAMES[m - 1]}`;
    await notifAplazamientoAlCliente(barberiaNombre || 'La barbería', fechaLabel, nuevaHora);

    setReservas((prev) =>
      prev.map((r) => (r.id === reservaId ? { ...r, estado: 'aplazamiento_pendiente' } : r))
    );
  }

  async function handlePopupClose() {
    if (solicitudPendiente) {
      await supabase
        .from('reserva_solicitudes')
        .update({ leido_barbero: true })
        .eq('id', solicitudPendiente.id);
    }
    setSolicitudQueue((prev) => prev.slice(1));
  }

  // ─── Derived state ─────────────────────────────────────────────────────────
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

  // ─── Render guards ─────────────────────────────────────────────────────────
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

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Cabecera con navegación de día */}
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

        {/* Lista de citas */}
        <Text style={styles.section}>CITAS DEL DÍA ({sorted.length})</Text>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>Sin citas para este día.</Text>
        ) : (
          sorted.map((r) => {
            const perfil = profiles[r.cliente_id] ?? null;
            return (
              <ReservaActionsCard
                key={r.id}
                reserva={r}
                perfil={perfil}
                tienePrograma={tienePrograma}
                onCompletar={handleCompletarReserva}
                onCancelar={handleCancelarReserva}
                onAplazar={handleAplazarReserva}
              />
            );
          })
        )}

        {/* Vista horaria de slots */}
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

      {/* Popup para cuando un cliente respondió a un aplazamiento propuesto por el barbero */}
      {solicitudPendiente && (
        <SolicitudPopup
          solicitud={solicitudPendiente}
          role="barbero"
          onClose={handlePopupClose}
        />
      )}
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

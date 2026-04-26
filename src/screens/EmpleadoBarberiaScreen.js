import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import * as Notifications from 'expo-notifications';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { fonts } from '../theme';
import { useColors } from '../theme/ThemeContext';
import ReservaActionsCard from '../components/ReservaActionsCard';
import { sendPushNotification } from '../lib/notifications';

const SLOT_START = 9 * 60;
const SLOT_END = 20 * 60;
const STEP = 30;

function pad2(n) { return String(n).padStart(2, '0'); }
function toISODate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
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

export default function EmpleadoBarberiaScreen({ navigation, route }) {
  const colors = useColors();
  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.black },
    center: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
    loadTxt: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 3, color: colors.acid, marginTop: 12 },
    muted: { color: colors.grayLight, fontFamily: fonts.body, padding: 24 },
    scroll: { padding: 20, paddingBottom: 48 },
  
    barberiaHeader: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    barberiaName: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 1 },
    barberiaNameAcid: { color: colors.acid },
    agendaLabel: { color: colors.white },
  
    head: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
    dayTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.white, letterSpacing: 1 },
    hoy: { alignSelf: 'flex-start', backgroundColor: colors.acid, paddingHorizontal: 8, paddingVertical: 2, marginTop: 8 },
    hoyTxt: { fontFamily: fonts.display, fontSize: 11, color: colors.black, letterSpacing: 2 },
    navDay: { flexDirection: 'row', gap: 6 },
    navBtn: { borderWidth: 1, borderColor: colors.gray, backgroundColor: colors.dark2, paddingHorizontal: 10, paddingVertical: 8 },
    navBtnTxt: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 12 },
    err: { color: colors.danger, marginBottom: 12, fontFamily: fonts.body },
    section: { fontFamily: fonts.display, fontSize: 14, letterSpacing: 2, color: colors.acid, marginBottom: 12 },
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
    estado: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1, color: colors.grayLight, textTransform: 'uppercase' },
    compBtn: { backgroundColor: colors.acid, paddingHorizontal: 10, paddingVertical: 4 },
    compTxt: { fontFamily: fonts.display, fontSize: 11, color: colors.black, letterSpacing: 1 },
    grid: { borderWidth: 1, borderColor: colors.gray, backgroundColor: colors.dark2 },
    slotRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
    slotTime: {
      width: 56, fontFamily: fonts.body, fontSize: 11, color: colors.grayMid,
      padding: 10, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)',
      backgroundColor: colors.black,
    },
    slotCell: { flex: 1, padding: 8, justifyContent: 'center' },
    slotName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
    libre: { fontFamily: fonts.body, fontSize: 11, color: '#444' },
  
    partNote: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.grayMid,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 24,
    },
  });

  const paramBarberiaId = route.params?.barberiaId;
  const paramBarberiaName = route.params?.barberiaName;

  const [loading, setLoading] = useState(true);
  const [barberoId, setBarberoId] = useState(null);
  const [barberiaName, setBarberiaName] = useState(paramBarberiaName ?? '');
  const [authError, setAuthError] = useState(false);

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

  const loadReservas = useCallback(async () => {
    if (!barberoId) return;
    setLoadErr(null);
    const { data, error } = await supabase
      .from('reservas')
      .select('id, fecha, hora, precio, estado, cliente_id')
      .eq('barbero_id', barberoId)
      .eq('fecha', dateStr)
      .order('hora', { ascending: true });
    if (error) { setLoadErr(error.message); setReservas([]); return; }
    const rows = data ?? [];
    setReservas(rows);
    const ids = [...new Set(rows.map((r) => r.cliente_id))];
    if (ids.length === 0) { setProfiles({}); return; }
    const { data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('id, nombre, telefono')
      .in('id', ids);
    if (pErr) { setLoadErr(pErr.message); return; }
    const map = {};
    for (const p of profs ?? []) map[p.id] = p;
    setProfiles(map);
  }, [barberoId, dateStr]);

  const checkPrograma = useCallback(async (bId) => {
    const { data } = await supabase
      .from('loyalty_programs')
      .select('id')
      .eq('barbero_id', bId)
      .eq('activo', true)
      .maybeSingle();
    setTienePrograma(Boolean(data));
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigation.replace('Login'); return; }
      const { data: barbero, error } = await supabase
        .from('barberos')
        .select('id, barberia_id')
        .eq('id', user.id)
        .maybeSingle();
      if (error || !barbero) { setAuthError(true); setLoading(false); return; }
      setBarberoId(barbero.id);
      // Fetch barberia name if not passed
      if (!barberiaName && barbero.barberia_id) {
        const { data: b } = await supabase
          .from('barberias')
          .select('nombre')
          .eq('id', barbero.barberia_id)
          .maybeSingle();
        if (b?.nombre) setBarberiaName(b.nombre);
      }
      setLoading(false);
    })();
  }, [navigation, barberiaName]);

  useFocusEffect(
    useCallback(() => {
      if (!barberoId) return;
      loadReservas();
      checkPrograma(barberoId);
    }, [barberoId, loadReservas, checkPrograma])
  );

  // Reload agenda when a push notification arrives (new booking)
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      loadReservas();
    });
    return () => sub.remove();
  }, [loadReservas]);

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
        // Ignorar si el RPC aún no existe.
      }
    }

    setReservas((prev) => prev.map((r) => (r.id === reservaId ? { ...r, estado: 'completada' } : r)));
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

    const reserva = reservas.find((r) => r.id === reservaId);
    let pushToken = reserva?.cliente_id ? profiles[reserva.cliente_id]?.push_token : null;

    if (!pushToken && reserva?.cliente_id) {
      const { data: clienteProfile } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', reserva.cliente_id)
        .maybeSingle();
      pushToken = clienteProfile?.push_token ?? null;
    }

    if (pushToken) {
      const profesionalNombre = barberiaName || 'Tu barbero';
      const razonCancelacion = razon?.trim();
      await sendPushNotification({
        to: pushToken,
        title: `❌ Reserva cancelada por ${profesionalNombre}`,
        body: razonCancelacion
          ? `${profesionalNombre} canceló tu cita. Razón: ${razonCancelacion}`
          : `${profesionalNombre} canceló tu cita. Abre la app para más detalles.`,
        data: { tipo: 'cancelacion', reservaId, razon: razonCancelacion },
      });
    }

    setReservas((prev) => prev.map((r) => (r.id === reservaId ? { ...r, estado: 'cancelada' } : r)));
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

    const reserva = reservas.find((r) => r.id === reservaId);
    let pushToken = reserva?.cliente_id ? profiles[reserva.cliente_id]?.push_token : null;
    if (!pushToken && reserva?.cliente_id) {
      const { data: clienteProfile } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', reserva.cliente_id)
        .maybeSingle();
      pushToken = clienteProfile?.push_token ?? null;
    }

    if (pushToken) {
      const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const MON_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const [y, m, d] = nuevaFecha.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const fechaLabel = `${DAY_NAMES[dateObj.getDay()]} ${d} de ${MON_NAMES[m - 1]}`;
      await sendPushNotification({
        to: pushToken,
        title: '📅 Propuesta de cambio de fecha',
        body: `${barberiaName || 'Tu barbero'} propone mover tu cita al ${fechaLabel} a las ${nuevaHora}.`,
        data: { tipo: 'aplazamiento', reservaId },
      });
    }

    setReservas((prev) =>
      prev.map((r) => (r.id === reservaId ? { ...r, estado: 'aplazamiento_pendiente' } : r))
    );
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
    setDay((d) => { const n = new Date(d); n.setDate(n.getDate() + delta); return n; });
  }
  function goToday() {
    const t = new Date(); t.setHours(12, 0, 0, 0); setDay(t);
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
      {/* Barbería header */}
      <View style={styles.barberiaHeader}>
        <Text style={styles.barberiaName} numberOfLines={1}>
          <Text style={styles.barberiaNameAcid}>{barberiaName}</Text>
          <Text style={styles.agendaLabel}> — MI AGENDA</Text>
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dayTitle}>{labelDay}</Text>
            {isToday ? (
              <View style={styles.hoy}><Text style={styles.hoyTxt}>HOY</Text></View>
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
            return (
              <ReservaActionsCard
                key={r.id}
                reserva={r}
                perfil={p ?? null}
                tienePrograma={tienePrograma}
                onCompletar={handleCompletarReserva}
                onCancelar={handleCancelarReserva}
                onAplazar={handleAplazarReserva}
              />
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
                          <Text style={{ color: colors.acid }}> ${r.precio.toLocaleString('es-CO')}</Text>
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

        {/* Bottom note */}
        {barberiaName ? (
          <Text style={styles.partNote}>Parte de {barberiaName}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}


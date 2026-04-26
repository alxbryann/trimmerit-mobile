import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { fonts } from '../theme';
import { useColors } from '../theme/ThemeContext';
import { fmtPrice, resolveLocalDisplayName } from '../utils/booking';
import ClienteReservaCard from '../components/ClienteReservaCard';
import { sendPushNotification } from '../lib/notifications';

function fmtFecha(ymd) {
  if (!ymd || typeof ymd !== 'string') return '—';
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${String(d).padStart(2, '0')} ${months[m - 1] ?? ''} ${y}`;
}

function estadoLabel(estado) {
  const e = (estado ?? '').toLowerCase();
  if (e === 'pendiente')             return 'CONFIRMADA';
  if (e === 'aplazamiento_pendiente') return 'CAMBIO PROPUESTO';
  if (e === 'completada')            return 'COMPLETADA';
  if (e === 'cancelada')             return 'CANCELADA';
  return (estado ?? '—').toUpperCase();
}

function cmpFechaAsc(a, b) {
  return `${a.fecha ?? ''} ${a.hora ?? ''}`.localeCompare(`${b.fecha ?? ''} ${b.hora ?? ''}`);
}

const PENDIENTES_ESTADOS = new Set(['pendiente', 'aplazamiento_pendiente']);

export default function AgendaScreen({ navigation }) {
  const colors = useColors();
  const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    marginBottom: 4,
  },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.champagne,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 48,
    lineHeight: 46,
    color: colors.paper,
    letterSpacing: -1,
  },

  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 10, paddingTop: 14 },
  emptyScroll: { paddingHorizontal: 20, paddingTop: 24, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, lineHeight: 22 },
  err: { fontFamily: fonts.body, color: colors.terracota, fontSize: 14 },
  emptyBlock: { gap: 12, paddingTop: 8 },
  linkBtn: { alignSelf: 'flex-start' },
  linkText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.champagne },

  primaryOutline: {
    borderWidth: 1,
    borderColor: colors.champagne,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  primaryOutlineText: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 16,
    color: colors.champagne,
    letterSpacing: -0.5,
  },

  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 10,
  },
  emptySection: { fontFamily: fonts.body, fontSize: 13, color: colors.muted2, marginBottom: 4 },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 4,
  },
  cardDateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardDate: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.champagne },
  cardTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 22,
    color: colors.paper,
    letterSpacing: -0.5,
  },
  cardBarbero: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  precio: { fontFamily: fonts.mono, fontSize: 13, color: colors.champagne, marginTop: 4 },

  rateCta: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.champagne,
  },
  rateCtaText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.champagne,
    textTransform: 'uppercase',
  },

  badge: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 2, color: colors.ink },
  badgePending:  { backgroundColor: colors.champagne },
  badgeOk:       { backgroundColor: colors.olivo },
  badgeCanceled: { backgroundColor: colors.muted2 },
  badgeAplaz:    { backgroundColor: '#60a5fa' },
});
  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);
  /** Reservas completadas sin fila en `reseñas` (el cliente aún no calificó). */
  const [sinResenaIds, setSinResenaIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!silent) setLoading(true);
    if (!supabaseConfigured) {
      setErr('Configura Supabase.');
      setRows([]);
      if (!silent) setLoading(false);
      return;
    }
    setErr(null);
    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s);
    if (!s?.user) {
      setRows([]);
      setSinResenaIds(new Set());
      if (!silent) setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('reservas')
      .select(
        'id, fecha, hora, precio, estado, barbero_id, barberos ( nombre_barberia, slug, barberia_id, barberias ( nombre ), profiles ( nombre, push_token ) )',
      )
      .eq('cliente_id', s.user.id)
      .order('fecha', { ascending: true });

    if (error) {
      setErr(error.message);
      setRows([]);
      setSinResenaIds(new Set());
    } else {
      const list = data ?? [];
      list.sort(cmpFechaAsc);
      setRows(list);
      const completedIds = list
        .filter((r) => (r.estado ?? '').toLowerCase() === 'completada')
        .map((r) => r.id);
      if (completedIds.length === 0) {
        setSinResenaIds(new Set());
      } else {
        const { data: revRows } = await supabase
          .from('reseñas')
          .select('reserva_id')
          .in('reserva_id', completedIds);
        const conResena = new Set((revRows ?? []).map((x) => x.reserva_id));
        setSinResenaIds(new Set(completedIds.filter((id) => !conResena.has(id))));
      }
    }
    if (!silent) setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => { setLoading(true); load(); });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }

  async function handleCancelarCliente(reservaId) {
    const { data, error } = await supabase.rpc('cancelar_reserva_cliente', { p_reserva_id: reservaId });
    if (error || !data?.ok) return;
    const nombreCliente = session?.user?.user_metadata?.nombre ?? session?.user?.email ?? 'El cliente';
    const reserva = rows.find((r) => r.id === reservaId);
    const pushToken = reserva?.barberos?.profiles?.push_token ?? null;
    if (pushToken) {
      await sendPushNotification({
        to: pushToken,
        title: '❌ Cita cancelada por el cliente',
        body: `${nombreCliente} canceló su cita del ${reserva?.fecha ?? ''}.`,
        data: { tipo: 'cancelacion_cliente', reservaId },
      });
    }
    load({ silent: true });
  }

  async function handleCambiarCliente(reservaId, nuevaFecha, nuevaHora) {
    const { data, error } = await supabase.rpc('cambiar_reserva_cliente', {
      p_reserva_id: reservaId, p_nueva_fecha: nuevaFecha, p_nueva_hora: nuevaHora,
    });
    if (error || !data?.ok) return;
    const nombreCliente = session?.user?.user_metadata?.nombre ?? session?.user?.email ?? 'El cliente';
    const reserva = rows.find((r) => r.id === reservaId);
    const pushToken = reserva?.barberos?.profiles?.push_token ?? null;
    const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const MON_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const [y, m, d] = nuevaFecha.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const fechaLabel = `${DAY_NAMES[dateObj.getDay()]} ${d} de ${MON_NAMES[m - 1]}`;
    if (pushToken) {
      await sendPushNotification({
        to: pushToken,
        title: '📅 Cliente reprogramó su cita',
        body: `${nombreCliente} cambió su cita al ${fechaLabel} a las ${nuevaHora}.`,
        data: { tipo: 'cambio_cliente', reservaId },
      });
    }
    load({ silent: true });
  }

  function estadoBadgeStyle(estado) {
    const e = (estado ?? '').toLowerCase();
    if (e === 'completada') return styles.badgeOk;
    if (e === 'cancelada')  return styles.badgeCanceled;
    if (e === 'aplazamiento_pendiente') return styles.badgeAplaz;
    return styles.badgePending;
  }

  function renderCard(r, opts = {}) {
    const { showCalificar = false } = opts;
    const b = r.barberos;
    const nombreBarberia = resolveLocalDisplayName(b, { fallback: b?.profiles?.nombre });
    const nombreBarbero  = b?.profiles?.nombre?.trim() || null;
    const slug = b?.slug?.trim() || null;
    const badgeStyle = estadoBadgeStyle(r.estado);
    return (
      <View key={r.id} style={styles.card}>
        <View style={styles.cardDateRow}>
          <Text style={styles.cardDate}>{fmtFecha(r.fecha)} · {r.hora ?? '—'}</Text>
          <View style={[styles.badge, badgeStyle]}>
            <Text style={styles.badgeText}>{estadoLabel(r.estado)}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>{nombreBarberia}</Text>
        {nombreBarbero && <Text style={styles.cardBarbero}>con {nombreBarbero}</Text>}
        {r.precio != null && Number.isFinite(Number(r.precio)) && (
          <Text style={styles.precio}>${fmtPrice(Number(r.precio))}</Text>
        )}
        {showCalificar && slug ? (
          <TouchableOpacity
            style={styles.rateCta}
            onPress={() => navigation.navigate('BarberProfile', { slug })}
            activeOpacity={0.88}
          >
            <Text style={styles.rateCtaText}>Calificar visita →</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>— tus citas —</Text>
            <Text style={styles.title}>agenda.</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.champagne} />
          </View>
        ) : !session?.user ? (
          <ScrollView contentContainerStyle={styles.emptyScroll}>
            <Text style={styles.muted}>Inicia sesión para ver tus reservas.</Text>
            <TouchableOpacity style={styles.primaryOutline} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.primaryOutlineText}>iniciar sesión →</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.champagne} />}
            showsVerticalScrollIndicator={false}
          >
            {err ? (
              <Text style={styles.err}>{err}</Text>
            ) : rows.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.muted}>Aún no tienes reservas.</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Catalogo')} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Ir al catálogo Trimmerit →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              (() => {
                const pendientes  = rows.filter((r) =>  PENDIENTES_ESTADOS.has((r.estado ?? '').toLowerCase()));
                const anteriores = rows
                  .filter((r) => !PENDIENTES_ESTADOS.has((r.estado ?? '').toLowerCase()))
                  .sort((a, b) => cmpFechaAsc(b, a));

                return (
                  <>
                    <Text style={styles.sectionLabel}>i · pendientes</Text>
                    {pendientes.length === 0 ? (
                      <Text style={styles.emptySection}>Sin citas próximas.</Text>
                    ) : (
                      pendientes.map((r) => {
                        const b = r.barberos;
                        const barberiaNombre = resolveLocalDisplayName(b, { fallback: b?.profiles?.nombre });
                        const barberoNombre  = b?.profiles?.nombre?.trim() || null;
                        if ((r.estado ?? '').toLowerCase() === 'pendiente') {
                          return (
                            <ClienteReservaCard
                              key={r.id}
                              reserva={r}
                              barberiaNombre={barberiaNombre}
                              barberoNombre={barberoNombre}
                              onCancelar={handleCancelarCliente}
                              onCambiar={handleCambiarCliente}
                            />
                          );
                        }
                        return renderCard(r);
                      })
                    )}

                    <Text style={[styles.sectionLabel, { marginTop: 24 }]}>ii · anteriores</Text>
                    {anteriores.length === 0 ? (
                      <Text style={styles.emptySection}>Sin citas anteriores.</Text>
                    ) : (
                      anteriores.map((r) => {
                        const puede =
                          (r.estado ?? '').toLowerCase() === 'completada' && sinResenaIds.has(r.id);
                        return renderCard(r, { showCalificar: puede });
                      })
                    )}
                  </>
                );
              })()
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

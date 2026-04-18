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
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts, radii } from '../theme';
import { fmtPrice } from '../utils/booking';
import ClienteReservaCard from '../components/ClienteReservaCard';
import {
  notifCancelacionAlBarbero,
  notifCambioAlBarbero,
} from '../lib/notifications';

function fmtFecha(ymd) {
  if (!ymd || typeof ymd !== 'string') return '—';
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${String(d).padStart(2, '0')} ${months[m - 1] ?? ''} ${y}`;
}

function estadoLabel(estado) {
  const e = (estado ?? '').toLowerCase();
  if (e === 'pendiente')             return 'PENDIENTE';
  if (e === 'aplazamiento_pendiente') return 'CAMBIO PROPUESTO';
  if (e === 'completada')            return 'COMPLETADA';
  if (e === 'cancelada')             return 'CANCELADA';
  return (estado ?? '—').toUpperCase();
}

function cmpFechaAsc(a, b) {
  const fa = `${a.fecha ?? ''} ${a.hora ?? ''}`;
  const fb = `${b.fecha ?? ''} ${b.hora ?? ''}`;
  return fa.localeCompare(fb);
}

const PENDIENTES_ESTADOS = new Set(['pendiente', 'aplazamiento_pendiente']);

export default function AgendaScreen({ navigation }) {
  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);
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
      if (!silent) setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('reservas')
      .select('id, fecha, hora, precio, estado, barberos ( nombre_barberia, slug, profiles ( nombre ) )')
      .eq('cliente_id', s.user.id)
      .order('fecha', { ascending: true });
    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      const list = data ?? [];
      list.sort(cmpFechaAsc);
      setRows(list);
    }

    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }

  // ─── Acciones propias del cliente sobre sus reservas ──────────────────────

  async function handleCancelarCliente(reservaId) {
    const { data, error } = await supabase.rpc('cancelar_reserva_cliente', {
      p_reserva_id: reservaId,
    });
    if (error || !data?.ok) return;

    // Buscar nombre del cliente para la notificación
    const nombreCliente = session?.user?.user_metadata?.nombre
      ?? session?.user?.email
      ?? 'El cliente';
    // Buscar fecha de la reserva para el mensaje
    const reserva = rows.find((r) => r.id === reservaId);
    const fechaLabel = reserva?.fecha ?? '';
    await notifCancelacionAlBarbero(nombreCliente, fechaLabel);

    load({ silent: true });
  }

  async function handleCambiarCliente(reservaId, nuevaFecha, nuevaHora) {
    const { data, error } = await supabase.rpc('cambiar_reserva_cliente', {
      p_reserva_id: reservaId,
      p_nueva_fecha: nuevaFecha,
      p_nueva_hora: nuevaHora,
    });
    if (error || !data?.ok) return;

    const nombreCliente = session?.user?.user_metadata?.nombre
      ?? session?.user?.email
      ?? 'El cliente';

    const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const MON_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const [y, m, d] = nuevaFecha.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const fechaLabel = `${DAY_NAMES[dateObj.getDay()]} ${d} de ${MON_NAMES[m - 1]}`;
    await notifCambioAlBarbero(nombreCliente, fechaLabel, nuevaHora);

    load({ silent: true });
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0d0f08', '#080808']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>Tus citas</Text>
            <Text style={styles.title}>AGENDA</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('ClientePerfil')}
            style={styles.cuentaBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.cuentaText}>CUENTA</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.acid} />
          </View>
        ) : !session?.user ? (
          <ScrollView contentContainerStyle={styles.emptyScroll}>
            <Text style={styles.muted}>
              Inicia sesión para ver tus reservas y tu agenda de citas.
            </Text>
            <TouchableOpacity
              style={styles.primaryOutline}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.primaryOutlineText}>INICIAR SESIÓN</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.acid} />
            }
            showsVerticalScrollIndicator={false}
          >
            {err ? (
              <Text style={styles.err}>{err}</Text>
            ) : rows.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.muted}>Aún no tienes reservas.</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Catalogo')} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Ir al catálogo de barberos →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              (() => {
                const pendientes  = rows.filter((r) =>  PENDIENTES_ESTADOS.has((r.estado ?? '').toLowerCase()));
                const citasPasadas = rows
                  .filter((r) => !PENDIENTES_ESTADOS.has((r.estado ?? '').toLowerCase()))
                  .sort((a, b) => cmpFechaAsc(b, a)); // más reciente primero

                function renderCard(r) {
                  const b = r.barberos;
                  const nombreBarberia = b?.nombre_barberia?.trim() || b?.slug?.replace(/-/g, ' ') || 'Barbería';
                  const nombreBarbero  = b?.profiles?.nombre?.trim() || null;
                  const estado = (r.estado ?? '').toLowerCase();
                  const badgeStyle =
                    estado === 'completada'
                      ? styles.badgeOk
                      : estado === 'cancelada'
                        ? styles.badgeMuted
                        : estado === 'aplazamiento_pendiente'
                          ? styles.badgeAplazamiento
                          : styles.badgePending;
                  const badgeTxtStyle =
                    estado === 'cancelada' ? styles.badgeTextOnDark : styles.badgeText;
                  return (
                    <View key={r.id} style={styles.card}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{nombreBarberia.toUpperCase()}</Text>
                      {nombreBarbero ? (
                        <Text style={styles.cardBarbero}>por {nombreBarbero}</Text>
                      ) : null}
                      <Text style={styles.cardMeta}>
                        {fmtFecha(r.fecha)} · {r.hora ?? '—'}
                      </Text>
                      {r.precio != null && Number.isFinite(Number(r.precio)) ? (
                        <Text style={styles.precio}>${fmtPrice(Number(r.precio))}</Text>
                      ) : null}
                      <View style={[styles.badge, badgeStyle]}>
                        <Text style={badgeTxtStyle}>{estadoLabel(r.estado)}</Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <>
                    {/* ── Sección pendientes (con acciones cancelar/cambiar) ── */}
                    <Text style={styles.sectionLabel}>PENDIENTES</Text>
                    {pendientes.length === 0 ? (
                      <Text style={styles.emptySection}>Sin citas próximas.</Text>
                    ) : (
                      pendientes.map((r) => {
                        const b = r.barberos;
                        const barberiaNombre = b?.nombre_barberia?.trim() || b?.slug?.replace(/-/g, ' ') || 'Barbería';
                        const barberoNombre  = b?.profiles?.nombre?.trim() || null;
                        const esPendiente = (r.estado ?? '').toLowerCase() === 'pendiente';

                        if (esPendiente) {
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
                        // aplazamiento_pendiente: mostrar card simple (acciones bloqueadas)
                        return renderCard(r);
                      })
                    )}

                    {/* ── Citas ya cerradas (completadas / canceladas / etc.) ── */}
                    <Text style={[styles.sectionLabel, { marginTop: 24 }]}>ANTERIORES</Text>
                    {citasPasadas.length === 0 ? (
                      <Text style={styles.emptySection}>Sin citas anteriores.</Text>
                    ) : (
                      citasPasadas.map(renderCard)
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  safe: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 12,
    marginBottom: 8,
  },
  kicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.grayMid,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 2,
    color: colors.white,
  },
  cuentaBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cuentaText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.acid,
  },
  scroll: { paddingHorizontal: 28, paddingBottom: 40, gap: 12 },
  emptyScroll: { paddingHorizontal: 28, paddingTop: 24, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.grayLight,
    lineHeight: 22,
  },
  err: { fontFamily: fonts.body, color: colors.danger, fontSize: 14 },
  emptyBlock: { gap: 12, paddingTop: 8 },
  linkBtn: { alignSelf: 'flex-start' },
  linkText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.acid, letterSpacing: 0.5 },
  primaryOutline: {
    borderWidth: 1,
    borderColor: colors.acid,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  primaryOutlineText: {
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.acid,
  },
  sectionLabel: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 2,
    color: colors.acid,
    marginBottom: 10,
  },
  emptySection: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.grayMid,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    padding: 16,
    gap: 5,
    marginBottom: 2,
  },
  cardTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.white, letterSpacing: 0.5 },
  cardBarbero: { fontFamily: fonts.body, fontSize: 12, color: colors.grayMid, marginTop: -2 },
  cardMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.grayLight },
  precio: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.acid },
  badge: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.xs },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.5, color: colors.black },
  badgeTextOnDark: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.5, color: colors.white },
  badgePending:      { backgroundColor: colors.acid },
  badgeOk:           { backgroundColor: 'rgba(120, 220, 120, 0.85)' },
  badgeMuted:        { backgroundColor: colors.grayMid },
  badgeAplazamiento: { backgroundColor: '#60a5fa' },
});

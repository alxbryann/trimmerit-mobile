import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, radii } from '../../theme';
import { useColors } from '../../theme/ThemeContext';
import { supabase } from '../../lib/supabase';
import StatsHeader from '../../components/stats/StatsHeader';
import PeriodFilter from '../../components/stats/PeriodFilter';
import BarChart from '../../components/stats/BarChart';
import DonutChart from '../../components/stats/DonutChart';
import Sparkline from '../../components/stats/Sparkline';
import {
  loadIngresosGastos,
  loadOcupacion,
  loadTicketPromedio,
  loadTopServicios,
  loadVentaProductos,
} from '../../api/stats';

const FALLBACK_FLUJO = [
  { label: 'Sem 1', ingresos: 0, gastos: 0 },
  { label: 'Sem 2', ingresos: 0, gastos: 0 },
  { label: 'Sem 3', ingresos: 0, gastos: 0 },
  { label: 'Sem 4', ingresos: 0, gastos: 0 },
];

export default function ResumenGeneralScreen({ navigation }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const [periodo, setPeriodo] = useState('mes');
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [barberiaId, setBarberiaId] = useState(null);

  const [flujo, setFlujo] = useState(FALLBACK_FLUJO);
  const [ocupacion, setOcupacion] = useState({ porcentaje: 0, deltaVsPrevio: 0 });
  const [ticket, setTicket] = useState({ promedio: 0, tendencia: [] });
  const [topServicios, setTopServicios] = useState([]);
  const [ventaProductos, setVentaProductos] = useState([]);

  // Cargar barbería del usuario
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setUnauthorized(true);
        return;
      }
      const { data: bria } = await supabase
        .from('barberias')
        .select('id')
        .eq('admin_id', user.id)
        .maybeSingle();
      if (!bria) {
        if (!cancelled) setUnauthorized(true);
        return;
      }
      if (!cancelled) setBarberiaId(bria.id);
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    if (!barberiaId) return;
    setLoading(true);
    try {
      const [f, o, t, ts, vp] = await Promise.all([
        loadIngresosGastos(barberiaId, periodo),
        loadOcupacion(barberiaId, periodo),
        loadTicketPromedio(barberiaId, periodo),
        loadTopServicios(barberiaId, periodo, 5),
        loadVentaProductos(barberiaId, periodo, 3),
      ]);
      setFlujo(f.length > 0 ? f : FALLBACK_FLUJO);
      setOcupacion(o);
      setTicket(t);
      setTopServicios(ts);
      setVentaProductos(vp);
    } catch (e) {
      console.warn('[ResumenGeneral]', e);
    } finally {
      setLoading(false);
    }
  }, [barberiaId, periodo]);

  useEffect(() => {
    if (barberiaId) refresh();
  }, [barberiaId, periodo, refresh]);

  if (unauthorized) {
    return (
      <View style={styles.center}>
        <Text style={styles.unauthorizedTxt}>No tienes acceso a este panel.</Text>
      </View>
    );
  }

  const totalIngresos = flujo.reduce((acc, b) => acc + b.ingresos, 0);
  const totalGastos = flujo.reduce((acc, b) => acc + b.gastos, 0);
  const sparkWidth = Dimensions.get('window').width - 80;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <StatsHeader
          navigation={navigation}
          title="Resumen General"
          subtitle="Monitorea el rendimiento de tu negocio en tiempo real."
        />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <PeriodFilter value={periodo} onChange={setPeriodo} />

          {loading ? (
            <ActivityIndicator color={colors.acid} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Flujo de Caja */}
              <Card>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Flujo de Caja</Text>
                    <Text style={styles.cardSub}>Ingresos vs Gastos operativos</Text>
                  </View>
                </View>
                <BarChart data={flujo} height={150} />
                <View style={styles.totalsRow}>
                  <View style={styles.totalCol}>
                    <Text style={styles.totalLabel}>INGRESOS TOTALES</Text>
                    <Text style={[styles.totalVal, { color: colors.acid }]}>
                      {formatMoney(totalIngresos)}
                    </Text>
                  </View>
                  <View style={styles.totalDivider} />
                  <View style={styles.totalCol}>
                    <Text style={styles.totalLabel}>GASTOS TOTALES</Text>
                    <Text style={[styles.totalVal, { color: colors.terracota ?? colors.danger }]}>
                      {formatMoney(totalGastos)}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Ocupación de Agenda */}
              <Card>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Ocupación de Agenda</Text>
                    <Text style={styles.cardSub}>Slots reservados vs disponibles</Text>
                  </View>
                </View>
                <View style={styles.donutRow}>
                  <DonutChart percentage={ocupacion.porcentaje} size={140} strokeWidth={14} />
                  <View style={styles.donutMeta}>
                    <Text style={styles.donutDeltaLabel}>VS PERIODO ANTERIOR</Text>
                    <Text
                      style={[
                        styles.donutDelta,
                        {
                          color: ocupacion.deltaVsPrevio >= 0
                            ? colors.acid
                            : (colors.terracota ?? colors.danger),
                        },
                      ]}
                    >
                      {ocupacion.deltaVsPrevio >= 0 ? '+' : ''}
                      {ocupacion.deltaVsPrevio}%
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Ticket Promedio */}
              <Card>
                <Text style={styles.miniLabel}>TICKET PROMEDIO</Text>
                <View style={styles.ticketRow}>
                  <Text style={styles.ticketVal}>{formatMoney(ticket.promedio)}</Text>
                  <Text style={styles.ticketUnit}>/ cliente</Text>
                </View>
                <View style={{ marginTop: 8 }}>
                  <Sparkline data={ticket.tendencia} width={sparkWidth} height={56} />
                </View>
              </Card>

              {/* Top Servicios */}
              <Section title="Top Servicios" actionLabel="Ver todos">
                {topServicios.length === 0 ? (
                  <EmptyRow text="Aún no hay servicios completados en este periodo." />
                ) : (
                  <View>
                    <View style={styles.tableHead}>
                      <Text style={[styles.thLabel, { flex: 2 }]}>SERVICIO</Text>
                      <Text style={[styles.thLabel, { width: 56, textAlign: 'right' }]}>CITAS</Text>
                      <Text style={[styles.thLabel, { flex: 1, textAlign: 'right' }]}>INGRESOS</Text>
                    </View>
                    {topServicios.map((s, i) => (
                      <View key={s.id} style={[styles.tableRow, i === topServicios.length - 1 && styles.tableRowLast]}>
                        <View style={styles.servicioCell}>
                          <View style={styles.servicioIcon}>
                            <Text style={styles.servicioIconTxt}>{s.icono ?? '✂'}</Text>
                          </View>
                          <Text style={styles.servicioName} numberOfLines={1}>{s.nombre}</Text>
                        </View>
                        <Text style={[styles.cellNum, { width: 56, textAlign: 'right' }]}>{s.citas}</Text>
                        <Text style={[styles.cellNumAcid, { flex: 1, textAlign: 'right' }]}>
                          {formatMoney(s.ingresos)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Section>

              {/* Venta de Productos */}
              <Section title="Venta de Productos" actionLabel="Inventario">
                {ventaProductos.length === 0 ? (
                  <EmptyRow text="No hay ventas de productos registradas en este periodo." />
                ) : (
                  <View>
                    <View style={styles.tableHead}>
                      <Text style={[styles.thLabel, { flex: 2 }]}>PRODUCTO</Text>
                      <Text style={[styles.thLabel, { width: 64, textAlign: 'right' }]}>UNIDADES</Text>
                      <Text style={[styles.thLabel, { width: 72, textAlign: 'right' }]}>TENDENCIA</Text>
                    </View>
                    {ventaProductos.map((p, i) => (
                      <View key={p.id} style={[styles.tableRow, i === ventaProductos.length - 1 && styles.tableRowLast]}>
                        <View style={styles.servicioCell}>
                          <View style={styles.productoIcon}>
                            <Text style={styles.servicioIconTxt}>◇</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.servicioName} numberOfLines={1}>{p.nombre}</Text>
                            {p.stock != null ? (
                              <Text style={[styles.miniLabel, { marginTop: 2 }]}>
                                Stock: {p.stock}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <Text style={[styles.cellNum, { width: 64, textAlign: 'right' }]}>{p.unidades}</Text>
                        <View style={{ width: 72, alignItems: 'flex-end' }}>
                          <TrendChip tendencia={p.tendencia} delta={p.deltaPct} colors={colors} />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Section>

              <View style={{ height: 24 }} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Card({ children }) {
  const colors = useColors();
  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.dark2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.md,
      padding: 18,
      marginBottom: 14,
    },
  });
  return <View style={styles.card}>{children}</View>;
}

function Section({ title, actionLabel, children }) {
  const colors = useColors();
  const styles = StyleSheet.create({
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 10,
    },
    title: {
      flex: 1,
      fontFamily: fonts.display,
      fontSize: 18,
      color: colors.white,
      letterSpacing: 0.5,
    },
    action: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.acid,
      letterSpacing: 1.5,
    },
    body: {
      backgroundColor: colors.dark2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.md,
      paddingVertical: 4,
      marginBottom: 14,
    },
  });
  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {actionLabel ? <Text style={styles.action}>{actionLabel.toUpperCase()}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

function EmptyRow({ text }) {
  const colors = useColors();
  return (
    <View style={{ paddingVertical: 28, paddingHorizontal: 18 }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.grayMid, textAlign: 'center' }}>
        {text}
      </Text>
    </View>
  );
}

function TrendChip({ tendencia, delta, colors }) {
  const isUp = tendencia === 'up';
  const isDown = tendencia === 'down';
  const tone = isUp ? colors.acid : isDown ? (colors.terracota ?? colors.danger) : colors.grayMid;
  const arrow = isUp ? '↑' : isDown ? '↓' : '–';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: tone,
        paddingVertical: 2,
        paddingHorizontal: 6,
      }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: tone }}>{arrow}</Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: tone }}>
        {delta > 0 ? '+' : ''}{delta}%
      </Text>
    </View>
  );
}

function formatMoney(n) {
  const v = Number(n ?? 0);
  return `$${Math.round(v).toLocaleString('es-CO')}`;
}

function makeStyles(colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.black },
    center: {
      flex: 1,
      backgroundColor: colors.black,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    unauthorizedTxt: {
      fontFamily: fonts.body,
      color: colors.grayMid,
      textAlign: 'center',
    },
    scroll: { padding: 20, paddingBottom: 48 },

    cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    cardTitle: {
      fontFamily: fonts.display,
      fontSize: 20,
      color: colors.white,
      letterSpacing: 0.5,
    },
    cardSub: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.grayMid,
      marginTop: 2,
    },
    miniLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 1.8,
      color: colors.grayMid,
    },

    totalsRow: {
      flexDirection: 'row',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    totalCol: { flex: 1 },
    totalDivider: { width: 1, backgroundColor: colors.cardBorder, marginHorizontal: 12 },
    totalLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 9,
      letterSpacing: 1.8,
      color: colors.grayMid,
      marginBottom: 4,
    },
    totalVal: {
      fontFamily: fonts.display,
      fontSize: 22,
      letterSpacing: 0.5,
    },

    donutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    donutMeta: { flex: 1, paddingLeft: 18 },
    donutDeltaLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 1.5,
      color: colors.grayMid,
      marginBottom: 4,
    },
    donutDelta: {
      fontFamily: fonts.display,
      fontSize: 28,
      letterSpacing: 0.5,
    },

    ticketRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
    ticketVal: {
      fontFamily: fonts.display,
      fontSize: 38,
      color: colors.white,
      letterSpacing: 0.5,
    },
    ticketUnit: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.grayMid,
    },

    tableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    thLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 9,
      letterSpacing: 1.8,
      color: colors.grayMid,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    tableRowLast: { borderBottomWidth: 0 },
    servicioCell: { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 },
    servicioIcon: {
      width: 30,
      height: 30,
      backgroundColor: colors.dark3,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    productoIcon: {
      width: 30,
      height: 30,
      backgroundColor: colors.acidSoft,
      borderWidth: 1,
      borderColor: colors.acidDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    servicioIconTxt: {
      fontFamily: fonts.display,
      fontSize: 14,
      color: colors.acid,
    },
    servicioName: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.white,
      flex: 1,
    },
    cellNum: {
      fontFamily: fonts.mono,
      fontSize: 13,
      color: colors.white,
    },
    cellNumAcid: {
      fontFamily: fonts.mono,
      fontSize: 13,
      color: colors.acid,
    },
  });
}

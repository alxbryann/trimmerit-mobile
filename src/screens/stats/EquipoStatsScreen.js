import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, Platform, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fonts, radii, shadows } from '../../theme';
import { useColors } from '../../theme/ThemeContext';
import { loadEquipoStats, marcarComisionPagada, loadComisionConfig, saveComisionConfig } from '../../api/equipo';
import { supabase } from '../../lib/supabase';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCLP(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function rangeForPreset(preset) {
  const now   = new Date();
  const today = startOfDay(now);
  const end   = new Date(today); end.setUTCDate(end.getUTCDate() + 1);

  switch (preset) {
    case 'dia': {
      return { start: today, end };
    }
    case 'semana': {
      const start = new Date(today);
      const day = (start.getUTCDay() + 6) % 7;
      start.setUTCDate(start.getUTCDate() - day);
      const e = new Date(start); e.setUTCDate(e.getUTCDate() + 7);
      return { start, end: e };
    }
    case 'mes': {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const e = new Date(start); e.setUTCMonth(e.getUTCMonth() + 1);
      return { start, end: e };
    }
    case 'anio': {
      const start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      const e = new Date(start); e.setUTCFullYear(e.getUTCFullYear() + 1);
      return { start, end: e };
    }
    default: return { start: today, end };
  }
}

function formatDateShort(d) {
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function EquipoStatsScreen({ navigation }) {
  const colors = useColors();

  const [barberiaId, setBarberiaId]     = useState(null);
  const [loading, setLoading]           = useState(true);
  const [resumen, setResumen]           = useState({ totalServicios: 0, comisionesPendientes: 0, ocupacionPromedio: 0 });
  const [barberos, setBarberos]         = useState([]);
  const [preset, setPreset]             = useState('mes');
  const [rangeStart, setRangeStart]     = useState(() => rangeForPreset('mes').start);
  const [rangeEnd, setRangeEnd]         = useState(() => rangeForPreset('mes').end);
  const [showDatePicker, setShowDatePicker] = useState(null); // 'start' | 'end' | null
  const [configVisible, setConfigVisible]   = useState(false);

  // ── Cargar barbería del usuario ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('barberias')
        .select('id')
        .eq('admin_id', user.id)
        .maybeSingle();
      if (data) setBarberiaId(data.id);
    })();
  }, []);

  // ── Cargar stats ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!barberiaId) return;
    setLoading(true);
    try {
      const data = await loadEquipoStats(barberiaId, rangeStart, rangeEnd);
      setResumen(data.resumen);
      setBarberos(data.barberos);
    } catch (e) {
      console.warn('EquipoStats error:', e);
    } finally {
      setLoading(false);
    }
  }, [barberiaId, rangeStart, rangeEnd]);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function applyPreset(p) {
    setPreset(p);
    const { start, end } = rangeForPreset(p);
    setRangeStart(start);
    setRangeEnd(end);
  }

  function onDateChange(which, date) {
    if (!date) { setShowDatePicker(null); return; }
    setPreset(null);
    if (which === 'start') setRangeStart(startOfDay(date));
    else {
      const e = startOfDay(date); e.setUTCDate(e.getUTCDate() + 1);
      setRangeEnd(e);
    }
    setShowDatePicker(null);
  }

  async function handlePagar(barbero) {
    Alert.alert(
      'Confirmar pago',
      `¿Marcar $${barbero.comisionPendiente.toLocaleString('es-CL')} como pagado a ${barbero.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await marcarComisionPagada({
                barberiaId,
                barberoId: barbero.id,
                monto: barbero.comisionPendiente,
                periodoInicio: rangeStart,
                periodoFin: rangeEnd,
              });
              load();
            } catch (e) {
              Alert.alert('Error', 'No se pudo registrar el pago.');
            }
          },
        },
      ],
    );
  }

  const s = makeStyles(colors);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backTxt}>← Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Gestión de Equipo</Text>
        <TouchableOpacity onPress={() => setConfigVisible(true)} style={s.configBtn}>
          <Text style={s.configTxt}>% Comisiones</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros de período */}
      <View style={s.filterBar}>
        {['dia', 'semana', 'mes', 'anio'].map((p) => (
          <TouchableOpacity
            key={p}
            style={[s.chip, preset === p && s.chipActive]}
            onPress={() => applyPreset(p)}
          >
            <Text style={[s.chipTxt, preset === p && s.chipTxtActive]}>
              {p === 'dia' ? 'DÍA' : p === 'semana' ? 'SEMANA' : p === 'mes' ? 'MES' : 'AÑO'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Selector rango personalizado */}
      <View style={s.rangeRow}>
        <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker('start')}>
          <Text style={s.dateLbl}>DESDE</Text>
          <Text style={s.dateVal}>{formatDateShort(rangeStart)}</Text>
        </TouchableOpacity>
        <View style={s.rangeSep} />
        <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker('end')}>
          <Text style={s.dateLbl}>HASTA</Text>
          <Text style={s.dateVal}>{formatDateShort(new Date(rangeEnd.getTime() - 86_400_000))}</Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={showDatePicker === 'start' ? rangeStart : new Date(rangeEnd.getTime() - 86_400_000)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, date) => onDateChange(showDatePicker, date)}
          maximumDate={new Date()}
        />
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.acid} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* KPIs globales */}
          <View style={s.kpiRow}>
            <KpiCard label="SERVICIOS TOTALES" value={resumen.totalServicios.toLocaleString('es-CL')} colors={colors} />
            <KpiCard label="COMISIONES PENDIENTES" value={formatCLP(resumen.comisionesPendientes)} accent colors={colors} />
            <KpiCard label="OCUPACIÓN PROMEDIO" value={`${resumen.ocupacionPromedio}%`} colors={colors} />
          </View>

          {/* Tarjetas por barbero */}
          {barberos.length === 0 ? (
            <Text style={s.empty}>Sin datos para este período.</Text>
          ) : (
            barberos.map((b, i) => (
              <BarberoCard
                key={b.id}
                barbero={b}
                rank={i + 1}
                colors={colors}
                onPagar={() => handlePagar(b)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Modal configuración de comisiones */}
      {configVisible && (
        <ComisionConfigModal
          barberiaId={barberiaId}
          colors={colors}
          onClose={() => { setConfigVisible(false); load(); }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({ label, value, accent, colors }) {
  const s = makeStyles(colors);
  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, accent && { color: colors.acid }]}>{value}</Text>
    </View>
  );
}

function BarberoCard({ barbero, rank, colors, onPagar }) {
  const s = makeStyles(colors);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <View style={s.card}>
      {/* Cabecera */}
      <View style={s.cardHeader}>
        <View style={s.rankBadge}>
          <Text style={s.rankTxt}>{medals[rank - 1] ?? `#${rank}`}</Text>
        </View>
        <View style={s.cardInfo}>
          <Text style={s.cardNombre}>{barbero.nombre}</Text>
          {barbero.especialidad ? <Text style={s.cardEsp}>{barbero.especialidad}</Text> : null}
        </View>
        <Text style={s.cardPct}>{barbero.comisionPct}%</Text>
      </View>

      {/* Métricas */}
      <View style={s.metricsRow}>
        <MetricBox label="SERVICIOS MES" value={barbero.servicios} colors={colors} />
        <MetricBox label="INGRESOS" value={formatCLP(barbero.ingresos)} colors={colors} />
        <MetricBox label="COMISIÓN PENDIENTE" value={formatCLP(barbero.comisionPendiente)} accent colors={colors} />
      </View>

      {/* Ocupación */}
      <View style={s.barSection}>
        <View style={s.barLabelRow}>
          <Text style={s.barLabel}>TASA DE OCUPACIÓN</Text>
          <Text style={s.barPct}>{barbero.ocupacion}%</Text>
        </View>
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${barbero.ocupacion}%`, backgroundColor: colors.acid }]} />
        </View>
      </View>

      {/* Fidelidad */}
      <View style={s.barSection}>
        <View style={s.barLabelRow}>
          <Text style={s.barLabel}>FIDELIDAD (FIJOS vs FLUJO)</Text>
          <Text style={s.barPct}>{barbero.fijosPct}% / {barbero.flujoPct}%</Text>
        </View>
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${barbero.fijosPct}%`, backgroundColor: colors.champagne ?? '#c8a96a' }]} />
          <View style={[s.barFill, { width: `${barbero.flujoPct}%`, backgroundColor: colors.grayMid }]} />
        </View>
      </View>

      {/* Botón pagar */}
      {barbero.comisionPendiente > 0 && (
        <TouchableOpacity style={s.pagarBtn} onPress={onPagar}>
          <Text style={s.pagarTxt}>MARCAR PAGADO · {formatCLP(barbero.comisionPendiente)}</Text>
        </TouchableOpacity>
      )}
      {barbero.comisionPendiente === 0 && barbero.servicios > 0 && (
        <View style={s.pagadoBadge}>
          <Text style={s.pagadoTxt}>✓ COMISIÓN AL DÍA</Text>
        </View>
      )}
    </View>
  );
}

function MetricBox({ label, value, accent, colors }) {
  const s = makeStyles(colors);
  return (
    <View style={s.metricBox}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, accent && { color: colors.acid }]}>{value}</Text>
    </View>
  );
}

function ComisionConfigModal({ barberiaId, colors, onClose }) {
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [defaultPct, setDefaultPct] = useState('50');
  const [overrides, setOverrides] = useState([]);
  const s = makeStyles(colors);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await loadComisionConfig(barberiaId);
        setDefaultPct(String(cfg.defaultPct));
        setOverrides(cfg.barberos.map((b) => ({ ...b, pct: String(b.comisionPct ?? '') })));
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [barberiaId]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveComisionConfig({
        barberiaId,
        defaultPct: Number(defaultPct),
        overrides: overrides.map((o) => ({ id: o.id, pct: o.pct !== '' ? Number(o.pct) : null })),
      });
      onClose();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>Configuración de Comisiones</Text>

          {loading ? (
            <ActivityIndicator color={colors.acid} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* % global */}
              <Text style={s.configSectionLabel}>% GLOBAL DE LA BARBERÍA</Text>
              <View style={s.configRow}>
                <Text style={s.configName}>Todos los barberos</Text>
                <View style={s.pctInputWrap}>
                  <TextInput
                    style={s.pctInput}
                    value={defaultPct}
                    onChangeText={setDefaultPct}
                    keyboardType="numeric"
                    maxLength={3}
                    placeholderTextColor={colors.grayMid}
                  />
                  <Text style={s.pctSymbol}>%</Text>
                </View>
              </View>

              {/* Overrides individuales */}
              {overrides.length > 0 && (
                <>
                  <Text style={[s.configSectionLabel, { marginTop: 16 }]}>% INDIVIDUAL (deja vacío para usar el global)</Text>
                  {overrides.map((o, i) => (
                    <View key={o.id} style={s.configRow}>
                      <Text style={s.configName}>{o.nombre}</Text>
                      <View style={s.pctInputWrap}>
                        <TextInput
                          style={s.pctInput}
                          value={o.pct}
                          onChangeText={(v) => {
                            const next = [...overrides];
                            next[i] = { ...next[i], pct: v };
                            setOverrides(next);
                          }}
                          keyboardType="numeric"
                          maxLength={3}
                          placeholder="—"
                          placeholderTextColor={colors.grayMid}
                        />
                        <Text style={s.pctSymbol}>%</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          )}

          <View style={s.modalBtns}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={s.saveTxt}>{saving ? 'Guardando…' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

function makeStyles(colors) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: colors.bg ?? colors.black },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: 16, paddingBottom: 48 },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    backBtn:  { paddingVertical: 4, paddingRight: 8 },
    backTxt:  { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.grayMid, letterSpacing: 0.5 },
    title:    { fontFamily: fonts.display, fontSize: 18, color: colors.white ?? colors.ink, letterSpacing: 1 },
    configBtn: { paddingVertical: 4, paddingLeft: 8 },
    configTxt: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.acid, letterSpacing: 0.5 },

    filterBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    chip:      { flex: 1, paddingVertical: 12, alignItems: 'center' },
    chipActive: { borderBottomWidth: 2, borderBottomColor: colors.acid },
    chipTxt:   { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.5, color: colors.grayMid },
    chipTxtActive: { color: colors.acid },

    rangeRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    dateBtn:   { flex: 1, alignItems: 'center' },
    dateLbl:   { fontFamily: fonts.mono, fontSize: 9, color: colors.grayMid, letterSpacing: 1 },
    dateVal:   { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white ?? colors.ink, marginTop: 2 },
    rangeSep:  { width: 1, height: 28, backgroundColor: colors.cardBorder },

    kpiRow:  { flexDirection: 'row', gap: 8, marginBottom: 16 },
    kpiCard: { flex: 1, backgroundColor: colors.dark2 ?? colors.card, borderWidth: 1, borderColor: colors.cardBorder, padding: 12, alignItems: 'center' },
    kpiLabel: { fontFamily: fonts.mono, fontSize: 8, color: colors.grayMid, letterSpacing: 0.8, textAlign: 'center', marginBottom: 4 },
    kpiValue: { fontFamily: fonts.display, fontSize: 18, color: colors.white ?? colors.ink },

    empty: { textAlign: 'center', color: colors.grayMid, fontFamily: fonts.body, marginTop: 40 },

    card: { backgroundColor: colors.dark2 ?? colors.card, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 12, padding: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    rankBadge:  { width: 36, height: 36, borderRadius: radii.pill, backgroundColor: colors.bg ?? colors.black, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    rankTxt:    { fontSize: 18 },
    cardInfo:   { flex: 1 },
    cardNombre: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white ?? colors.ink },
    cardEsp:    { fontFamily: fonts.mono, fontSize: 10, color: colors.grayMid, marginTop: 2 },
    cardPct:    { fontFamily: fonts.display, fontSize: 22, color: colors.acid },

    metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    metricBox:  { flex: 1, backgroundColor: colors.bg ?? colors.black, borderWidth: 1, borderColor: colors.cardBorder, padding: 8, alignItems: 'center' },
    metricLabel: { fontFamily: fonts.mono, fontSize: 7, color: colors.grayMid, letterSpacing: 0.5, textAlign: 'center', marginBottom: 4 },
    metricValue: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white ?? colors.ink },

    barSection:  { marginBottom: 10 },
    barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    barLabel:    { fontFamily: fonts.mono, fontSize: 8, color: colors.grayMid, letterSpacing: 0.5 },
    barPct:      { fontFamily: fonts.bodyBold, fontSize: 8, color: colors.grayLight ?? colors.grayMid },
    barTrack:    { height: 6, backgroundColor: colors.bg ?? colors.black, borderRadius: radii.pill, flexDirection: 'row', overflow: 'hidden' },
    barFill:     { height: 6, borderRadius: radii.pill },

    pagarBtn:   { marginTop: 8, backgroundColor: colors.acid, paddingVertical: 10, alignItems: 'center' },
    pagarTxt:   { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.black ?? '#0a0a0a', letterSpacing: 1.5 },
    pagadoBadge: { marginTop: 8, borderWidth: 1, borderColor: colors.acid, paddingVertical: 8, alignItems: 'center' },
    pagadoTxt:  { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.acid, letterSpacing: 1.5 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalBox:     { backgroundColor: colors.dark2 ?? colors.card, borderTopWidth: 1, borderTopColor: colors.cardBorder, padding: 24, maxHeight: '80%' },
    modalTitle:   { fontFamily: fonts.display, fontSize: 20, color: colors.white ?? colors.ink, marginBottom: 20, letterSpacing: 1 },
    configSectionLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.grayMid, letterSpacing: 1, marginBottom: 8 },
    configRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    configName:   { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white ?? colors.ink, flex: 1 },
    pctInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg ?? colors.black, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 10, paddingVertical: 6 },
    pctInput:     { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.acid, width: 40, textAlign: 'center' },
    pctSymbol:    { fontFamily: fonts.mono, fontSize: 14, color: colors.grayMid },
    modalBtns:    { flexDirection: 'row', gap: 12, marginTop: 20 },
    cancelBtn:    { flex: 1, borderWidth: 1, borderColor: colors.cardBorder, paddingVertical: 12, alignItems: 'center' },
    cancelTxt:    { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.grayMid, letterSpacing: 1 },
    saveBtn:      { flex: 1, backgroundColor: colors.acid, paddingVertical: 12, alignItems: 'center' },
    saveTxt:      { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.black ?? '#0a0a0a', letterSpacing: 1 },
  });
}

/**
 * ReservaActionsCard — Card de cita para el barbero
 *
 * Estados:
 *  collapsed  → muestra resumen + botón "REVISAR"
 *  expanded   → muestra 3 tabs: Completar / Cancelar / Aplazar
 *
 * Props:
 *  reserva        : objeto reserva
 *  perfil         : objeto profile del cliente { nombre, telefono }
 *  onCompletar    : (reservaId, sellarFidelizacion: bool) => Promise
 *  onCancelar     : (reservaId, razon: string) => Promise
 *  onAplazar      : (reservaId, razon, nuevaFecha, nuevaHora) => Promise
 *  tienePrograma  : bool — si la barbería tiene programa de fidelización activo
 */

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radii } from '../theme';

const TABS = [
  { key: 'completar', label: 'Completar', icon: 'checkmark-circle', color: '#4ade80' },
  { key: 'cancelar',  label: 'Cancelar',  icon: 'close-circle',     color: colors.danger },
  { key: 'aplazar',   label: 'Aplazar',   icon: 'time',             color: '#60a5fa' },
];

function pad2(n) { return String(n).padStart(2, '0'); }
function toISODate(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

const SLOT_START = 9 * 60;
const SLOT_END   = 20 * 60;
const STEP       = 30;
const TIME_SLOTS = [];
for (let m = SLOT_START; m < SLOT_END; m += STEP) {
  TIME_SLOTS.push(`${pad2(Math.floor(m/60))}:${pad2(m%60)}`);
}

function buildDays(count = 14) {
  const days = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAYS_AHEAD = buildDays(14);
const DAY_NAMES  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MON_NAMES  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtDayLabel(d) {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MON_NAMES[d.getMonth()]}`;
}

export default function ReservaActionsCard({
  reserva, perfil,
  onCompletar, onCancelar, onAplazar,
  tienePrograma = false,
}) {
  const [expanded, setExpanded]     = useState(false);
  const [tab, setTab]               = useState('completar');
  const [busy, setBusy]             = useState(false);
  const [done, setDone]             = useState(false);

  // Completar
  const [sellar, setSellar]         = useState(null); // null | true | false

  // Cancelar
  const [razonCancel, setRazonCancel] = useState('');

  // Aplazar
  const [razonAplazar, setRazonAplazar] = useState('');
  const [selectedDay, setSelectedDay]   = useState(null);
  const [selectedHora, setSelectedHora] = useState(null);

  const estado = reserva.estado ?? 'pendiente';
  const completada = estado === 'completada';
  const cancelada  = estado === 'cancelada';
  const aplazPend  = estado === 'aplazamiento_pendiente';
  const inactiva   = completada || cancelada;
  const name       = perfil?.nombre?.trim() || 'Cliente';

  // ── Verificar si la cita ya llegó ────────────────────────────────────────
  function citaYaOcurrio() {
    const fecha = reserva.fecha;
    const hora  = reserva.hora;
    if (!fecha || !hora) return true; // sin datos → permitir por seguridad
    const [y, m, d]   = fecha.split('-').map(Number);
    const [h, min]    = hora.split(':').map(Number);
    const citaMs = new Date(y, m - 1, d, h, min, 0, 0).getTime();
    return Date.now() >= citaMs;
  }
  const puedeCerrar = citaYaOcurrio();

  function fmtPrecio(p) {
    if (p == null) return '';
    return ` · $${Number(p).toLocaleString('es-CO')}`;
  }

  // ─── Actions ─────────────────────────────────────────────────────
  async function handleCompletar() {
    if (tienePrograma && sellar === null) return; // fuerza elegir
    setBusy(true);
    await onCompletar(reserva.id, sellar !== false);
    setBusy(false);
    setDone(true);
    setExpanded(false);
  }

  async function handleCancelar() {
    if (!razonCancel.trim()) return;
    setBusy(true);
    await onCancelar(reserva.id, razonCancel.trim());
    setBusy(false);
    setDone(true);
    setExpanded(false);
  }

  async function handleAplazar() {
    if (!razonAplazar.trim() || !selectedDay || !selectedHora) return;
    setBusy(true);
    await onAplazar(reserva.id, razonAplazar.trim(), toISODate(selectedDay), selectedHora);
    setBusy(false);
    setDone(true);
    setExpanded(false);
  }

  // ─── Header badge ─────────────────────────────────────────────────
  function estadoBadge() {
    if (completada)  return { label: 'COMPLETADA', bg: 'rgba(74,222,128,0.15)', color: '#4ade80' };
    if (cancelada)   return { label: 'CANCELADA',  bg: colors.dangerSoft, color: colors.danger };
    if (aplazPend)   return { label: 'ESPERANDO RESPUESTA', bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' };
    return             { label: 'PENDIENTE', bg: colors.acidGlow, color: colors.acid };
  }
  const badge = estadoBadge();

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <View style={[styles.card, completada && styles.cardOk, cancelada && styles.cardCanceled, aplazPend && styles.cardAplaz]}>

      {/* ── Header siempre visible ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>
            {reserva.hora ?? '—'}
            {perfil?.telefono ? ` · ${perfil.telefono}` : ''}
            {fmtPrecio(reserva.precio)}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeTxt, { color: badge.color }]}>{badge.label}</Text>
          </View>
          {!inactiva && !aplazPend && (
            <TouchableOpacity
              style={[styles.revisar, expanded && styles.revisarActive]}
              onPress={() => setExpanded(!expanded)}
            >
              <Text style={[styles.revisarTxt, expanded && { color: colors.black }]}>
                {expanded ? 'CERRAR' : 'REVISAR'}
              </Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={expanded ? colors.black : colors.acid}
              />
            </TouchableOpacity>
          )}
          {aplazPend && (
            <View style={styles.waitingChip}>
              <Ionicons name="time" size={11} color="#60a5fa" />
              <Text style={styles.waitingTxt}>ESPERANDO</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Panel expandido ── */}
      {expanded && !inactiva && (
        <View style={styles.panel}>
          {/* Tabs */}
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, tab === t.key && { borderBottomColor: t.color, borderBottomWidth: 2 }]}
                onPress={() => setTab(t.key)}
              >
                <Ionicons name={t.icon} size={14} color={tab === t.key ? t.color : colors.grayMid} />
                <Text style={[styles.tabTxt, { color: tab === t.key ? t.color : colors.grayMid }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Completar ── */}
          {tab === 'completar' && (
            <View style={styles.section}>
              {/* Aviso si la cita aún no llegó */}
              {!puedeCerrar && (
                <View style={styles.futureWarning}>
                  <Ionicons name="time-outline" size={16} color="#60a5fa" />
                  <Text style={styles.futureWarningTxt}>
                    La cita aún no ha ocurrido. Podés confirmar el corte a partir de las {reserva.hora ?? '—'}.
                  </Text>
                </View>
              )}

              {tienePrograma && puedeCerrar && (
                <>
                  <Text style={styles.sectionLabel}>¿Sellar tarjeta de fidelización?</Text>
                  <View style={styles.yesno}>
                    <TouchableOpacity
                      style={[styles.ynBtn, sellar === true && styles.ynBtnYes]}
                      onPress={() => setSellar(true)}
                    >
                      <Ionicons name="ribbon" size={14} color={sellar === true ? colors.black : colors.acid} />
                      <Text style={[styles.ynTxt, sellar === true && { color: colors.black }]}>SÍ, SELLAR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ynBtn, sellar === false && styles.ynBtnNo]}
                      onPress={() => setSellar(false)}
                    >
                      <Ionicons name="close" size={14} color={sellar === false ? colors.white : colors.grayMid} />
                      <Text style={[styles.ynTxt, { color: sellar === false ? colors.white : colors.grayMid }]}>NO SELLAR</Text>
                    </TouchableOpacity>
                  </View>
                  {sellar === null && (
                    <Text style={styles.hint}>Elegí una opción para continuar</Text>
                  )}
                </>
              )}
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: '#4ade80' },
                  (!puedeCerrar || busy || (tienePrograma && sellar === null)) && styles.btnDisabled,
                ]}
                onPress={handleCompletar}
                disabled={!puedeCerrar || busy || (tienePrograma && sellar === null)}
              >
                {busy
                  ? <ActivityIndicator size="small" color={colors.black} />
                  : <>
                      <Ionicons name="checkmark-circle" size={16} color={colors.black} />
                      <Text style={[styles.actionBtnTxt, { color: colors.black }]}>CONFIRMAR CORTE</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── Cancelar ── */}
          {tab === 'cancelar' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RAZÓN DE CANCELACIÓN <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.textarea}
                value={razonCancel}
                onChangeText={setRazonCancel}
                placeholder="Explicá al cliente por qué se cancela la cita..."
                placeholderTextColor={colors.grayMid}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>
                El cliente recibirá una notificación con esta explicación.
              </Text>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.danger },
                  (!razonCancel.trim() || busy) && styles.btnDisabled,
                ]}
                onPress={handleCancelar}
                disabled={!razonCancel.trim() || busy}
              >
                {busy
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <>
                      <Ionicons name="close-circle" size={16} color={colors.white} />
                      <Text style={[styles.actionBtnTxt, { color: colors.white }]}>CONFIRMAR CANCELACIÓN</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── Aplazar ── */}
          {tab === 'aplazar' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RAZÓN DEL CAMBIO <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.textarea}
                value={razonAplazar}
                onChangeText={setRazonAplazar}
                placeholder="Explicá por qué proponés este cambio de fecha..."
                placeholderTextColor={colors.grayMid}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />

              <Text style={styles.sectionLabel}>NUEVA FECHA <Text style={styles.required}>*</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
                {DAYS_AHEAD.map((d, i) => {
                  const iso = toISODate(d);
                  const sel = selectedDay && toISODate(selectedDay) === iso;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.dayChip, sel && styles.dayChipSelected]}
                      onPress={() => setSelectedDay(d)}
                    >
                      <Text style={[styles.dayChipTxt, sel && { color: colors.black }]}>
                        {fmtDayLabel(d)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.sectionLabel}>NUEVA HORA <Text style={styles.required}>*</Text></Text>
              <View style={styles.horaGrid}>
                {TIME_SLOTS.map((slot) => {
                  const sel = selectedHora === slot;
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[styles.horaChip, sel && styles.horaChipSelected]}
                      onPress={() => setSelectedHora(slot)}
                    >
                      <Text style={[styles.horaChipTxt, sel && { color: colors.black }]}>{slot}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedDay && selectedHora && (
                <View style={styles.proposalPreview}>
                  <Ionicons name="calendar" size={14} color="#60a5fa" />
                  <Text style={styles.proposalTxt}>
                    Propuesta: {fmtDayLabel(selectedDay)} a las {selectedHora}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: '#60a5fa' },
                  (!razonAplazar.trim() || !selectedDay || !selectedHora || busy) && styles.btnDisabled,
                ]}
                onPress={handleAplazar}
                disabled={!razonAplazar.trim() || !selectedDay || !selectedHora || busy}
              >
                {busy
                  ? <ActivityIndicator size="small" color={colors.black} />
                  : <>
                      <Ionicons name="paper-plane" size={16} color={colors.black} />
                      <Text style={[styles.actionBtnTxt, { color: colors.black }]}>ENVIAR PROPUESTA</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.dark2,
    borderRadius: radii.sm,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardOk:       { borderColor: 'rgba(74,222,128,0.3)',  backgroundColor: 'rgba(74,222,128,0.03)' },
  cardCanceled: { opacity: 0.45 },
  cardAplaz:    { borderColor: 'rgba(96,165,250,0.35)', backgroundColor: 'rgba(96,165,250,0.04)' },

  headerRow:  { flexDirection: 'row', padding: 12, gap: 10, alignItems: 'flex-start' },
  headerLeft: { flex: 1 },
  headerRight:{ alignItems: 'flex-end', gap: 6 },

  name: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.grayLight, marginTop: 3 },

  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radii.xs,
  },
  badgeTxt: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.5 },

  revisar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.acid,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radii.xs,
  },
  revisarActive: { backgroundColor: colors.acid },
  revisarTxt: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 1, color: colors.acid },

  waitingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.35)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radii.xs,
  },
  waitingTxt: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.5, color: '#60a5fa' },

  // Panel expandido
  panel: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabTxt: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1 },

  section: { padding: 14, gap: 10 },
  sectionLabel: {
    fontFamily: fonts.bodyBold, fontSize: 9,
    letterSpacing: 2, color: colors.grayLight,
  },
  required: { color: colors.danger },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.grayMid },
  futureWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
    borderRadius: radii.xs, padding: 10,
  },
  futureWarningTxt: {
    flex: 1, fontFamily: fonts.body, fontSize: 12,
    color: '#93c5fd', lineHeight: 17,
  },

  textarea: {
    backgroundColor: colors.dark3,
    borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: radii.xs,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 14, color: colors.white,
    minHeight: 72,
  },

  yesno: { flexDirection: 'row', gap: 8 },
  ynBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: radii.xs, paddingVertical: 10,
    backgroundColor: colors.dark3,
  },
  ynBtnYes: { backgroundColor: colors.acid, borderColor: colors.acid },
  ynBtnNo:  { backgroundColor: colors.grayMid, borderColor: colors.grayMid },
  ynTxt: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, color: colors.acid },

  // Días
  dayScroll: { marginBottom: 4 },
  dayChip: {
    borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: radii.xs, paddingHorizontal: 12, paddingVertical: 8,
    marginRight: 8, backgroundColor: colors.dark3,
  },
  dayChipSelected: { backgroundColor: '#60a5fa', borderColor: '#60a5fa' },
  dayChipTxt: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grayLight },

  // Horas
  horaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  horaChip: {
    borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: radii.xs, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.dark3,
  },
  horaChipSelected: { backgroundColor: '#60a5fa', borderColor: '#60a5fa' },
  horaChipTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.grayLight },

  proposalPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
    borderRadius: radii.xs, padding: 10,
  },
  proposalTxt: { fontFamily: fonts.body, fontSize: 12, color: '#93c5fd' },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: radii.sm, paddingVertical: 14, marginTop: 4,
  },
  actionBtnTxt: { fontFamily: fonts.display, fontSize: 14, letterSpacing: 1.5 },
  btnDisabled: { opacity: 0.4 },
});

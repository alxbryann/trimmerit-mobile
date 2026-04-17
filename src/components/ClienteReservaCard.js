/**
 * ClienteReservaCard — Card de cita pendiente para el cliente
 *
 * Muestra la info de la cita y dos acciones:
 *  • CANCELAR  → Alert de confirmación → onCancelar(reservaId)
 *  • CAMBIAR   → Selector inline de fecha/hora → onCambiar(reservaId, nuevaFecha, nuevaHora)
 *
 * Props:
 *  reserva        : objeto reserva { id, fecha, hora, precio, estado }
 *  barberiaNombre : string
 *  barberoNombre  : string | null
 *  onCancelar     : (reservaId) => Promise
 *  onCambiar      : (reservaId, nuevaFecha, nuevaHora) => Promise
 */

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radii } from '../theme';
import { fmtPrice } from '../utils/booking';

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, '0'); }
function toISODate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MON_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_UPPER = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function fmtFecha(ymd) {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  return `${pad2(d)} ${MONTHS_UPPER[m - 1]} ${y}`;
}

function buildDays(count = 30) {
  const days = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  for (let i = 1; i <= count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAYS_AHEAD = buildDays(30);

// Slots de 09:00 a 20:00 cada 30 min
const TIME_SLOTS = [];
for (let m = 9 * 60; m < 20 * 60; m += 30) {
  TIME_SLOTS.push(`${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`);
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function ClienteReservaCard({
  reserva,
  barberiaNombre,
  barberoNombre,
  onCancelar,
  onCambiar,
}) {
  const [expanded, setExpanded]     = useState(false);   // panel cambiar visible
  const [selectedDay, setSelectedDay] = useState(null);  // índice en DAYS_AHEAD
  const [selectedTime, setSelectedTime] = useState(null);
  const [busy, setBusy]             = useState(false);

  const puedeAccionar = (reserva.estado ?? '').toLowerCase() === 'pendiente';

  // ─── Cancelar ──────────────────────────────────────────────────────────────
  function handleCancelarPress() {
    Alert.alert(
      'Cancelar cita',
      `¿Seguro que quieres cancelar tu cita del ${fmtFecha(reserva.fecha)} a las ${reserva.hora}?`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            await onCancelar?.(reserva.id);
            setBusy(false);
          },
        },
      ]
    );
  }

  // ─── Confirmar cambio ──────────────────────────────────────────────────────
  async function handleConfirmarCambio() {
    if (selectedDay == null || !selectedTime) return;
    const nuevaFecha = toISODate(DAYS_AHEAD[selectedDay]);
    const nuevaHora  = selectedTime;

    Alert.alert(
      'Confirmar cambio',
      `Cambiar tu cita a:\n${DAY_NAMES[DAYS_AHEAD[selectedDay].getDay()]} ${DAYS_AHEAD[selectedDay].getDate()} de ${MON_NAMES[DAYS_AHEAD[selectedDay].getMonth()]} · ${nuevaHora}`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setBusy(true);
            await onCambiar?.(reserva.id, nuevaFecha, nuevaHora);
            setBusy(false);
            setExpanded(false);
            setSelectedDay(null);
            setSelectedTime(null);
          },
        },
      ]
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      {/* ── Cabecera de la card ── */}
      <Text style={styles.cardTitle} numberOfLines={1}>{barberiaNombre.toUpperCase()}</Text>
      {barberoNombre ? (
        <Text style={styles.cardBarbero}>por {barberoNombre}</Text>
      ) : null}
      <Text style={styles.cardMeta}>
        {fmtFecha(reserva.fecha)} · {reserva.hora ?? '—'}
      </Text>
      {reserva.precio != null && Number.isFinite(Number(reserva.precio)) ? (
        <Text style={styles.precio}>${fmtPrice(Number(reserva.precio))}</Text>
      ) : null}
      <View style={styles.badgePending}>
        <Text style={styles.badgeText}>PENDIENTE</Text>
      </View>

      {/* ── Botones de acción (solo si estado === 'pendiente') ── */}
      {puedeAccionar && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btnCambiar, expanded && styles.btnCambiarActive]}
            onPress={() => setExpanded((v) => !v)}
            disabled={busy}
          >
            <Ionicons name="calendar-outline" size={14} color={expanded ? colors.black : '#60a5fa'} />
            <Text style={[styles.btnCambiarTxt, expanded && { color: colors.black }]}>
              CAMBIAR CITA
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnCancelar}
            onPress={handleCancelarPress}
            disabled={busy}
          >
            {busy
              ? <ActivityIndicator size="small" color={colors.white} />
              : <>
                  <Ionicons name="close-circle-outline" size={14} color={colors.white} />
                  <Text style={styles.btnCancelarTxt}>CANCELAR</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* ── Panel selector de fecha/hora ── */}
      {expanded && (
        <View style={styles.picker}>
          {/* Selector de fecha */}
          <Text style={styles.pickerLabel}>NUEVA FECHA</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayRow}
          >
            {DAYS_AHEAD.map((d, i) => {
              const sel = selectedDay === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dayChip, sel && styles.dayChipSel]}
                  onPress={() => setSelectedDay(i)}
                >
                  <Text style={[styles.dayChipName, sel && { color: colors.black }]}>
                    {DAY_NAMES[d.getDay()]}
                  </Text>
                  <Text style={[styles.dayChipNum, sel && { color: colors.black }]}>
                    {d.getDate()}
                  </Text>
                  <Text style={[styles.dayChipMon, sel && { color: colors.black }]}>
                    {MON_NAMES[d.getMonth()]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Selector de hora */}
          {selectedDay != null && (
            <>
              <Text style={[styles.pickerLabel, { marginTop: 14 }]}>NUEVA HORA</Text>
              <View style={styles.timeGrid}>
                {TIME_SLOTS.map((t) => {
                  const sel = selectedTime === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.timeChip, sel && styles.timeChipSel]}
                      onPress={() => setSelectedTime(t)}
                    >
                      <Text style={[styles.timeChipTxt, sel && { color: colors.black }]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Preview del cambio + confirmar */}
          {selectedDay != null && selectedTime && (
            <View style={styles.preview}>
              <View style={styles.previewRow}>
                <Ionicons name="time-outline" size={14} color="#60a5fa" />
                <Text style={styles.previewTxt}>
                  {DAY_NAMES[DAYS_AHEAD[selectedDay].getDay()]}{' '}
                  {DAYS_AHEAD[selectedDay].getDate()} de{' '}
                  {MON_NAMES[DAYS_AHEAD[selectedDay].getMonth()]} · {selectedTime}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.btnConfirmar, busy && { opacity: 0.5 }]}
                onPress={handleConfirmarCambio}
                disabled={busy}
              >
                {busy
                  ? <ActivityIndicator size="small" color={colors.black} />
                  : <>
                      <Ionicons name="checkmark-circle" size={16} color={colors.black} />
                      <Text style={styles.btnConfirmarTxt}>CONFIRMAR CAMBIO</Text>
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    padding: 16,
    gap: 5,
    marginBottom: 2,
  },
  cardTitle:  { fontFamily: fonts.display, fontSize: 18, color: colors.white, letterSpacing: 0.5 },
  cardBarbero: { fontFamily: fonts.body, fontSize: 12, color: colors.grayMid, marginTop: -2 },
  cardMeta:   { fontFamily: fonts.body, fontSize: 13, color: colors.grayLight },
  precio:     { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.acid },

  badgePending: {
    alignSelf: 'flex-start',
    backgroundColor: colors.acid,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.xs,
    marginTop: 4,
  },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.5, color: colors.black },

  // ── Botones principales ──
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  btnCambiar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#60a5fa',
    borderRadius: radii.sm,
    paddingVertical: 10,
  },
  btnCambiarActive: {
    backgroundColor: '#60a5fa',
    borderColor: '#60a5fa',
  },
  btnCambiarTxt: {
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#60a5fa',
  },
  btnCancelar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    paddingVertical: 10,
  },
  btnCancelarTxt: {
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.white,
  },

  // ── Panel de selector ──
  picker: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 14,
  },
  pickerLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.grayMid,
    marginBottom: 10,
  },
  dayRow: { gap: 8, paddingBottom: 4 },
  dayChip: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 52,
    gap: 2,
  },
  dayChipSel: { backgroundColor: '#60a5fa', borderColor: '#60a5fa' },
  dayChipName: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.grayLight },
  dayChipNum:  { fontFamily: fonts.display,  fontSize: 18, color: colors.white },
  dayChipMon:  { fontFamily: fonts.body,     fontSize: 10, color: colors.grayMid },

  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    borderWidth: 1,
    borderColor: colors.gray,
    borderRadius: radii.xs,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  timeChipSel: { backgroundColor: '#60a5fa', borderColor: '#60a5fa' },
  timeChipTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },

  // ── Preview + confirmar ──
  preview: {
    marginTop: 14,
    gap: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.25)',
    borderRadius: radii.sm,
    padding: 12,
  },
  previewTxt: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.white },
  btnConfirmar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#60a5fa',
    borderRadius: radii.sm,
    paddingVertical: 13,
  },
  btnConfirmarTxt: {
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.black,
  },
});

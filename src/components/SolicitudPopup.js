/**
 * SolicitudPopup — Modal de alerta para cliente y barbero
 *
 * Props:
 *  solicitud   : objeto reserva_solicitudes con relaciones embebidas
 *  onClose     : () => void
 *  onAceptar   : (solicitudId) => Promise   (solo aplazamiento cliente)
 *  onRechazar  : (solicitudId) => Promise   (solo aplazamiento cliente)
 *  onNuevaReserva: (barberoSlug) => void    (solo cancelacion cliente)
 *  role        : 'cliente' | 'barbero'
 */

import { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radii } from '../theme';

const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MON_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtFecha(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d} de ${MON_NAMES[m-1]}`;
}

export default function SolicitudPopup({
  solicitud, onClose, onAceptar, onRechazar, onNuevaReserva, role = 'cliente',
}) {
  const [busy, setBusy] = useState(false);
  if (!solicitud) return null;

  const esCancelacion        = solicitud.tipo === 'cancelacion';
  const esAplazamiento       = solicitud.tipo === 'aplazamiento';
  const esCancelacionCliente = solicitud.tipo === 'cancelacion_cliente';
  const esCambioCliente      = solicitud.tipo === 'cambio_cliente';
  const nombreBarberia = solicitud.barberos?.nombre_barberia || 'La barbería';
  const nombreCliente  = solicitud.profiles?.nombre || 'El cliente';

  // Para el barbero que ve la respuesta del cliente
  const acepto   = solicitud.estado === 'aceptado';
  const rechazo  = solicitud.estado === 'rechazado';

  async function handleAceptar() {
    setBusy(true);
    await onAceptar?.(solicitud.id);
    setBusy(false);
    onClose?.();
  }

  async function handleRechazar() {
    setBusy(true);
    await onRechazar?.(solicitud.id);
    setBusy(false);
    onClose?.();
  }

  // ─── Contenido según tipo y rol ───────────────────────────────────
  function renderContent() {
    // CLIENTE ve cancelación
    if (role === 'cliente' && esCancelacion) {
      return (
        <>
          <View style={styles.iconCircle}>
            <Ionicons name="close-circle" size={36} color={colors.danger} />
          </View>
          <Text style={styles.title}>Reserva cancelada</Text>
          <Text style={styles.subtitle}>{nombreBarberia} canceló tu cita.</Text>

          <View style={styles.razonBox}>
            <Text style={styles.razonLabel}>RAZÓN DEL BARBERO</Text>
            <Text style={styles.razon}>{solicitud.razon}</Text>
          </View>

          <View style={styles.actions}>
            {onNuevaReserva && (
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => { onClose?.(); onNuevaReserva(solicitud.barbero_slug); }}
              >
                <Ionicons name="calendar-outline" size={16} color={colors.black} />
                <Text style={styles.btnPrimaryTxt}>HACER NUEVA RESERVA</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
              <Text style={styles.btnSecondaryTxt}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    // CLIENTE ve propuesta de aplazamiento (pendiente)
    if (role === 'cliente' && esAplazamiento && solicitud.estado === 'pendiente') {
      return (
        <>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar" size={36} color="#60a5fa" />
          </View>
          <Text style={styles.title}>Cambio de fecha propuesto</Text>
          <Text style={styles.subtitle}>{nombreBarberia} quiere mover tu cita.</Text>

          <View style={styles.razonBox}>
            <Text style={styles.razonLabel}>RAZÓN</Text>
            <Text style={styles.razon}>{solicitud.razon}</Text>
          </View>

          <View style={[styles.propuestaBox]}>
            <Ionicons name="time" size={16} color="#60a5fa" />
            <View>
              <Text style={styles.propuestaLabel}>NUEVA FECHA Y HORA</Text>
              <Text style={styles.propuestaVal}>
                {fmtFecha(solicitud.nueva_fecha)} · {solicitud.nueva_hora}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btnAceptar, busy && styles.btnDisabled]}
              onPress={handleAceptar}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator size="small" color={colors.black} />
                : <>
                    <Ionicons name="checkmark-circle" size={16} color={colors.black} />
                    <Text style={styles.btnAceptarTxt}>ACEPTAR</Text>
                  </>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnRechazar, busy && styles.btnDisabled]}
              onPress={handleRechazar}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator size="small" color={colors.white} />
                : <>
                    <Ionicons name="close-circle" size={16} color={colors.white} />
                    <Text style={styles.btnRechazarTxt}>RECHAZAR</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.dismissLink} onPress={onClose}>
            <Text style={styles.dismissTxt}>Ver más tarde</Text>
          </TouchableOpacity>
        </>
      );
    }

    // BARBERO ve la respuesta del cliente al aplazamiento
    if (role === 'barbero' && esAplazamiento && (acepto || rechazo)) {
      return (
        <>
          <View style={styles.iconCircle}>
            <Ionicons
              name={acepto ? 'checkmark-circle' : 'close-circle'}
              size={36}
              color={acepto ? '#4ade80' : colors.danger}
            />
          </View>
          <Text style={styles.title}>
            {acepto ? 'Aplazamiento aceptado' : 'Aplazamiento rechazado'}
          </Text>
          <Text style={styles.subtitle}>
            {acepto
              ? `${nombreCliente} aceptó el cambio al ${fmtFecha(solicitud.nueva_fecha)} a las ${solicitud.nueva_hora}.`
              : `${nombreCliente} rechazó el cambio de fecha propuesto.`
            }
          </Text>
          {rechazo && (
            <Text style={styles.razon}>
              La cita ha sido cancelada.
            </Text>
          )}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnPrimary} onPress={onClose}>
              <Text style={styles.btnPrimaryTxt}>ENTENDIDO</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    // BARBERO ve que el cliente canceló su cita
    if (role === 'barbero' && esCancelacionCliente) {
      const fechaStr = solicitud.reserva_fecha
        ? `${fmtFecha(solicitud.reserva_fecha)}${solicitud.reserva_hora ? ` · ${solicitud.reserva_hora}` : ''}`
        : null;
      return (
        <>
          <View style={styles.iconCircle}>
            <Ionicons name="close-circle" size={36} color={colors.danger} />
          </View>
          <Text style={styles.title}>Cita cancelada</Text>
          <Text style={styles.subtitle}>
            {nombreCliente} canceló su cita.
          </Text>
          {fechaStr && (
            <View style={styles.propuestaBox}>
              <Ionicons name="calendar-outline" size={16} color={colors.grayLight} />
              <View>
                <Text style={styles.propuestaLabel}>FECHA DE LA CITA</Text>
                <Text style={styles.propuestaVal}>{fechaStr}</Text>
              </View>
            </View>
          )}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnPrimary} onPress={onClose}>
              <Text style={styles.btnPrimaryTxt}>ENTENDIDO</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    // BARBERO ve que el cliente cambió la fecha/hora
    if (role === 'barbero' && esCambioCliente) {
      return (
        <>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar" size={36} color="#60a5fa" />
          </View>
          <Text style={styles.title}>Cita reprogramada</Text>
          <Text style={styles.subtitle}>
            {nombreCliente} cambió su cita.
          </Text>
          <View style={[styles.propuestaBox]}>
            <Ionicons name="time" size={16} color="#60a5fa" />
            <View>
              <Text style={styles.propuestaLabel}>NUEVA FECHA Y HORA</Text>
              <Text style={styles.propuestaVal}>
                {fmtFecha(solicitud.nueva_fecha)} · {solicitud.nueva_hora}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnPrimary} onPress={onClose}>
              <Text style={styles.btnPrimaryTxt}>ENTENDIDO</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    return null;
  }

  const content = renderContent();
  if (!content) return null;

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <LinearGradient colors={['#1c1c1c', '#0f0f0f']} style={styles.sheetInner}>
            <View style={styles.handle} />
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {content}
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  sheetInner: { borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  handle: {
    width: 36, height: 4, backgroundColor: colors.gray,
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  body: {
    padding: 24, paddingBottom: 40, gap: 16, alignItems: 'center',
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.dark3,
    borderWidth: 1, borderColor: colors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.display, fontSize: 26, color: colors.white,
    letterSpacing: 0.5, textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body, fontSize: 14, color: colors.grayLight,
    textAlign: 'center', lineHeight: 20, maxWidth: 280,
  },
  razonBox: {
    backgroundColor: colors.dark3,
    borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: radii.sm,
    padding: 14, width: '100%', gap: 6,
  },
  razonLabel: {
    fontFamily: fonts.bodyBold, fontSize: 9,
    letterSpacing: 2, color: colors.grayMid,
  },
  razon: {
    fontFamily: fonts.body, fontSize: 14,
    color: colors.white, lineHeight: 20,
  },
  propuestaBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
    borderRadius: radii.sm, padding: 14, width: '100%',
  },
  propuestaLabel: {
    fontFamily: fonts.bodyBold, fontSize: 9,
    letterSpacing: 2, color: '#60a5fa',
  },
  propuestaVal: {
    fontFamily: fonts.bodySemi, fontSize: 15,
    color: colors.white, marginTop: 2,
  },
  actions: { width: '100%', gap: 10 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.acid,
    borderRadius: radii.sm, paddingVertical: 15,
  },
  btnPrimaryTxt: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 2, color: colors.black },
  btnSecondary: {
    borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: radii.sm, paddingVertical: 13, alignItems: 'center',
  },
  btnSecondaryTxt: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 1, color: colors.grayLight },
  btnAceptar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#4ade80',
    borderRadius: radii.sm, paddingVertical: 15,
  },
  btnAceptarTxt: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 2, color: colors.black },
  btnRechazar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.danger,
    borderRadius: radii.sm, paddingVertical: 15,
  },
  btnRechazarTxt: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 2, color: colors.white },
  btnDisabled: { opacity: 0.5 },
  dismissLink: { alignSelf: 'center', paddingVertical: 8 },
  dismissTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.grayMid },
});

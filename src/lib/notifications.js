/**
 * NOTIFICACIONES — BarberIT
 *
 * Notificaciones locales (schedule): útiles para avisos in-app.
 *
 * Expo Go + Android (SDK 53+): el módulo nativo de push remoto fue retirado;
 * evitamos cargar `expo-notifications` ahí para no inundar la consola con ERROR.
 * Para probar notificaciones reales en Android: development build (`expo-dev-client`
 * + `npx expo run:android` o EAS Build).
 *
 * iOS en Expo Go: limitaciones menores; en producción usar build nativo.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const isExpoGoAndroid =
  Platform.OS === 'android' &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const Notifications = isExpoGoAndroid ? null : require('expo-notifications');

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Solicitar permisos. Retorna true si fueron otorgados.
 */
export async function requestNotificationPermissions() {
  if (Platform.OS === 'web' || !Notifications) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Canal Android (Android 8+). Sin efecto fuera de Android o sin módulo.
 */
export async function setupNotificationChannel() {
  if (Platform.OS !== 'android' || !Notifications) return;
  await Notifications.setNotificationChannelAsync('barberit-reservas', {
    name: 'Reservas',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#CDFF00',
    sound: true,
  });
}

/**
 * Notificación local inmediata.
 */
export async function sendLocalNotification(title, body, data = {}) {
  if (!Notifications) return null;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;

    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'barberit-reservas' }),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[Notifications] Error al enviar notificación local:', e.message);
    return null;
  }
}

export function notifCancelacionAlCliente(nombreBarberia) {
  return sendLocalNotification(
    '❌ Reserva cancelada',
    `${nombreBarberia} canceló tu cita. Abrí la app para más detalles.`,
    { tipo: 'cancelacion' }
  );
}

export function notifAplazamientoAlCliente(nombreBarberia, nuevaFecha, nuevaHora) {
  return sendLocalNotification(
    '📅 Propuesta de cambio de fecha',
    `${nombreBarberia} propone mover tu cita al ${nuevaFecha} a las ${nuevaHora}.`,
    { tipo: 'aplazamiento' }
  );
}

export function notifRespuestaAlBarbero(nombreCliente, acepto) {
  return sendLocalNotification(
    acepto ? '✅ Aplazamiento aceptado' : '❌ Aplazamiento rechazado',
    acepto
      ? `${nombreCliente} aceptó el cambio de fecha.`
      : `${nombreCliente} rechazó el cambio de fecha propuesto.`,
    { tipo: 'respuesta_aplazamiento', acepto }
  );
}

export function notifCancelacionAlBarbero(nombreCliente, fecha) {
  return sendLocalNotification(
    '❌ Cita cancelada por el cliente',
    `${nombreCliente} canceló su cita del ${fecha}.`,
    { tipo: 'cancelacion_cliente' }
  );
}

export function notifCambioAlBarbero(nombreCliente, nuevaFecha, nuevaHora) {
  return sendLocalNotification(
    '📅 Cliente reprogramó su cita',
    `${nombreCliente} cambió su cita al ${nuevaFecha} a las ${nuevaHora}.`,
    { tipo: 'cambio_cliente' }
  );
}

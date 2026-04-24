/**
 * NOTIFICACIONES — Trimmerit
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
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { supabase, supabaseConfigured } from './supabase';

const isExpoGoAndroid =
  Platform.OS === 'android' &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const Notifications = isExpoGoAndroid ? null : require('expo-notifications');

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
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

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Registra el token Expo Push del dispositivo en `profiles.push_token` (sesión actual).
 */
export async function registerPushToken() {
  if (!supabaseConfigured || Platform.OS === 'web' || !Notifications) {
    console.warn('[Notifications] No se puede registrar push token en este entorno.');
    return;
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('[Notifications] No hay sesión para registrar push token.');
      return;
    }
    if (!Device.isDevice) {
      console.warn('[Notifications] Push remoto requiere dispositivo físico.');
      return;
    }

    const granted = await requestNotificationPermissions();
    if (!granted) {
      console.warn('[Notifications] Permisos de notificación no otorgados.');
      return;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.easProjectId;
    if (!projectId) {
      console.warn('[Notifications] Falta EAS projectId para obtener Expo push token.');
      return;
    }
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      { projectId },
    );
    const token = tokenRes?.data;
    if (!token) {
      console.warn('[Notifications] Expo no retornó push token.');
      return;
    }

    await supabase.from('profiles').update({ push_token: token }).eq('id', session.user.id);
    console.log('[Notifications] Push token registrado:', token);
  } catch (e) {
    console.warn('[Notifications] registerPushToken:', e?.message ?? e);
  }
}

/**
 * Envía notificación remota vía API de Expo Push (token tipo ExponentPushToken[...]).
 */
export async function sendPushNotification({ to, title, body, data = {} }) {
  if (!to || typeof to !== 'string') {
    console.warn('[Notifications] No hay push token de destino.');
    return null;
  }
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        title,
        body,
        data,
        sound: 'default',
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.data?.status === 'error') {
      console.warn('[Notifications] Expo push rechazado:', json ?? res.status);
    } else {
      console.log('[Notifications] Expo push enviado:', json);
    }

    const ticketId = json?.data?.id;
    if (!ticketId) return { ticket: json, receipt: null };

    await wait(1500);
    const receiptRes = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: [ticketId] }),
    });
    const receiptJson = await receiptRes.json().catch(() => null);
    const receipt = receiptJson?.data?.[ticketId] ?? null;
    if (!receiptRes.ok || receipt?.status === 'error') {
      console.warn('[Notifications] Expo push receipt error:', receiptJson ?? receiptRes.status);
    } else {
      console.log('[Notifications] Expo push receipt:', receiptJson);
    }
    return { ticket: json, receipt };
  } catch (e) {
    console.warn('[Notifications] sendPushNotification:', e?.message ?? e);
    return null;
  }
}

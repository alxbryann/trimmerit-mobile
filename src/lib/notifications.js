import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/** Android `res/raw` + channel `sound` (Expo push `sound` is iOS-only). */
export const RESERVAS_NOTIFICATION_SOUND_ANDROID = 'barber_buzz.wav';
/** iOS bundle + Expo Push `sound` → APNs `aps.alert.sound`. */
export const RESERVAS_NOTIFICATION_SOUND_IOS = 'barber_buzz.caf';
/** New channel id so Android picks up custom sound (channels are immutable after first create). */
export const RESERVAS_NOTIFICATION_CHANNEL_ID = 'reservas_barber';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Requests permission and saves the Expo push token to the current user's profile.
 * Call this once after the user logs in.
 */
export async function registerPushToken() {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(RESERVAS_NOTIFICATION_CHANNEL_ID, {
      name: 'Reservas',
      importance: Notifications.AndroidImportance.MAX,
      sound: RESERVAS_NOTIFICATION_SOUND_ANDROID,
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: '05af54d2-14ca-4996-b715-4543396d9683',
  });

  if (token) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);
    }
  }

  return token;
}

/**
 * Sends a push notification via Expo's Push API to the given token.
 */
export async function sendPushNotification({ to, title, body, data = {} }) {
  if (!to) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        title,
        body,
        data,
        sound: RESERVAS_NOTIFICATION_SOUND_IOS,
        channelId: RESERVAS_NOTIFICATION_CHANNEL_ID,
        priority: 'high',
      }),
    });
  } catch (e) {
    console.warn('[push]', e);
  }
}

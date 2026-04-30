import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * URL de retorno OAuth para signInWithOAuth → redirectTo.
 *
 * Estrategia:
 * - Nativo (iOS/Android): deep link con Linking.createURL('auth/callback')
 *   para que openAuthSessionAsync cierre correctamente.
 * - Web: si existe EXPO_PUBLIC_SITE_URL, usa `${SITE_URL}/auth/mobile-callback`.
 * - Si no hay site en web, fallback a createURL (mismo patrón que Expo Go).
 *
 * En Supabase → Redirect URLs permite deep links (exp://** y trimmerit://**).
 * Si también soportas web, añade además la URL HTTPS de callback.
 *
 * Override total: EXPO_PUBLIC_OAUTH_REDIRECT_URI
 */
export function getOAuthRedirectUri() {
  const override =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_OAUTH_REDIRECT_URI?.trim()) ||
    '';
  if (override) {
    if (__DEV__) console.log('[Trimmerit OAuth] redirect_to (override):', override);
    return override;
  }

  // En iOS/Android el retorno más estable para openAuthSessionAsync es deep-link
  // (trimmerit:// o exp:// en dev). Evita quedarse atascado en una página HTTPS.
  if (Platform.OS !== 'web') {
    const nativeUri = Linking.createURL('auth/callback');
    if (__DEV__) {
      console.log(
        '[Trimmerit OAuth] redirect_to nativo (deep link). Añade en Supabase Redirect URLs:\n',
        nativeUri,
        '\nTambién puedes permitir: exp://** y trimmerit://**'
      );
    }
    return nativeUri;
  }

  const site =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SITE_URL?.trim()) || '';
  if (site) {
    const base = site.replace(/\/$/, '');
    const httpsRedirect = `${base}/auth/mobile-callback`;
    if (__DEV__) {
      console.log(
        '[Trimmerit OAuth] redirect_to (HTTPS). Añade en Supabase Redirect URLs:\n',
        httpsRedirect
      );
    }
    return httpsRedirect;
  }

  const uri = Linking.createURL('auth/callback');
  if (__DEV__) {
    console.log('[Trimmerit OAuth] redirect_to:', uri);
    console.log(
      '[Trimmerit OAuth] Asegurate de tener en Supabase Redirect URLs: exp://** y trimmerit://**'
    );
  }
  return uri;
}

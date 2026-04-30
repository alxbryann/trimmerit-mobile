import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * URL de retorno OAuth para signInWithOAuth → redirectTo.
 *
 * Estrategia:
 * - Nativo (iOS/Android): deep link con Linking.createURL('auth/callback')
 *   para que openAuthSessionAsync cierre correctamente.
 * - Web: si existe EXPO_PUBLIC_SITE_URL, usa `${SITE_URL}/auth/mobile-callback`.
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
    console.log(
      '[Trimmerit OAuth] Sin EXPO_PUBLIC_SITE_URL; usando deep link:',
      uri,
      '\nPara OAuth estable, configura EXPO_PUBLIC_SITE_URL + página /auth/mobile-callback en la web.'
    );
  }
  return uri;
}

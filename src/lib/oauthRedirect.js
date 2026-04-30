import * as Linking from 'expo-linking';

/**
 * URL de retorno OAuth para signInWithOAuth → redirectTo.
 *
 * Usa deep link directo al scheme de la app:
 *   - Expo Go (dev):      exp://192.168.x.x:8081/--/auth/callback
 *   - Build producción:   barberit://auth/callback
 *
 * En Supabase Dashboard → Authentication → URL Configuration → Redirect URLs añade:
 *   exp://**
 *   barberit://**
 *
 * Override manual (opcional): EXPO_PUBLIC_OAUTH_REDIRECT_URI
 */
export function getOAuthRedirectUri() {
  const override =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_OAUTH_REDIRECT_URI?.trim()) ||
    '';
  if (override) {
    if (__DEV__) console.log('[Trimmerit OAuth] redirect_to (override):', override);
    return override;
  }

  const uri = Linking.createURL('auth/callback');
  if (__DEV__) {
    console.log('[Trimmerit OAuth] redirect_to:', uri);
    console.log('[Trimmerit OAuth] Asegurate de tener en Supabase Redirect URLs: exp://** y barberit://**');
  }
  return uri;
}

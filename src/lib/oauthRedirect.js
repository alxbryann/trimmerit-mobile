import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

/**
 * URL de retorno OAuth para signInWithOAuth → redirectTo.
 *
 * Estrategia recomendada (evita quedarse en la web en el navegador embebido):
 * define EXPO_PUBLIC_SITE_URL con tu dominio (ej. https://trimmerit.vercel.app).
 * Se usará `${SITE_URL}/auth/mobile-callback` (HTTPS). Esa ruta existe en Next
 * y reenvía a trimmerit:// con el mismo hash/query.
 *
 * En Supabase → Redirect URLs añade exactamente esa URL HTTPS, por ejemplo:
 *   https://trimmerit.vercel.app/auth/mobile-callback
 *
 * Opcional: exp://** y trimmerit://** si sigues usando deep links directos.
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

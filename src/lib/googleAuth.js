import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { getOAuthRedirectUri } from './oauthRedirect';

try {
  WebBrowser.maybeCompleteAuthSession();
} catch {
  /* evita fallo en arranque si el módulo nativo aún no está listo */
}

export { getOAuthRedirectUri } from './oauthRedirect';

/**
 * Extrae tokens (implicit) o code (PKCE) de la URL final del proveedor.
 * Acepta exp://, barberit:// y también https:// (p. ej. Site URL si falló el allowlist).
 */
function extractOAuthFromUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return null;

  const hashIdx = urlString.indexOf('#');
  if (hashIdx !== -1) {
    const hash = urlString.slice(hashIdx + 1);
    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      return { kind: 'tokens', access_token, refresh_token };
    }
  }

  const codeMatch = urlString.match(/[?&#]code=([^&#]+)/);
  if (codeMatch) {
    try {
      return { kind: 'code', code: decodeURIComponent(codeMatch[1]) };
    } catch {
      return { kind: 'code', code: codeMatch[1] };
    }
  }

  return null;
}

/** Si la app se abre con barberit://auth/callback#… tras la página web de respaldo. */
export async function finalizeOAuthFromUrl(urlString) {
  const parsed = extractOAuthFromUrl(urlString);
  if (parsed?.kind === 'tokens') {
    const { error } = await supabase.auth.setSession({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
    });
    if (error) throw error;
    return true;
  }
  if (parsed?.kind === 'code') {
    const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (error) throw error;
    return true;
  }
  return false;
}

/**
 * Google OAuth en nativo: abre el navegador y aplica tokens al cliente Supabase.
 */
export async function signInWithGoogle() {
  const redirectTo = getOAuthRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('No OAuth URL');

  // Debe coincidir exactamente con `redirectTo` de signInWithOAuth. Si usas HTTPS
  // (EXPO_PUBLIC_SITE_URL → …/auth/mobile-callback) y aquí pasas barberit://, iOS no
  // reconoce el cierre del ASWebAuthenticationSession y la promesa no termina.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success' || !result.url) {
    return { cancelled: true };
  }

  const ok = await finalizeOAuthFromUrl(result.url);
  if (ok) {
    const { data } = await supabase.auth.getSession();
    return { cancelled: false, session: data?.session ?? null };
  }

  throw new Error(
    'No se pudo leer la sesión. Añade en Supabase Redirect URLs la URL HTTPS de callback (ver EXPO_PUBLIC_SITE_URL + /auth/mobile-callback) y exp://** / barberit://** si usas deep links.'
  );
}

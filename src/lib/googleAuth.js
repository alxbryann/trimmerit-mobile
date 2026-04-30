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
 * Acepta exp://, trimmerit:// y también https:// (p. ej. Site URL si falló el allowlist).
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

/** Si la app se abre con trimmerit://auth/callback#… tras la página web de respaldo. */
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
 *
 * Flujo:
 *  1. Supabase genera URL de Google OAuth con redirectTo = deep link de la app
 *  2. openAuthSessionAsync abre el browser; iOS/Android lo cierran cuando detectan
 *     el scheme trimmerit:// (o exp:// en dev) y devuelven la URL con el code/tokens
 *  3. finalizeOAuthFromUrl extrae el code/tokens y establece la sesión
 */
export async function signInWithGoogle() {
  const redirectTo = getOAuthRedirectUri();
  if (__DEV__) {
    console.log('[Trimmerit OAuth] signInWithGoogle redirectTo:', redirectTo);
  }

  // OWASP A07: flowType 'pkce' — el code_challenge viaja en la URL pública;
  // el code_verifier se guarda en SecureStore y se valida al canjear el code.
  // Esto evita el flujo implícito donde los tokens van en el hash de la URL.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, flowType: 'pkce' },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('No OAuth URL');
  if (__DEV__) {
    console.log('[Trimmerit OAuth] supabase data.url:', data.url);
  }

  // redirectTo debe coincidir aquí también: iOS cierra ASWebAuthenticationSession
  // cuando el browser navega a una URL que empieza con este scheme.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (__DEV__) {
    console.log('[Trimmerit OAuth] openAuthSession result.type:', result?.type);
    console.log('[Trimmerit OAuth] openAuthSession result.url:', result?.url ?? '(sin url)');
  }

  if (result.type !== 'success' || !result.url) {
    return { cancelled: true };
  }

  const ok = await finalizeOAuthFromUrl(result.url);
  if (ok) {
    const { data: sessionData } = await supabase.auth.getSession();
    return { cancelled: false, session: sessionData?.session ?? null };
  }

  throw new Error(
    'OAuth completó pero no se pudo establecer la sesión. ' +
    'Verificá en Supabase Dashboard → Authentication → URL Configuration que estén añadidos exp://** y trimmerit://** ' +
    '(y la URL HTTPS de callback solo si también usas web).'
  );
}

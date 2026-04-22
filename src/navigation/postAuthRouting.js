import { supabase } from '../lib/supabase';

/**
 * Decide la pantalla tras autenticación (arranque, OAuth o login).
 * Sin fila en `profiles` → CompletarPerfil.
 *
 * @returns {{ kind: 'completar', params: object } | { kind: 'reset', state: object } | { kind: 'route', name: string }}
 */
export function extractGoogleMetadata(session) {
  const meta = session?.user?.user_metadata || {};
  return {
    suggestedNombre: meta.full_name || meta.name || '',
    suggestedEmail: session?.user?.email || meta.email || '',
    suggestedAvatar: meta.avatar_url || meta.picture || '',
  };
}

export async function resolvePostAuthDestination(session) {
  const userId = session.user.id;
  const metadata = extractGoogleMetadata(session);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, telefono')
    .eq('id', userId)
    .maybeSingle();

  // Sin perfil → completar. Con perfil pero sin teléfono → todavía "incompleto"
  // (caso típico: el trigger auth.users → profiles pone role='cliente' por defecto
  // en OAuth de Google, pero el usuario no pasó aún por la pantalla de completar).
  const isIncomplete = !profile || !profile.telefono;

  if (isIncomplete) {
    const params = { ...metadata };
    // Solo propagamos el rol cuando ya hay indicios claros (p. ej. barbero con slug sin telefono).
    // Si no, dejamos que CompletarPerfil muestre el selector o use el rol que venga del flujo.
    return { kind: 'completar', params };
  }

  const role = profile.role;
  if (role === 'admin_barberia') {
    const { data: barberiaRow } = await supabase
      .from('barberias')
      .select('id')
      .eq('admin_id', userId)
      .maybeSingle();
    return { kind: 'route', name: barberiaRow ? 'MainTabs' : 'CrearBarberia' };
  }
  if (role === 'barbero_empleado') {
    const { data: barberoRow } = await supabase
      .from('barberos')
      .select('id, barberia_id')
      .eq('id', userId)
      .maybeSingle();
    return { kind: 'route', name: barberoRow?.barberia_id ? 'MainTabs' : 'UnirseBarberia' };
  }
  if (role === 'barbero') {
    // Legacy: independent barbers are treated as barberia owners
    const { data: barberiaRow } = await supabase
      .from('barberias')
      .select('id')
      .eq('admin_id', userId)
      .maybeSingle();
    return { kind: 'route', name: barberiaRow ? 'MainTabs' : 'CrearBarberia' };
  }
  return { kind: 'route', name: 'MainTabs' };
}

/** Aplica el destino a navigation.reset (React Navigation). */
export function applyPostAuthDestination(navigation, dest, extraCompletarParams = {}) {
  if (dest.kind === 'completar') {
    navigation.reset({
      index: 0,
      routes: [{ name: 'CompletarPerfil', params: { ...dest.params, ...extraCompletarParams } }],
    });
    return;
  }
  if (dest.kind === 'reset') {
    navigation.reset(dest.state);
    return;
  }
  navigation.reset({ index: 0, routes: [{ name: dest.name }] });
}
